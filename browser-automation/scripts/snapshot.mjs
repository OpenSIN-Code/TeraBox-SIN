import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { connect, requireTeraBoxPage } from './lib.mjs';

const out = path.join(os.homedir(), 'terabox-sin', 'data', 'terabox-page.txt');
const browser = await connect();
const page = await requireTeraBoxPage(browser);
const title = await page.title();
const url = page.url();
const text = await page.locator('body').innerText();
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, `TITLE: ${title}\nURL: ${url}\n\n${text}\n`, 'utf8');
console.log(out);
await browser.close();
