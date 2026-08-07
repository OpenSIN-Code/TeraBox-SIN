import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

import { createTeraBoxClient, listPublicMethods } from '../src/sin/client.js';

test('stdio MCP server exposes every upstream method plus generic tools', { timeout: 30000 }, async () => {
    const testEnv = { ...process.env, TERABOX_SIN_KEYCHAIN_SERVICE: `TeraBox-SIN-Test-${process.pid}` };
    delete testEnv.TERABOX_NDUS;
    delete testEnv.TERABOX_SIN_ALLOWED_ROOTS;
    delete testEnv.TERABOX_SIN_ALLOWED_ENV;
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: ['src/sin/stdio.js'],
        cwd: process.cwd(),
        stderr: 'pipe',
        env: testEnv,
    });
    const stderr = [];
    transport.stderr?.on('data', (chunk) => stderr.push(chunk.toString()));
    const client = new Client({ name: 'terabox-sin-smoke', version: '1.0.0' });

    try {
        await client.connect(transport);
        const { tools } = await client.listTools();
        const names = new Set(tools.map((tool) => tool.name));
        const upstreamMethods = listPublicMethods(await createTeraBoxClient({ requireAuth: false }));

        assert.equal(tools.length, upstreamMethods.length + 4);
        for (const method of upstreamMethods) assert.ok(names.has(`terabox_${method}`));
        assert.ok(names.has('terabox_call'));
        assert.ok(names.has('terabox_methods'));
        assert.ok(names.has('terabox_status'));
        assert.ok(names.has('terabox_session_status'));
        assert.ok(names.has('terabox_checkLogin'));

        const methodsResult = await client.callTool({ name: 'terabox_methods', arguments: {} });
        assert.equal(methodsResult.isError, undefined);
        assert.ok(Array.isArray(methodsResult.structuredContent?.result));

        const byName = new Map(tools.map((tool) => [tool.name, tool]));
        assert.equal(byName.get('terabox_checkLogin')?.annotations?.readOnlyHint, true);
        assert.equal(byName.get('terabox_filemanager')?.annotations?.readOnlyHint, false);
        assert.equal(byName.get('terabox_filemanager')?.annotations?.destructiveHint, true);
        assert.equal(byName.get('terabox_doReq')?.annotations?.readOnlyHint, false);
        assert.equal(byName.get('terabox_doReq')?.annotations?.destructiveHint, true);
        assert.equal(byName.get('terabox_call')?.annotations?.destructiveHint, true);
    } catch (error) {
        error.message += `\nserver stderr:\n${stderr.join('')}`;
        throw error;
    } finally {
        await client.close();
    }
});
