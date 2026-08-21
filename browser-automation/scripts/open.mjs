import { connectTeraBoxTarget, evaluate, sleep } from './lib.mjs';

const name = process.argv.slice(2).join(' ').trim();
if (!name) throw new Error('Usage: npm run open -- "Folder name"');

const { client } = await connectTeraBoxTarget();
try {
    const result = await evaluate(client, `(() => {
        const wanted = ${JSON.stringify(name)};
        const visible = (el) => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        };
        const text = (el) => (el.textContent || '').replace(/\\s+/g, ' ').trim();
        const exact = [...document.querySelectorAll('[title], [data-name], a, button, [role="button"], [role="row"], tr, li, div, span')]
            .filter((el) => visible(el) && (el.getAttribute('title') === wanted || el.getAttribute('data-name') === wanted || text(el) === wanted));
        if (!exact.length) return { ok: false, reason: 'folder-not-found' };
        const leaf = exact.sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width)[0];
        const target = leaf.closest('a,button,[role="button"],[role="row"],tr,li') || leaf.parentElement || leaf;
        target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window }));
        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return { ok: true, text: text(leaf) };
    })()`);
    if (!result?.ok) throw new Error(`Folder open failed: ${result?.reason || 'unknown'}`);
    await sleep(1200);
    console.log(`Folder open requested: ${name}`);
} finally {
    await client.close();
}
