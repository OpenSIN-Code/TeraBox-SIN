# ChatGPT Web connection

TeraBox-SIN exposes a local stdio MCP server. ChatGPT does **not** connect directly to a local stdio process, so a supported remote/private-network bridge is required.

## Local MCP command

After installing/linking the package, either of these starts the same stdio server:

```bash
terabox-sin mcp
# or
terabox-sin-mcp
```

When running directly from a repository checkout:

```bash
node src/sin/stdio.js
```

Do not hard-code a developer-specific absolute repository path into ChatGPT configuration.

## Secure MCP Tunnel

OpenAI documents Secure MCP Tunnel as the supported way to connect a local/private MCP server to supported OpenAI products without exposing the MCP server directly to the public internet.

This repository includes `scripts/tunnel-client.sh`, which expects the official `tunnel-client` binary plus runtime credentials supplied outside the repository:

```bash
export CONTROL_PLANE_TUNNEL_ID='tunnel_...'
export CONTROL_PLANE_API_KEY='...'
./scripts/tunnel-client.sh
```

The script launches the local TeraBox-SIN stdio server behind the tunnel and binds its health listener to loopback.

Never commit the control-plane API key or tunnel credentials.

## ChatGPT configuration

ChatGPT's app/developer-mode UI and plan availability can change. Use the current OpenAI documentation for the exact workspace steps.

At a high level:

1. Ensure custom MCP apps/developer mode is available and enabled for the relevant ChatGPT account/workspace.
2. Start and verify the Secure MCP Tunnel.
3. Add/configure the resulting remote MCP app in ChatGPT under the current Apps/developer-mode settings.
4. Review the discovered TeraBox-SIN tools before enabling write/modify actions.
5. Refresh/re-publish the app when tool definitions change if the workspace uses an approved/frozen tool snapshot.

Current OpenAI documentation:

- https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta
- https://help.openai.com/en/articles/11487775-apps-in-chatgpt

## Capability caveat

A healthy tunnel only proves transport connectivity. Whether ChatGPT can use read, fetch, write or modify tools depends on the current ChatGPT plan, workspace controls, developer-mode configuration and app permissions.

TeraBox-SIN therefore does not assume that every MCP tool exposed by the server is callable from every ChatGPT account.

## Security model

Keep these components private:

- NDUS session
- macOS Keychain contents
- TeraBox passwords
- OAuth tokens
- Chrome persistent profiles
- Chrome CDP endpoints
- Secure MCP Tunnel control-plane credentials

Do not expose the local stdio server or Chrome CDP directly to the public internet.

The optional `browser-automation/` workflow is a separate local browser integration. It is **not** automatically proxied through the root TeraBox-SIN MCP server.
