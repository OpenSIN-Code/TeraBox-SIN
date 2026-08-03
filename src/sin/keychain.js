import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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

export async function keychainAvailable() {
    if (process.platform !== 'darwin') return false;
    try {
        await execFileAsync('/usr/bin/security', ['help'], { timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

export async function getStoredNdus() {
    if (process.env.TERABOX_NDUS) return assertToken(process.env.TERABOX_NDUS);
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

export async function storeNdus(token) {
    token = assertToken(token);
    if (process.platform !== 'darwin') {
        throw new Error('Automatic secure session storage currently requires macOS Keychain.');
    }
    await execFileAsync('/usr/bin/security', [
        'add-generic-password', '-U', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT, '-w', token,
    ], { timeout: 10000, maxBuffer: 1024 * 1024 });
    return { service: KEYCHAIN_SERVICE, account: KEYCHAIN_ACCOUNT, stored: true };
}

export async function deleteStoredNdus() {
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

export function maskToken(token) {
    if (!token) return null;
    if (token.length <= 8) return '*'.repeat(token.length);
    return `${token.slice(0, 4)}…${token.slice(-4)}`;
}
