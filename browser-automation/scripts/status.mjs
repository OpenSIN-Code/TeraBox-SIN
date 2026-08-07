import { connectTeraBoxTarget, ENDPOINT, evaluate } from './lib.mjs';

try {
    const { client, target } = await connectTeraBoxTarget();
    try {
        const title = await evaluate(client, 'document.title');
        const url = await evaluate(client, 'location.href');
        const body = await evaluate(client, 'document.body?.innerText || ""');
        const loginHints = /(log in|login|sign in|anmelden|einloggen)/i.test(body.slice(0, 12000));
        const fileHints = /(my files|all files|dateien|upload|hochladen)/i.test(body.slice(0, 12000));
        console.log(JSON.stringify({
            ok: true,
            endpoint: ENDPOINT,
            targetId: target.id,
            title,
            url,
            likelyLoginScreen: loginHints && !fileHints,
            likelyFileArea: fileHints,
        }, null, 2));
    } finally {
        await client.close();
    }
} catch (error) {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exit(1);
}
