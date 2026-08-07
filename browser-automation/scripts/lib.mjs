import { fileURLToPath } from 'node:url';
import path from 'node:path';
import CDP from 'chrome-remote-interface';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const HOST = '127.0.0.1';

export const ROOT = path.resolve(scriptDir, '..');
export const PORT = Number(process.env.TERABOX_CDP_PORT || 9225);
export const ENDPOINT = `http://${HOST}:${PORT}`;
export const PROFILE_DIR = process.env.TERABOX_BROWSER_PROFILE || path.join(ROOT, 'browser-profile');
export const DATA_DIR = process.env.TERABOX_BROWSER_DATA || path.join(ROOT, 'data');
export const DOWNLOAD_DIR = process.env.TERABOX_BROWSER_DOWNLOADS || path.join(ROOT, 'downloads');

export function isTeraBoxUrl(value) {
    try {
        const url = new URL(value);
        const hostname = url.hostname.toLowerCase();
        return ['http:', 'https:'].includes(url.protocol)
            && (hostname === 'terabox.com' || hostname.endsWith('.terabox.com'));
    } catch {
        return false;
    }
}

function targetScore(target) {
    try {
        const url = new URL(target.url);
        if (!isTeraBoxUrl(url.href) || target.type !== 'page') return -1;
        if (url.pathname === '/main' && url.searchParams.get('category') === 'all') return 30;
        if (url.pathname.startsWith('/main')) return 20;
        if (url.pathname.startsWith('/ai/')) return 5;
        return 10;
    } catch {
        return -1;
    }
}

export async function listTargets() {
    return CDP.List({ host: HOST, port: PORT });
}

export async function findTeraBoxTarget() {
    const targets = await listTargets();
    const candidates = targets
        .map((target) => ({ target, score: targetScore(target) }))
        .filter(({ score }) => score >= 0)
        .sort((a, b) => b.score - a.score);
    return candidates[0]?.target || null;
}

export async function requireTeraBoxTarget() {
    const target = await findTeraBoxTarget();
    if (!target) throw new Error('No TeraBox tab found. Run `npm run start` first.');
    return target;
}

export async function connectTeraBoxTarget() {
    const target = await requireTeraBoxTarget();
    const client = await CDP({ host: HOST, port: PORT, target: target.id });
    return { client, target };
}

export async function evaluate(client, expression) {
    const { Runtime } = client;
    await Runtime.enable();
    const response = await Runtime.evaluate({ expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) {
        throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || 'Runtime evaluation failed.');
    }
    return response.result.value;
}

export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
