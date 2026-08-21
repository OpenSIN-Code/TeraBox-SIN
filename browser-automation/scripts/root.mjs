import { connectTeraBoxTarget, evaluate, sleep } from './lib.mjs';

const { client } = await connectTeraBoxTarget();
try {
    await evaluate(client, `(() => {
        window.location.assign('https://www.terabox.com/main?category=all');
        return true;
    })()`);
    await sleep(1400);
    console.log('TeraBox root requested.');
} finally {
    await client.close();
}
