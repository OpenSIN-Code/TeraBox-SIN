import { spawn } from 'node:child_process';
import { ENDPOINT, PORT, PROFILE_DIR } from './lib.mjs';

const chrome = process.env.TERABOX_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const startUrl = 'https://www.terabox.com/main?category=all';

async function alreadyRunning() {
    try {
        const response = await fetch(`${ENDPOINT}/json/version`);
        return response.ok;
    } catch {
        return false;
    }
}

if (await alreadyRunning()) {
    console.log(`TeraBox browser already running on ${ENDPOINT}`);
    process.exit(0);
}

const child = spawn(chrome, [
    `--user-data-dir=${PROFILE_DIR}`,
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--new-window',
    startUrl,
], {
    detached: true,
    stdio: 'ignore',
});

child.unref();
console.log(`Started dedicated TeraBox Chrome profile on ${ENDPOINT}`);
console.log(`Profile: ${PROFILE_DIR}`);
