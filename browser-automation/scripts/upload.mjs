import fs from 'node:fs/promises';
import path from 'node:path';
import { connectTeraBoxTarget, evaluate, sleep } from './lib.mjs';

const file = process.argv[2];
if (!file) throw new Error('Usage: npm run upload -- /absolute/path/to/file');
const absoluteFile = path.resolve(file);
await fs.access(absoluteFile);

const { client } = await connectTeraBoxTarget();
try {
    const { DOM } = client;
    await DOM.enable();

    async function findFileInput() {
        const { root } = await DOM.getDocument({ depth: -1, pierce: true });
        return DOM.querySelector({ nodeId: root.nodeId, selector: 'input[type=file]' });
    }

    let { nodeId } = await findFileInput();
    if (!nodeId) {
        const clicked = await evaluate(client, `(() => {
            const labels = ['upload', 'hochladen'];
            const elements = [...document.querySelectorAll('button,[role="button"],a')];
            const target = elements.find((element) => {
                const text = [element.textContent, element.getAttribute('aria-label'), element.getAttribute('title')]
                    .filter(Boolean).join(' ').trim().toLowerCase();
                return labels.some((label) => text.includes(label));
            });
            if (!target) return false;
            target.click();
            return true;
        })()`);
        if (!clicked) throw new Error('Could not find a visible TeraBox upload control.');
        for (let attempt = 0; attempt < 30 && !nodeId; attempt += 1) {
            await sleep(200);
            ({ nodeId } = await findFileInput());
        }
    }
    if (!nodeId) throw new Error('TeraBox did not expose a file input after opening Upload.');
    await DOM.setFileInputFiles({ nodeId, files: [absoluteFile] });
    console.log(`Upload started: ${path.basename(absoluteFile)}`);
    await sleep(1000);
} finally {
    await client.close();
}
