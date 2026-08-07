import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';

import { isTeraBoxUrl } from '../scripts/lib.mjs';

test('accepts only real TeraBox web origins', () => {
    assert.equal(isTeraBoxUrl('https://www.terabox.com/main?category=all'), true);
    assert.equal(isTeraBoxUrl('https://terabox.com/'), true);
    assert.equal(isTeraBoxUrl('https://sub.terabox.com/path'), true);
    assert.equal(isTeraBoxUrl('https://evil.example/?next=terabox.com'), false);
    assert.equal(isTeraBoxUrl('https://terabox.com.evil.example/'), false);
    assert.equal(isTeraBoxUrl('not-a-url'), false);
});

test('starter fails cleanly when Chrome cannot be spawned', async () => {
    const child = spawn(process.execPath, ['scripts/start-browser.mjs'], {
        cwd: new URL('..', import.meta.url),
        env: {
            ...process.env,
            TERABOX_CHROME: '/definitely/missing/google-chrome',
            TERABOX_CDP_PORT: '59225',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const code = await new Promise((resolve) => child.once('close', resolve));
    assert.equal(code, 1);
    assert.doesNotMatch(stdout, /Started dedicated TeraBox Chrome/);
    assert.match(stderr, /ENOENT|spawn|missing/i);
});
