#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createTeraBoxMcpServer } from './server.js';

serveStdio(createTeraBoxMcpServer, {
    onerror(error) {
        console.error('TeraBox-SIN MCP error:', error);
    },
});
console.error('TeraBox-SIN MCP server running on stdio');
