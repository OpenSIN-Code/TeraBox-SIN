# ChatGPT Web connection

TeraBox-SIN exposes a local stdio MCP server:

```bash
/Users/jeremy/dev/TeraBox-SIN/bin/terabox-sin-mcp
```

The supported private connection path is OpenAI Secure MCP Tunnel. The official
`tunnel-client` spawns this stdio command and keeps the TeraBox server off the
public internet.

Required runtime variables are intentionally not stored in this repository:

```bash
export CONTROL_PLANE_TUNNEL_ID='tunnel_...'
export CONTROL_PLANE_API_KEY='...'
./scripts/tunnel-client.sh
```

When the tunnel is healthy, add the tunnel's MCP endpoint in ChatGPT Settings →
Apps/Connectors → Developer mode/custom app. Availability and write-action
confirmation depend on the ChatGPT workspace plan and administrator settings.

Do not expose the local stdio process, the NDUS token, Chrome CDP, or macOS
Keychain over a public endpoint.
