import { spawn } from 'node:child_process';
import { ENDPOINT, isTeraBoxUrl, PORT, PROFILE_DIR } from './lib.mjs';

const chrome = process.env.TERABOX_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const startUrl = 'https://www.terabox.com/main?category=all';

async function endpointTargets() {
    try {
        const response = await fetch(`${ENDPOINT}/json/list`);
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

async function waitForTeraBoxTarget(child, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    let spawnError = null;
    child.once('error', (error) => { spawnError = error; });
    while (Date.now() < deadline) {
        if (spawnError) throw spawnError;
        const targets = await endpointTargets();
        if (targets?.some((target) => isTeraBoxUrl(target.url))) return;
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (spawnError) throw spawnError;
    throw new Error(`Chrome did not expose a TeraBox page on ${ENDPOINT} within ${timeoutMs}ms.`);
}

async function main() {
    const existingTargets = await endpointTargets();
    if (existingTargets) {
        if (!existingTargets.some((target) => isTeraBoxUrl(target.url))) {
            throw new Error(`CDP port ${PORT} is already in use by a browser without a TeraBox tab.`);
        }
        console.log(`TeraBox browser already running on ${ENDPOINT}`);
        return;
    }

    const child = spawn(chrome, [
        `--user-data-dir=${PROFILE_DIR}`,
        '--remote-debugging-address=127.0.0.1',
        `--remote-debugging-port=${PORT}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--new-window',
        startUrl,
    ], {
        detached: true,
        stdio: 'ignore',
    });

    await waitForTeraBoxTarget(child);
    child.unref();
    console.log(`Started dedicated TeraBox Chrome profile on ${ENDPOINT}`);
    console.log(`Profile: ${PROFILE_DIR}`);
}

main().catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
});
