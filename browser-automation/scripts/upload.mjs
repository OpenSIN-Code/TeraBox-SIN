import path from 'node:path';
import fs from 'node:fs/promises';
import { connect, requireTeraBoxPage } from './lib.mjs';

const file = process.argv[2];
if (!file) throw new Error('Usage: npm run upload -- /absolute/path/to/file');
await fs.access(file);
const browser = await connect();
const page = await requireTeraBoxPage(browser);

const input = page.locator('input[type=file]').first();
if (await input.count()) {
    await input.setInputFiles(path.resolve(file));
} else {
    const chooserPromise = page.waitForEvent('filechooser', { timeout: 10000 });
    const button = page.getByText(/upload|hochladen/i).first();
    await button.click();
    const chooser = await chooserPromise;
    await chooser.setFiles(path.resolve(file));
}
console.log(`Upload started: ${path.basename(file)}`);
await page.waitForTimeout(3000);
await browser.close();
