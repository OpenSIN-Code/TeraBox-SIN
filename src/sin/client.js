import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';

import TeraBoxApp from '../../api.js';
import { getStoredNdus, maskToken } from './keychain.js';

const AUTO_RESULT_DIR = join(homedir(), '.cache', 'terabox-sin', 'results');

export function listPublicMethods(instance) {
    const methods = new Set();
    let prototype = Object.getPrototypeOf(instance);
    while (prototype && prototype !== Object.prototype) {
        for (const name of Object.getOwnPropertyNames(prototype)) {
            if (name === 'constructor' || name.startsWith('_')) continue;
            const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
            if (typeof descriptor?.value === 'function') methods.add(name);
        }
        prototype = Object.getPrototypeOf(prototype);
    }
    return [...methods].sort();
}

export function isLikelyMutating(name) {
    return /(?:upload|create|mkdir|delete|remove|move|copy|rename|transfer|restore|recycle|share|login|set|save|add|cancel|clear|precreate|commit|passport)/i.test(name);
}

export function describePublicMethods(instance) {
    return listPublicMethods(instance).map((name) => ({
        name,
        arity: instance[name].length,
        mutating: isLikelyMutating(name),
    }));
}

export async function createTeraBoxClient(options = {}) {
    const ndus = options.ndus || await getStoredNdus();
    if (!ndus && options.requireAuth !== false) {
        throw new Error('No TeraBox session found. Run `terabox-sin session set` or set TERABOX_NDUS.');
    }
    const client = new TeraBoxApp(ndus || '');
    if (Number.isFinite(options.timeoutMs) && options.timeoutMs > 0) {
        client.TERABOX_TIMEOUT = options.timeoutMs;
    }
    return client;
}

async function materializeSpecialValue(value) {
    if (Array.isArray(value)) return Promise.all(value.map(materializeSpecialValue));
    if (!value || typeof value !== 'object') return value;

    const keys = Object.keys(value);
    if (keys.length === 1 && typeof value.$file === 'string') {
        return readFile(resolve(value.$file));
    }
    if ((keys.length === 1 || keys.length === 2) && typeof value.$blob === 'string') {
        const buffer = await readFile(resolve(value.$blob));
        return new Blob([buffer], { type: value.type || 'application/octet-stream' });
    }
    if (keys.length === 1 && typeof value.$stream === 'string') {
        return createReadStream(resolve(value.$stream));
    }
    if (keys.length === 1 && typeof value.$json_file === 'string') {
        return JSON.parse(await readFile(resolve(value.$json_file), 'utf8'));
    }
    if (keys.length === 1 && typeof value.$env === 'string') {
        if (!(value.$env in process.env)) throw new Error(`Environment variable not found: ${value.$env}`);
        return process.env[value.$env];
    }
    if (keys.length === 1 && value.$abort_signal === true) return new AbortController().signal;
    if (keys.length === 1 && value.$progress === true) {
        return (...progress) => {
            process.stderr.write(`${JSON.stringify({ event: 'terabox-progress', progress })}\n`);
        };
    }

    const output = {};
    for (const [key, nested] of Object.entries(value)) {
        output[key] = await materializeSpecialValue(nested);
    }
    return output;
}

export async function materializeArguments(args = []) {
    if (!Array.isArray(args)) throw new TypeError('args must be a JSON array.');
    return Promise.all(args.map(materializeSpecialValue));
}

async function automaticOutputPath(extension = '.bin') {
    await mkdir(AUTO_RESULT_DIR, { recursive: true });
    return join(AUTO_RESULT_DIR, `${Date.now()}-${randomUUID()}${extension}`);
}

async function writeBinaryResult(data, outputPath) {
    const finalPath = resolve(outputPath || await automaticOutputPath());
    await mkdir(dirname(finalPath), { recursive: true });
    await writeFile(finalPath, data);
    return { type: 'file', path: finalPath, bytes: data.byteLength ?? data.length };
}

