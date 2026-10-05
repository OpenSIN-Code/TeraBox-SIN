import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function defaultExec(file, args, options) {
    return execFileAsync(file, args, options);
}

function resolvePlatform(options = {}) {
    return options.platform || process.platform;
}

function resolveExec(options = {}) {
    return options.exec || defaultExec;
}

export const KEYCHAIN_SERVICE = process.env.TERABOX_SIN_KEYCHAIN_SERVICE || 'TeraBox-SIN';
export const KEYCHAIN_ACCOUNT = process.env.TERABOX_SIN_KEYCHAIN_ACCOUNT || 'ndus';

function assertToken(token) {
    if (typeof token !== 'string' || token.trim().length < 8) {
        throw new Error('Invalid TeraBox NDUS token.');
    }
    if (/\s/.test(token)) {
        throw new Error('Invalid TeraBox NDUS token: whitespace is not allowed.');
    }
    return token.trim();
}

export async function secretServiceAvailable(options = {}) {
    const exec = resolveExec(options);
    try {
        await exec('secret-tool', ['--help'], { timeout: 5000 });
    } catch {
        return false;
    }
    try {
        await exec('secret-tool', ['lookup', 'service', KEYCHAIN_SERVICE, 'account', '__sin_health_probe__'], { timeout: 5000 });
        return true;
    } catch (error) {
        // Exit code 1 means the service answered but no probe item exists.
        // D-Bus/service failures and timeouts indicate that it is not ready.
        const detail = `${error?.message || ''} ${error?.stderr || ''} ${error?.stdout || ''}`;
        if (error?.code === 1 && !/ServiceUnknown|NoReply|timed? out|cannot autolaunch/i.test(detail)) return true;
        return false;
    }
}

