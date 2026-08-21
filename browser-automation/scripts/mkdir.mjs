import { connectTeraBoxTarget, evaluate, sleep } from './lib.mjs';

const name = process.argv.slice(2).join(' ').trim();
if (!name) throw new Error('Usage: npm run mkdir -- "Folder name"');

const { client } = await connectTeraBoxTarget();
try {
    const result = await evaluate(client, `(async () => {
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const textOf = (element) => [element.textContent, element.getAttribute('aria-label'), element.getAttribute('title')]
            .filter(Boolean).join(' ').replace(/\\s+/g, ' ').trim().toLowerCase();
        const visible = (element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        const labels = ['new folder', 'create folder', 'neuer ordner', 'ordner erstellen'];
        const controls = [...document.querySelectorAll('button,[role="button"],a')].filter(visible);
        const create = controls.find((element) => labels.some((label) => textOf(element).includes(label)));
        if (!create) return { ok: false, reason: 'folder-control-not-found' };

        const beforeInputs = new Set([...document.querySelectorAll('input')]);
        const beforeButtons = new Set([...document.querySelectorAll('button,[role="button"]')]);
        create.click();

        let input = null;
        for (let attempt = 0; attempt < 30 && !input; attempt += 1) {
            await sleep(100);
            const candidates = [...document.querySelectorAll('input:not([type="file"]):not([type="hidden"])')]
                .filter((element) => !beforeInputs.has(element) && visible(element));
            input = candidates.at(-1) || null;
        }
        if (!input) return { ok: false, reason: 'folder-name-input-not-found' };

        input.focus();
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        valueSetter?.call(input, ${JSON.stringify(name)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(100);

        const confirmLabels = ['create', 'ok', 'erstellen', 'bestätigen', 'confirm', 'save', 'speichern'];
        const freshButtons = [...document.querySelectorAll('button,[role="button"]')]
            .filter((element) => !beforeButtons.has(element) && visible(element));
        const confirm = freshButtons.find((element) => confirmLabels.some((label) => textOf(element) === label || textOf(element).includes(label)))
            || freshButtons.find((element) => !element.disabled);
        if (confirm) {
            confirm.click();
            return { ok: true, method: 'button', button: textOf(confirm) };
        }

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        return { ok: true, method: 'enter' };
    })()`);
    if (!result?.ok) throw new Error(`Folder creation UI failed: ${result?.reason || 'unknown'}`);
    console.log(`Folder creation requested: ${name}`);
    await sleep(1600);
} finally {
    await client.close();
}
