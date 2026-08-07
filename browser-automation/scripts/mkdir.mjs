import { connectTeraBoxTarget, evaluate } from './lib.mjs';

const name = process.argv.slice(2).join(' ').trim();
if (!name) throw new Error('Usage: npm run mkdir -- "Folder name"');

const { client } = await connectTeraBoxTarget();
try {
    const result = await evaluate(client, `(async () => {
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const textOf = (element) => [element.textContent, element.getAttribute('aria-label'), element.getAttribute('title')]
            .filter(Boolean).join(' ').trim().toLowerCase();
        const labels = ['new folder', 'create folder', 'neuer ordner', 'ordner erstellen'];
        const controls = [...document.querySelectorAll('button,[role="button"]')];
        const create = controls.find((element) => labels.some((label) => textOf(element).includes(label)));
        if (!create) return { ok: false, reason: 'folder-control-not-found' };
        create.click();
        await sleep(300);
        const dialogs = [...document.querySelectorAll('[role="dialog"], .dialog, .modal')]
            .filter((element) => element.querySelector('input'));
        const dialog = dialogs.at(-1) || document;
        const input = dialog.querySelector('input');
        if (!input) return { ok: false, reason: 'folder-name-input-not-found' };
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        valueSetter?.call(input, ${JSON.stringify(name)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        const confirmLabels = ['create', 'ok', 'erstellen', 'bestätigen'];
        const buttons = [...dialog.querySelectorAll('button,[role="button"]')];
        const confirm = buttons.find((element) => confirmLabels.some((label) => textOf(element) === label || textOf(element).includes(label)));
        if (!confirm) return { ok: false, reason: 'folder-confirm-not-found' };
        confirm.click();
        return { ok: true };
    })()`);
    if (!result?.ok) throw new Error(`Folder creation UI failed: ${result?.reason || 'unknown'}`);
    console.log(`Folder creation requested: ${name}`);
} finally {
    await client.close();
}