export async function secretToolAvailable(options = {}) {
    const exec = resolveExec(options);
    try {
        await exec('secret-tool', ['--help'], { timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

function storeSecretWithStdin(token, options = {}) {
    if (options.exec) {
        return options.exec('secret-tool', [
            'store', '--label', `${KEYCHAIN_SERVICE} ${KEYCHAIN_ACCOUNT}`,
            'service', KEYCHAIN_SERVICE, 'account', KEYCHAIN_ACCOUNT,
        ], { timeout: 10000, maxBuffer: 1024 * 1024, stdin: token });
    }

    return new Promise((resolve, reject) => {
        const child = (options.spawn || spawn)('secret-tool', [
            'store', '--label', `${KEYCHAIN_SERVICE} ${KEYCHAIN_ACCOUNT}`,
            'service', KEYCHAIN_SERVICE, 'account', KEYCHAIN_ACCOUNT,
        ], { stdio: ['pipe', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
            child.kill('SIGTERM');
            reject(new Error('Secret Service store timed out.'));
        }, 10000);
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk) => { stdout += chunk; });
        child.stderr.on('data', (chunk) => { stderr += chunk; });
        child.once('error', (error) => {
            clearTimeout(timer);
            reject(new Error('Failed to start secret-tool.', { cause: error }));
        });
        child.once('close', (code, signal) => {
            clearTimeout(timer);
            if (code === 0) resolve({ stdout, stderr });
            else reject(Object.assign(new Error('Secret Service store failed.'), { code, signal, stderr }));
        });
        child.stdin.end(`${token}\n`);
    });
}

export async function keychainAvailable(options = {}) {
    const platform = resolvePlatform(options);
    if (platform === 'darwin') {
        const exec = resolveExec(options);
        const probe = exec === defaultExec
            ? execFileAsync('/usr/bin/security', ['help'], { timeout: 5000 })
            : exec('/usr/bin/security', ['help'], { timeout: 5000 });
        try {
            await probe;
            return true;
        } catch {
            return false;
        }
    }
    if (platform === 'linux') {
        return secretServiceAvailable(options);
    }
    if (process.platform !== 'darwin') return false;
    try {
        await execFileAsync('/usr/bin/security', ['help'], { timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

function isSecretServiceMissing(error) {
    if (!error) return false;
    if (error.code === 1) return true;
    const text = `${error.stderr || ''} ${error.stdout || ''} ${error.message || ''}`;
    return /no .* found|not found|no secret|no matching/i.test(text);
}

export async function getStoredNdus(options = {}) {
    if (process.env.TERABOX_NDUS) return assertToken(process.env.TERABOX_NDUS);
    const platform = resolvePlatform(options);
    if (platform === 'darwin') {
        const exec = resolveExec(options);
        try {
            const { stdout } = exec === defaultExec
                ? await execFileAsync('/usr/bin/security', [
                    'find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT, '-w',
                ], { timeout: 10000, maxBuffer: 1024 * 1024 })
                : await exec('/usr/bin/security', [
                    'find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT, '-w',
                ], { timeout: 10000, maxBuffer: 1024 * 1024 });
            const token = String(stdout || '').trim();
            return token ? assertToken(token) : null;
        } catch (error) {
            if (error?.code === 44 || /could not be found/i.test(error?.stderr || '')) return null;
            throw new Error('Failed to read TeraBox session from macOS Keychain.', { cause: error });
        }
    }
    if (platform === 'linux') {
        const exec = resolveExec(options);
        try {
            const { stdout } = await exec('secret-tool', [
                'lookup', 'service', KEYCHAIN_SERVICE, 'account', KEYCHAIN_ACCOUNT,
            ], { timeout: 10000, maxBuffer: 1024 * 1024 });
            const token = String(stdout || '').trim();
            return token ? assertToken(token) : null;
        } catch (error) {
            if (isSecretServiceMissing(error)) return null;
            throw new Error('Failed to read TeraBox session from Secret Service.', { cause: error });
        }
    }
    if (process.platform !== 'darwin') return null;
    try {
        const { stdout } = await execFileAsync('/usr/bin/security', [
            'find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT, '-w',
        ], { timeout: 10000, maxBuffer: 1024 * 1024 });
        const token = stdout.trim();
        return token ? assertToken(token) : null;
    } catch (error) {
        if (error?.code === 44 || /could not be found/i.test(error?.stderr || '')) return null;
        throw new Error('Failed to read TeraBox session from macOS Keychain.', { cause: error });
    }
}

export async function storeNdus(token, options = {}) {
    token = assertToken(token);
    const platform = resolvePlatform(options);
    if (platform === 'darwin') {
        const exec = resolveExec(options);
        if (exec === defaultExec) {
            await execFileAsync('/usr/bin/security', [
                'add-generic-password', '-U', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT, '-w', token,
            ], { timeout: 10000, maxBuffer: 1024 * 1024 });
        } else {
            await exec('/usr/bin/security', [
                'add-generic-password', '-U', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT, '-w', token,
            ], { timeout: 10000, maxBuffer: 1024 * 1024 });
        }
        return { service: KEYCHAIN_SERVICE, account: KEYCHAIN_ACCOUNT, stored: true };
    }
    if (platform === 'linux') {
        await storeSecretWithStdin(token, options);
        return { service: KEYCHAIN_SERVICE, account: KEYCHAIN_ACCOUNT, stored: true };
    }
    if (process.platform !== 'darwin') {
        throw new Error('Automatic secure session storage currently requires macOS Keychain.');
    }
    await execFileAsync('/usr/bin/security', [
        'add-generic-password', '-U', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT, '-w', token,
    ], { timeout: 10000, maxBuffer: 1024 * 1024 });
    return { service: KEYCHAIN_SERVICE, account: KEYCHAIN_ACCOUNT, stored: true };
}

export async function deleteStoredNdus(options = {}) {
    const platform = resolvePlatform(options);
    if (platform === 'darwin') {
        const exec = resolveExec(options);
        try {
            if (exec === defaultExec) {
                await execFileAsync('/usr/bin/security', [
                    'delete-generic-password', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT,
                ], { timeout: 10000, maxBuffer: 1024 * 1024 });
            } else {
                await exec('/usr/bin/security', [
                    'delete-generic-password', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT,
                ], { timeout: 10000, maxBuffer: 1024 * 1024 });
            }
            return { deleted: true };
        } catch (error) {
            if (error?.code === 44 || /could not be found/i.test(error?.stderr || '')) {
                return { deleted: false, reason: 'not-found' };
            }
            throw new Error('Failed to delete TeraBox session from macOS Keychain.', { cause: error });
        }
    }
    if (platform === 'linux') {
        const exec = resolveExec(options);
        try {
            await exec('secret-tool', [
                'clear', 'service', KEYCHAIN_SERVICE, 'account', KEYCHAIN_ACCOUNT,
            ], { timeout: 10000, maxBuffer: 1024 * 1024 });
            return { deleted: true };
        } catch (error) {
            if (isSecretServiceMissing(error)) return { deleted: false, reason: 'not-found' };
            throw new Error('Failed to delete TeraBox session from Secret Service.', { cause: error });
        }
    }
    if (process.platform !== 'darwin') return { deleted: false, reason: 'not-macos' };
    try {
        await execFileAsync('/usr/bin/security', [
            'delete-generic-password', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT,
        ], { timeout: 10000, maxBuffer: 1024 * 1024 });
        return { deleted: true };
    } catch (error) {
        if (error?.code === 44 || /could not be found/i.test(error?.stderr || '')) {
            return { deleted: false, reason: 'not-found' };
        }
        throw new Error('Failed to delete TeraBox session from macOS Keychain.', { cause: error });
    }
}

const SENSITIVE_KEY_PATTERN = /ndus|password|passwd|pwd|token|secret|cookie|csrf/i;

function maskSensitiveValue(value) {
    if (typeof value === 'string') {
        if (!value) return value;
        return maskToken(value);
    }
    if (value === null || value === undefined) return value;
    return '[redacted]';
}

function sanitizeDeep(value) {
    if (Array.isArray(value)) return value.map((entry) => sanitizeDeep(entry));
    if (value && typeof value === 'object') {
        const output = {};
        for (const [key, nested] of Object.entries(value)) {
            if (SENSITIVE_KEY_PATTERN.test(key)) {
                output[key] = maskSensitiveValue(nested);
            } else {
                output[key] = sanitizeDeep(nested);
            }
        }
        return output;
    }
    return value;
}

/**
 * Return a copy of a login result with NDUS/password fields masked.
 * Never mutates the input; null stays null so missing sessions are safe.
 */
export function sanitizeLoginResult(result) {
    if (result === null || result === undefined) return null;
    if (typeof result !== 'object') return result;
    return sanitizeDeep(result);
}

export function maskToken(token) {
    if (!token) return null;
    if (token.length <= 8) return '*'.repeat(token.length);
    return `${token.slice(0, 4)}…${token.slice(-4)}`;
}
