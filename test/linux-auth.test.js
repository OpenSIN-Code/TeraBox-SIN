import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import {
    deleteStoredNdus,
    getStoredNdus,
    keychainAvailable,
    sanitizeLoginResult,
    secretServiceAvailable,
    secretToolAvailable,
    storeNdus,
} from '../src/sin/keychain.js';
import { readHiddenInput } from '../src/sin/secret-input.js';

const FAKE_TOKEN = 'NDUS-FAKE-TOKEN-1234567890abcdef';

// ---------------------------------------------------------------------------
// Hidden TTY password input (Linux interactive login)
// ---------------------------------------------------------------------------

test('piped stdin returns trimmed value without touching TTY echo controls', async () => {
    async function* chunks() {
        yield Buffer.from('  piped-secret-value  ');
    }
    const stdin = {
        isTTY: false,
        setRawMode() {
            throw new Error('setRawMode must not be called for piped stdin');
        },
        [Symbol.asyncIterator]: chunks,
    };
    const writes = [];
    const stdout = { write: (chunk) => { writes.push(String(chunk)); return true; } };
    const value = await readHiddenInput('Password: ', { stdin, stdout });
    assert.equal(value, 'piped-secret-value');
});

test('TTY input hides keystrokes, supports backspace, and restores raw mode', async () => {
    const stdin = new EventEmitter();
    const rawModeCalls = [];
    stdin.isTTY = true;
    stdin.setEncoding = () => {};
    stdin.setRawMode = (mode) => { rawModeCalls.push(mode); };
    stdin.resume = () => {};
    stdin.pause = () => {};
    const writes = [];
    const stdout = { write: (chunk) => { writes.push(String(chunk)); return true; } };

    const pending = readHiddenInput('TeraBox-Passwort: ', { stdin, stdout });
    // Type "ab", erase "b", type "c", submit. No fake credential material.
    for (const key of ['a', 'b', '\u007f', 'c', '\r']) stdin.emit('data', key);
    const value = await pending;

    assert.equal(value, 'ac');
    assert.deepEqual(rawModeCalls, [true, false]);
    const echoed = writes.join('');
    assert.ok(echoed.includes('TeraBox-Passwort: '));
    // The prompt itself contains "a", so only inspect output after the prompt.
    const afterPrompt = echoed.slice(echoed.indexOf('TeraBox-Passwort: ') + 'TeraBox-Passwort: '.length);
    assert.ok(!afterPrompt.includes('a'), 'keystrokes must not be echoed');
    assert.ok(!afterPrompt.includes('c'), 'keystrokes must not be echoed');
});

test('TTY input ends on newline and emits a trailing newline', async () => {
    const stdin = new EventEmitter();
    stdin.isTTY = true;
    stdin.setEncoding = () => {};
    stdin.setRawMode = () => {};
    stdin.resume = () => {};
    stdin.pause = () => {};
    const writes = [];
    const stdout = { write: (chunk) => { writes.push(String(chunk)); return true; } };

    const pending = readHiddenInput('Password: ', { stdin, stdout });
    stdin.emit('data', 'x');
    stdin.emit('data', '\n');
    assert.equal(await pending, 'x');
    assert.ok(writes.join('').endsWith('\n'));
});

// ---------------------------------------------------------------------------
// Secret Service NDUS storage (Linux backend, injected fakes only)
// ---------------------------------------------------------------------------

function fakeExecFactory(handler) {
    const calls = [];
    const exec = async (file, args, options) => {
        calls.push({ file, args, options });
        return handler(file, args, options);
    };
    return { exec, calls };
}

test('secretServiceAvailable probes secret-tool without credentials', async () => {
    const { exec, calls } = fakeExecFactory(async () => ({ stdout: 'usage', stderr: '' }));
    assert.equal(await secretServiceAvailable({ exec }), true);
    assert.equal(calls[0].file, 'secret-tool');

    const failing = fakeExecFactory(async () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); });
    assert.equal(await secretServiceAvailable({ exec: failing.exec }), false);
});

test('getStoredNdus reads Linux Secret Service lookup result', async () => {
    const { exec, calls } = fakeExecFactory(async () => ({ stdout: `  ${FAKE_TOKEN}\n`, stderr: '' }));
    const token = await getStoredNdus({ platform: 'linux', exec });
    assert.equal(token, FAKE_TOKEN);
    assert.deepEqual(calls[0].args, ['lookup', 'service', 'TeraBox-SIN', 'account', 'ndus']);
});

test('getStoredNdus returns null when the Secret Service item is missing', async () => {
    const { exec } = fakeExecFactory(async () => { throw Object.assign(new Error('not found'), { code: 1 }); });
    assert.equal(await getStoredNdus({ platform: 'linux', exec }), null);
});

test('storeNdus pipes the token to secret-tool stdin on Linux', async () => {
    const { exec, calls } = fakeExecFactory(async () => ({ stdout: '', stderr: '' }));
    const result = await storeNdus(FAKE_TOKEN, { platform: 'linux', exec });
    assert.equal(result.stored, true);
    assert.equal(calls[0].file, 'secret-tool');
    assert.ok(calls[0].args.includes('store'));
    assert.equal(calls[0].options?.stdin, FAKE_TOKEN);
    assert.ok(!calls[0].args.includes(FAKE_TOKEN), 'token must never appear in argv');
});

