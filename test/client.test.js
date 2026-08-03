import test from 'node:test';
import assert from 'node:assert/strict';

import { describePublicMethods, isLikelyMutating, listPublicMethods, materializeArguments } from '../src/sin/client.js';
import { maskToken } from '../src/sin/keychain.js';

class Parent {
    inherited() {}
}
class Example extends Parent {
    read() {}
    upload() {}
    _private() {}
}

test('discovers inherited public methods without private methods', () => {
    const methods = listPublicMethods(new Example());
    assert.deepEqual(methods, ['inherited', 'read', 'upload']);
    assert.equal(describePublicMethods(new Example()).find((entry) => entry.name === 'upload').mutating, true);
});

test('classifies common writes without disabling them', () => {
    assert.equal(isLikelyMutating('uploadFile'), true);
    assert.equal(isLikelyMutating('deleteShare'), true);
    assert.equal(isLikelyMutating('getRemoteDir'), false);
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
