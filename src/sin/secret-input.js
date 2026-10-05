/**
 * Hidden secret input for interactive terminals.
 *
 * Linux fallback for the macOS hidden AppleScript dialog: reads a password
 * without echoing keystrokes by switching the TTY into raw mode. Piped stdin
 * is returned trimmed without touching echo controls. Test-only fakes are
 * injected via options; this module never touches real secrets by itself.
 *
 * @param {string} prompt Text written before reading.
 * @param {object} [options] Overrides for testing.
 * @param {object} [options.stdin] Defaults to process.stdin.
 * @param {object} [options.stdout] Defaults to process.stdout.
 * @returns {Promise<string>} Trimmed secret value.
 */
export async function readHiddenInput(prompt = '', options = {}) {
    const stdin = options.stdin || process.stdin;
    const stdout = options.stdout || process.stdout;

    if (!stdin.isTTY) {
        const chunks = [];
        for await (const chunk of stdin) chunks.push(chunk);
        return Buffer.concat(chunks).toString('utf8').trim();
    }

    if (typeof prompt === 'string' && prompt) stdout.write(prompt);

    return new Promise((resolve, reject) => {
        let value = '';
        let settled = false;

        const cleanup = () => {
            stdin.removeListener('data', onData);
            try {
                if (typeof stdin.setRawMode === 'function') stdin.setRawMode(false);
            } catch {
                // Restoring raw mode must not mask the result.
            }
            try {
                if (typeof stdin.pause === 'function') stdin.pause();
            } catch {
                // Ignore pause errors on fake streams.
            }
        };

        const finish = (result) => {
            if (settled) return;
            settled = true;
            cleanup();
            stdout.write('\n');
            resolve(result);
        };

        const cancel = (error) => {
            if (settled) return;
            settled = true;
            cleanup();
            stdout.write('\n');
            reject(error);
        };

        function onData(chunk) {
            const text = String(chunk);
            for (const char of text) {
                if (char === '\r' || char === '\n' || char === '\u0004') {
                    finish(value);
                    return;
                }
                if (char === '\u0003') {
                    cancel(new Error('Input cancelled.'));
                    return;
                }
                if (char === '\u007f' || char === '\b') {
                    value = value.slice(0, -1);
                    continue;
                }
                // Skip other control characters; keep visible input hidden.
                if (char < ' ' && char !== '\t') continue;
                value += char;
            }
        }

        try {
            if (typeof stdin.setEncoding === 'function') stdin.setEncoding('utf8');
            if (typeof stdin.setRawMode === 'function') stdin.setRawMode(true);
            if (typeof stdin.resume === 'function') stdin.resume();
        } catch (error) {
            cancel(error);
            return;
        }
        stdin.on('data', onData);
    });
}
