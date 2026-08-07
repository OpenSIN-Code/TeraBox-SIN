import { chromium } from 'playwright';

export const PORT = 9225;
export const ENDPOINT = `http://127.0.0.1:${PORT}`;

export async function connect() {
    return chromium.connectOverCDP(ENDPOINT);
}

export async function findTeraBoxPage(browser) {
    for (const context of browser.contexts()) {
        for (const page of context.pages()) {
            if (page.url().includes('terabox.com')) return page;
        }
    }
    return null;
}

export async function requireTeraBoxPage(browser) {
    const page = await findTeraBoxPage(browser);
    if (!page) throw new Error('No TeraBox tab found. Run npm run start first.');
    return page;
}
