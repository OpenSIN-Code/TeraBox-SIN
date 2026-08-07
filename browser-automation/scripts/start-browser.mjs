import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const port = 9225;
const profile = path.join(os.homedir(), 'terabox-sin', 'browser-profile');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function alreadyRunning() {
    try {
        const r = await fetch(`http://127.0.0.1:${port}/json/version`);
        return r.ok;
    } catch {
        return false;
    }
}

if (await alreadyRunning()) {
    console.log(`TeraBox browser already running on http://127.0.0.1:${port}`);
    process.exit(0);
}

const child = spawn(chrome, [
    `--user-data-dir=${profile}`,
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--new-window',
    'https://www.terabox.com/main?category=all'
], {
    detached: true,
    stdio: 'ignore'
});

child.unref();
console.log(`Started dedicated TeraBox Chrome profile on port ${port}`);
console.log(`Profile: ${profile}`);
