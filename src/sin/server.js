import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import {
    createTeraBoxClient,
    describePublicMethods,
    getTeraBoxStatus,
    invokeTeraBoxMethod,
    isLikelyMutating,
    listPublicMethods,
} from './client.js';
import { getStoredNdus, keychainAvailable, maskToken } from './keychain.js';

const argsSchema = z.array(z.unknown()).default([]).describe(
    'Positional arguments for the upstream method. Special values: {$file:path}, {$blob:path,type?}, {$stream:path}, {$json_file:path}, {$env:name}, {$abort_signal:true}, {$progress:true}.',
);

function toolResult(result) {
    const wrapped = { result };
    return {
        content: [{ type: 'text', text: JSON.stringify(wrapped, null, 2) }],
        structuredContent: wrapped,
    };
}

function toolError(error) {
    const cause = error?.cause instanceof Error
        ? { name: error.cause.name, message: error.cause.message }
        : error?.cause;
    const payload = {
        error: {
            name: error?.name || 'Error',
            message: error?.message || String(error),
            cause,
        },
    };
    return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
    };
}

async function execute(handler) {
    try {
        return toolResult(await handler());
    } catch (error) {
        return toolError(error);
    }
}

export async function createTeraBoxMcpServer() {
    const server = new McpServer({
        name: 'TeraBox-SIN',
        version: '3.0.0-sin.1',
    });

    let clientPromise;
    const getClient = () => {
        clientPromise ||= createTeraBoxClient();
        return clientPromise;
    };

    const discoveryClient = await createTeraBoxClient({ requireAuth: false });
    const methods = listPublicMethods(discoveryClient);

    server.registerTool('terabox_status', {
        title: 'TeraBox account status',
        description: 'Check local session configuration, TeraBox login status, account endpoint and quota when available.',
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, () => execute(() => getTeraBoxStatus()));

    server.registerTool('terabox_session_status', {
        title: 'TeraBox session status',
        description: 'Report whether an NDUS session exists in environment or macOS Keychain. Never returns the full token.',
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, () => execute(async () => {
        const token = await getStoredNdus();
        return {
            configured: Boolean(token),
            masked: maskToken(token),
            keychain_available: await keychainAvailable(),
            source: process.env.TERABOX_NDUS ? 'environment' : token ? 'macos-keychain' : null,
        };
    }));

    server.registerTool('terabox_methods', {
        title: 'List every TeraBox method',
        description: 'Discover every public method exported by the installed TeraBox API implementation, including read and write operations.',
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, () => execute(async () => describePublicMethods(await getClient())));

    server.registerTool('terabox_call', {
        title: 'Call any TeraBox API method',
        description: 'Invoke any public method exposed by the installed upstream API. No method categories are omitted.',
        inputSchema: z.object({
            method: z.string().min(1),
            args: argsSchema,
            output_path: z.string().optional().describe('Optional local path for binary or streaming results.'),
        }),
    }, ({ method, args, output_path }) => execute(async () => {
        const client = await getClient();
        return invokeTeraBoxMethod(client, method, args, { outputPath: output_path });
    }));

    for (const method of methods) {
        const mutating = isLikelyMutating(method);
        server.registerTool(`terabox_${method}`, {
            title: `TeraBox ${method}`,
            description: `Direct wrapper for TeraBoxApp.${method}(...args). This is generated from the installed API at runtime.`,
            inputSchema: z.object({
                args: argsSchema,
                output_path: z.string().optional().describe('Optional local path for binary or streaming results.'),
            }),
            annotations: {
                readOnlyHint: !mutating,
                destructiveHint: /delete|remove|clear|recycle|cancel/i.test(method),
                idempotentHint: !mutating,
            },
        }, ({ args, output_path }) => execute(async () => {
            const client = await getClient();
            return invokeTeraBoxMethod(client, method, args, { outputPath: output_path });
        }));
    }

    return server;
}
