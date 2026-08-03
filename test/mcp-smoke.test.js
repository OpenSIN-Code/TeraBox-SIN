import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

import { createTeraBoxClient, listPublicMethods } from '../src/sin/client.js';

test('stdio MCP server exposes every upstream method plus generic tools', { timeout: 30000 }, async () => {
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: ['src/sin/stdio.js'],
        cwd: process.cwd(),
        stderr: 'pipe',
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
        assert.ok(names.has('terabox_checkLogin'));
    } catch (error) {
        error.message += `\nserver stderr:\n${stderr.join('')}`;
        throw error;
    } finally {
        await client.close();
    }
});
