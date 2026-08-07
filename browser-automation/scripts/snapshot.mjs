import fs from 'node:fs/promises';
import path from 'node:path';
import { connectTeraBoxTarget, DATA_DIR, evaluate } from './lib.mjs';

await fs.mkdir(DATA_DIR, { recursive: true });
const out = path.join(DATA_DIR, 'terabox-page.txt');
const { client } = await connectTeraBoxTarget();
try {
    const title = await evaluate(client, 'document.title');
    const url = await evaluate(client, 'location.href');
    const text = await evaluate(client, 'document.body?.innerText || ""');
    await fs.writeFile(out, `TITLE: ${title}
URL: ${url}

${text}
`, 'utf8');
    console.log(out);
} finally {
    await client.close();
}
