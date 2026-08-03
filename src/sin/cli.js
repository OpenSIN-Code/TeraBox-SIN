#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

import {
    createTeraBoxClient,
    describePublicMethods,
    getTeraBoxStatus,
    invokeTeraBoxMethod,
} from './client.js';
import {
    deleteStoredNdus,
    getStoredNdus,
    keychainAvailable,
    maskToken,
    storeNdus,
} from './keychain.js';

const execFileAsync = promisify(execFile);

function output(value) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage(exitCode = 0) {
    process.stderr.write('TeraBox-SIN\n\nUsage:\n  terabox-sin doctor\n  terabox-sin status\n  terabox-sin methods\n  terabox-sin call <method> [json-array|@file.json] [--output <path>]\n  terabox-sin session status\n  terabox-sin session set          # native hidden macOS dialog, or token on stdin\n  terabox-sin session delete\n  terabox-sin login <email>        # native hidden password dialog\n  terabox-sin mcp                  # stdio MCP server\n');
    process.exit(exitCode);
}

async function readAllStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8').trim();
}

async function hiddenDialog(prompt) {
    if (process.platform !== 'darwin') throw new Error('Hidden native dialog is available only on macOS. Pipe the value on stdin instead.');
    const script = `text returned of (display dialog ${JSON.stringify(prompt)} default answer "" with hidden answer buttons {"Cancel", "OK"} default button "OK")`;
    const { stdout } = await execFileAsync('/usr/bin/osascript', ['-e', script], { timeout: 300000 });
    return stdout.trim();
}

async function secretInput(prompt) {
    if (!process.stdin.isTTY) return readAllStdin();
    return hiddenDialog(prompt);
}

async function parseArgsValue(raw) {
    if (!raw) return [];
    if (raw.startsWith('@')) return JSON.parse(await readFile(raw.slice(1), 'utf8'));
    return JSON.parse(raw);
}

function pullOption(argv, name) {
    const index = argv.indexOf(name);
    if (index < 0) return undefined;
    if (index + 1 >= argv.length) throw new Error(`${name} requires a value.`);
    const value = argv[index + 1];
    argv.splice(index, 2);
    return value;
}

async function main() {
    const argv = process.argv.slice(2);
    const command = argv.shift();
    if (!command || command === 'help' || command === '--help' || command === '-h') usage(0);
    if (command === 'mcp') return import('./stdio.js');

    if (command === 'doctor') {
        const token = await getStoredNdus();
        const client = await createTeraBoxClient({ requireAuth: false });
        let remote = null;
        if (token) {
            try { remote = await getTeraBoxStatus(); }
            catch (error) { remote = { error: error.message }; }
        }
        return output({
            ok: Boolean(await keychainAvailable()),
            node: process.version,
            platform: process.platform,
            keychain_available: await keychainAvailable(),
            session_configured: Boolean(token),
            session_masked: maskToken(token),
            public_method_count: describePublicMethods(client).length,
            remote,
        });
    }

    if (command === 'status') return output(await getTeraBoxStatus());
    if (command === 'methods') {
        const client = await createTeraBoxClient({ requireAuth: false });
        return output(describePublicMethods(client));
    }

    if (command === 'call') {
        const method = argv.shift();
        if (!method) throw new Error('call requires a method name.');
        const outputPath = pullOption(argv, '--output');
        const args = await parseArgsValue(argv.shift());
        if (!Array.isArray(args)) throw new Error('Method arguments must be a JSON array.');
        const client = await createTeraBoxClient();
        return output(await invokeTeraBoxMethod(client, method, args, { outputPath }));
    }

    if (command === 'session') {
        const action = argv.shift() || 'status';
        if (action === 'status') {
            const token = await getStoredNdus();
            return output({ configured: Boolean(token), masked: maskToken(token) });
        }
        if (action === 'set') {
            const token = await secretInput('TeraBox NDUS-Sitzungsschlüssel eingeben');
            if (!token) throw new Error('No token supplied.');
            return output(await storeNdus(token));
        }
        if (action === 'delete') return output(await deleteStoredNdus());
        throw new Error(`Unknown session action: ${action}`);
    }

    if (command === 'login') {
        const email = argv.shift();
        if (!email) throw new Error('login requires an email address.');
        const password = await secretInput(`TeraBox-Passwort für ${email}`);
        if (!password) throw new Error('No password supplied.');
        const client = await createTeraBoxClient({ requireAuth: false });
        const prelogin = await client.passportPreLogin(email);
        const result = await client.passportLogin(prelogin, email, password);
        const token = result?.data?.ndus;
        if (!token) return output({ stored: false, login: result });
        await storeNdus(token);
        return output({ stored: true, login: { ...result, data: { ...result.data, ndus: maskToken(token) } } });
    }

    usage(1);
}

main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error.message, cause: error.cause?.message || error.cause || null })}\n`);
    process.exitCode = 1;
});
