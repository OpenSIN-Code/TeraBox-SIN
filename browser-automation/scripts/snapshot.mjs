import fs from 'node:fs/promises';
import path from 'node:path';
import { connect, DATA_DIR, requireTeraBoxPage } from './lib.mjs';

await fs.mkdir(DATA_DIR, { recursive: true });
const out = path.join(DATA_DIR, 'terabox-page.txt');

const browser = await connect();
const page = await requireTeraBoxPage(browser);
const title = await page.title();
const url = page.url();
const text = await page.locator('body').innerText();

await fs.writeFile(out, `TITLE: ${title}\nURL: ${url}\n\n${text}\n`, 'utf8');
console.log(out);
await browser.close();
