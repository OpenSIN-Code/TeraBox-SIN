import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
    describePublicMethods,
    isLikelyMutating,
    listPublicMethods,
    materializeArguments,
    normalizeResult,
} from '../src/sin/client.js';
import { maskToken } from '../src/sin/keychain.js';

class Parent {
    inherited() {}
}
class Example extends Parent {
    read() {}
    withDefaults(required, optional = true, third = null) {}
    upload() {}
    _private() {}
}

test('discovers inherited public methods without private methods', () => {
    const methods = listPublicMethods(new Example());
    assert.deepEqual(methods, ['inherited', 'read', 'upload', 'withDefaults']);
    const described = describePublicMethods(new Example());
    assert.equal(described.find((entry) => entry.name === 'upload').mutating, true);
    assert.equal(described.find((entry) => entry.name === 'withDefaults').arity, 3);
    assert.equal(described.find((entry) => entry.name === 'withDefaults').required_arity, 1);
});

test('classifies common writes without disabling them', () => {
    assert.equal(isLikelyMutating('uploadFile'), true);
    assert.equal(isLikelyMutating('deleteShare'), true);
    assert.equal(isLikelyMutating('getRemoteDir'), false);
    assert.equal(isLikelyMutating('checkLogin'), false);
    assert.equal(isLikelyMutating('shareList'), false);
    assert.equal(isLikelyMutating('clouddl_query_task'), false);
    assert.equal(isLikelyMutating('clouddl_tasklist'), false);
    assert.equal(isLikelyMutating('filemanager'), true);
    assert.equal(isLikelyMutating('doReq'), true);
});

test('masks session tokens', () => {
    assert.equal(maskToken('1234567890abcdef'), '1234…cdef');
    assert.equal(maskToken(null), null);
});

test('materializes environment arguments', async () => {
    process.env.TERABOX_SIN_TEST_VALUE = 'works';
    const values = await materializeArguments([{ $env: 'TERABOX_SIN_TEST_VALUE' }]);
    assert.deepEqual(values, ['works']);
});


test('blocks environment adapters when an allowlist is supplied', async () => {
    process.env.TERABOX_SIN_TEST_SECRET = 'do-not-return';
    await assert.rejects(
        materializeArguments([{ $env: 'TERABOX_SIN_TEST_SECRET' }], { allowedEnv: new Set() }),
        /not allowed/,
    );
    const values = await materializeArguments(
        [{ $env: 'TERABOX_SIN_TEST_SECRET' }],
        { allowedEnv: new Set(['TERABOX_SIN_TEST_SECRET']) },
    );
    assert.deepEqual(values, ['do-not-return']);
});

test('enforces local path allowlists for MCP-style adapters and outputs', async () => {
    await assert.rejects(
        materializeArguments([{ $file: 'package.json' }], { allowedRoots: ['/tmp/terabox-sin-denied'] }),
        /outside TERABOX_SIN_ALLOWED_ROOTS/,
    );
    const [buffer] = await materializeArguments([{ $file: 'package.json' }], { allowedRoots: [process.cwd()] });
    assert.ok(Buffer.isBuffer(buffer));
    await assert.rejects(
        normalizeResult(Buffer.from('blocked'), {
            outputPath: '/tmp/terabox-sin-denied-output.bin',
            allowedRoots: [process.cwd()],
        }),
        /outside TERABOX_SIN_ALLOWED_ROOTS/,
    );
});

test('blocks symlink escapes from allowed filesystem roots', async () => {
    const allowedRoot = await mkdtemp(join(tmpdir(), 'terabox-sin-allowed-'));
    const outsideRoot = await mkdtemp(join(tmpdir(), 'terabox-sin-outside-'));
    try {
        const outsideFile = join(outsideRoot, 'secret.txt');
        const link = join(allowedRoot, 'link.txt');
        await writeFile(outsideFile, 'secret');
        await symlink(outsideFile, link);
        await assert.rejects(
            materializeArguments([{ $file: link }], { allowedRoots: [allowedRoot] }),
            /outside TERABOX_SIN_ALLOWED_ROOTS/,
        );
    } finally {
        await rm(allowedRoot, { recursive: true, force: true });
        await rm(outsideRoot, { recursive: true, force: true });
    }
});

test('redacts extended token and secret field names', async () => {
    const normalized = await normalizeResult({
        pcftoken: '1234567890abcdef',
        access_token: 'abcdefghijklmnop',
        client_secret: 'qrstuvwxyz123456',
    });
    assert.equal(normalized.pcftoken, '1234…cdef');
    assert.equal(normalized.access_token, 'abcd…mnop');
    assert.equal(normalized.client_secret, 'qrst…3456');
});