test('default Linux store path writes token only to child stdin', async () => {
    const { EventEmitter } = await import('node:events');
    let command;
    let args;
    let stdinValue;
    const spawn = (file, argv) => {
        command = file;
        args = argv;
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.stdout.setEncoding = () => {};
        child.stderr.setEncoding = () => {};
        child.stdin = { end: (value) => { stdinValue = value; } };
        child.kill = () => {};
        queueMicrotask(() => child.emit('close', 0, null));
        return child;
    };
    await storeNdus(FAKE_TOKEN, { platform: 'linux', spawn });
    assert.equal(command, 'secret-tool');
    assert.ok(args.includes('store'));
    assert.ok(!args.includes(FAKE_TOKEN));
    assert.equal(stdinValue, `${FAKE_TOKEN}\n`);
});

test('secretServiceAvailable requires a responding Secret Service lookup', async () => {
    const missingService = fakeExecFactory(async (file, args) => {
        if (args[0] === '--help') return { stdout: 'usage', stderr: '' };
        throw Object.assign(new Error('org.freedesktop.DBus.Error.ServiceUnknown'), { code: 1 });
    });
    assert.equal(await secretServiceAvailable({ exec: missingService.exec }), false);
    assert.equal(missingService.calls.length, 2);
});

test('secretToolAvailable only reports whether the CLI is installed', async () => {
    const installed = fakeExecFactory(async () => ({ stdout: 'usage', stderr: '' }));
    assert.equal(await secretToolAvailable({ exec: installed.exec }), true);
    assert.deepEqual(installed.calls[0].args, ['--help']);

    const missing = fakeExecFactory(async () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); });
    assert.equal(await secretToolAvailable({ exec: missing.exec }), false);
});

test('deleteStoredNdus clears the Secret Service item on Linux', async () => {
    const { exec, calls } = fakeExecFactory(async () => ({ stdout: '', stderr: '' }));
    const result = await deleteStoredNdus({ platform: 'linux', exec });
    assert.equal(result.deleted, true);
    assert.deepEqual(calls[0].args, ['clear', 'service', 'TeraBox-SIN', 'account', 'ndus']);
});

test('keychainAvailable covers the Linux Secret Service backend', async () => {
    const { exec } = fakeExecFactory(async () => ({ stdout: 'usage', stderr: '' }));
    assert.equal(await keychainAvailable({ platform: 'linux', exec }), true);
});

// ---------------------------------------------------------------------------
// macOS Keychain preservation (injected fakes only, never the real Keychain)
// ---------------------------------------------------------------------------

test('macOS Keychain backend is preserved via /usr/bin/security', async () => {
    const { exec, calls } = fakeExecFactory(async () => ({ stdout: `  ${FAKE_TOKEN}\n`, stderr: '' }));
    assert.equal(await keychainAvailable({ platform: 'darwin', exec }), true);
    assert.equal(await getStoredNdus({ platform: 'darwin', exec }), FAKE_TOKEN);
    assert.equal(calls[1].file, '/usr/bin/security');
    assert.ok(calls[1].args.includes('find-generic-password'));
});

test('storeNdus preserves the macOS Keychain backend', async () => {
    const { exec, calls } = fakeExecFactory(async () => ({ stdout: '', stderr: '' }));
    const result = await storeNdus(FAKE_TOKEN, { platform: 'darwin', exec });
    assert.equal(result.stored, true);
    assert.equal(calls[0].file, '/usr/bin/security');
    assert.ok(calls[0].args.includes('add-generic-password'));
});

test('deleteStoredNdus preserves the macOS Keychain backend', async () => {
    const { exec, calls } = fakeExecFactory(async () => ({ stdout: '', stderr: '' }));
    const result = await deleteStoredNdus({ platform: 'darwin', exec });
    assert.equal(result.deleted, true);
    assert.equal(calls[0].file, '/usr/bin/security');
    assert.ok(calls[0].args.includes('delete-generic-password'));
});

// ---------------------------------------------------------------------------
// Sanitized login output (never leak NDUS/password)
// ---------------------------------------------------------------------------

test('sanitizeLoginResult masks NDUS and password fields without mutating input', () => {
    const input = {
        errno: 0,
        data: { ndus: FAKE_TOKEN, password: 'supersecret', user: 'user@example.com' },
    };
    const sanitized = sanitizeLoginResult(input);
    assert.equal(sanitized.data.user, 'user@example.com');
    assert.notEqual(sanitized.data.ndus, FAKE_TOKEN);
    assert.notEqual(sanitized.data.password, 'supersecret');
    assert.ok(!JSON.stringify(sanitized).includes(FAKE_TOKEN));
    // Input object is untouched.
    assert.equal(input.data.ndus, FAKE_TOKEN);
});

test('sanitizeLoginResult handles responses without a session token', () => {
    const sanitized = sanitizeLoginResult({ errno: 1, errmsg: 'bad login' });
    assert.equal(sanitized.errno, 1);
    assert.equal(sanitizeLoginResult(null), null);
});