async function normalizeResultInternal(result, options, seen) {
    if (result === null || result === undefined) return result ?? null;
    if (typeof result === 'bigint') return result.toString();
    if (typeof result !== 'object') return result;

    if (Buffer.isBuffer(result) || result instanceof Uint8Array) {
        if (options.outputPath || result.byteLength > options.inlineBinaryLimit) {
            return writeBinaryResult(result, options.outputPath);
        }
        return { type: 'base64', bytes: result.byteLength, data: Buffer.from(result).toString('base64') };
    }

    if (typeof Blob !== 'undefined' && result instanceof Blob) {
        const buffer = Buffer.from(await result.arrayBuffer());
        if (options.outputPath || buffer.byteLength > options.inlineBinaryLimit) {
            return writeBinaryResult(buffer, options.outputPath);
        }
        return { type: result.type || 'application/octet-stream', bytes: buffer.byteLength, data: buffer.toString('base64') };
    }

    if (result instanceof Error) {
        return {
            name: result.name,
            message: result.message,
            cause: result.cause ? await normalizeResultInternal(result.cause, options, seen) : undefined,
            stack: options.includeStack ? result.stack : undefined,
        };
    }

    if (typeof result.pipe === 'function' || typeof result[Symbol.asyncIterator] === 'function') {
        const finalPath = resolve(options.outputPath || await automaticOutputPath());
        await mkdir(dirname(finalPath), { recursive: true });
        await pipeline(result, createWriteStream(finalPath));
        return { type: 'stream-file', path: finalPath, name: basename(finalPath) };
    }

    if (typeof result.arrayBuffer === 'function' && typeof result.headers === 'object') {
        const buffer = Buffer.from(await result.arrayBuffer());
        return writeBinaryResult(buffer, options.outputPath);
    }

    if (seen.has(result)) return '[Circular]';
    seen.add(result);

    if (Array.isArray(result)) {
        const output = [];
        for (const item of result) output.push(await normalizeResultInternal(item, options, seen));
        return output;
    }

    const output = {};
    for (const [key, value] of Object.entries(result)) {
        if (/^(?:ndus|password|passwd|pwd|token|jsToken|bdstoken|csrf|cookie)$/i.test(key)) {
            output[key] = typeof value === 'string' ? maskToken(value) : '[redacted]';
        } else {
            output[key] = await normalizeResultInternal(value, options, seen);
        }
    }
    return output;
}

export async function normalizeResult(result, options = {}) {
    return normalizeResultInternal(result, {
        outputPath: options.outputPath || null,
        inlineBinaryLimit: options.inlineBinaryLimit ?? 256 * 1024,
        includeStack: options.includeStack === true,
    }, new WeakSet());
}

export async function invokeTeraBoxMethod(client, method, args = [], options = {}) {
    if (typeof method !== 'string' || !method || method === 'constructor' || method.startsWith('_')) {
        throw new Error('A public TeraBox method name is required.');
    }
    const methods = listPublicMethods(client);
    if (!methods.includes(method) || typeof client[method] !== 'function') {
        throw new Error(`Unknown public TeraBox method: ${method}`);
    }
    const materialized = await materializeArguments(args);
    return normalizeResult(await client[method](...materialized), options);
}

export async function getTeraBoxStatus(options = {}) {
    const ndus = options.ndus || await getStoredNdus();
    if (!ndus) return { configured: false, authenticated: false };
    const client = await createTeraBoxClient({ ...options, ndus });
    const methods = listPublicMethods(client);
    const login = methods.includes('checkLogin') ? await client.checkLogin() : null;
    let quota = null;
    for (const candidate of ['getQuota', 'quota', 'getUserInfo', 'getAccountInfo']) {
        if (!methods.includes(candidate)) continue;
        try {
            quota = await client[candidate]();
            break;
        } catch {
            // Keep the login result even when a secondary endpoint has changed.
        }
    }
    return normalizeResult({
        configured: true,
        authenticated: Boolean(login && (login.errno === 0 || login.code === 0)),
        login,
        quota,
        endpoint: client.params?.whost,
        account_id: client.params?.account_id,
        method_count: methods.length,
    });
}
