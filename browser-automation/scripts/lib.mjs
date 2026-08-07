import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(scriptDir, '..');
export const PORT = Number(process.env.TERABOX_CDP_PORT || 9225);
export const ENDPOINT = `http://127.0.0.1:${PORT}`;
export const PROFILE_DIR = process.env.TERABOX_BROWSER_PROFILE || path.join(ROOT, 'browser-profile');
export const DATA_DIR = process.env.TERABOX_BROWSER_DATA || path.join(ROOT, 'data');
export const DOWNLOAD_DIR = process.env.TERABOX_BROWSER_DOWNLOADS || path.join(ROOT, 'downloads');

export async function connect() {
    return chromium.connectOverCDP(ENDPOINT);
}

export async function findTeraBoxPage(browser) {
    for (const context of browser.contexts()) {
        for (const page of context.pages()) {
            const url = page.url();
            if (url.includes('terabox.com')) return page;
        }
    }
    return null;
}

export async function requireTeraBoxPage(browser) {
    const page = await findTeraBoxPage(browser);
    if (!page) throw new Error('No TeraBox tab found. Run `npm run start` first.');
    return page;
}
