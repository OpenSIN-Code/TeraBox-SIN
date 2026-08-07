import { connect, findTeraBoxPage, ENDPOINT } from './lib.mjs';

try {
    const browser = await connect();
    const page = await findTeraBoxPage(browser);
    if (!page) {
        console.log(JSON.stringify({ ok: false, endpoint: ENDPOINT, reason: 'no-terabox-tab' }, null, 2));
        await browser.close();
        process.exit(2);
    }

    const title = await page.title();
    const url = page.url();
    const body = await page.locator('body').innerText().catch(() => '');
    const loginHints = /(log in|login|sign in|anmelden|einloggen)/i.test(body.slice(0, 12000));
    const fileHints = /(my files|all files|dateien|upload|hochladen)/i.test(body.slice(0, 12000));

    console.log(JSON.stringify({
        ok: true,
        endpoint: ENDPOINT,
        title,
        url,
        likelyLoginScreen: loginHints && !fileHints,
        likelyFileArea: fileHints
    }, null, 2));

    await browser.close();
} catch (error) {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exit(1);
}
