import { connect, requireTeraBoxPage } from './lib.mjs';

const name = process.argv.slice(2).join(' ').trim();
if (!name) throw new Error('Usage: npm run mkdir -- "Folder name"');
const browser = await connect();
const page = await requireTeraBoxPage(browser);

const createButton = page.getByText(/new folder|create folder|neuer ordner|ordner erstellen|create/i).first();
await createButton.click();
const dialog = page.getByRole('dialog').last();
const input = dialog.locator('input').first();
await input.fill(name);
const confirm = dialog.getByRole('button', { name: /create|ok|erstellen|bestätigen/i }).first();
await confirm.click();
console.log(`Folder creation requested: ${name}`);
await page.waitForTimeout(1500);
await browser.close();
