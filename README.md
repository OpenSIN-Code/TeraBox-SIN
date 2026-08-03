# TeraBox-SIN

Full TeraBox Storage Cloud client, CLI and MCP app for ChatGPT and autonomous
agents. This project is a maintained fork of
[`seiya-npm/terabox-api`](https://github.com/seiya-npm/terabox-api) and keeps the
complete public API surface available.

## What it adds

- Dynamic MCP tools for every public `TeraBoxApp` method
- Universal forward-compatible `terabox_call`
- Complete read/write/upload/download/share/cloud-download access
- macOS Keychain-backed NDUS session storage
- Secure interactive login and session import
- CLI for humans and shell agents
- Native `wow-my-zsh` MCP registry and shared-skill integration
- OpenAI Secure MCP Tunnel launcher for ChatGPT Web

## Install on Mac-i9

```bash
cd /Users/jeremy/dev/TeraBox-SIN
bash scripts/install-mac.sh
terabox-sin doctor
```

Authenticate with either the TeraBox email login flow:

```bash
terabox-sin login user@example.com
```

or store an existing NDUS session in a hidden native dialog:

```bash
terabox-sin session set
```

## Full method access

```bash
terabox-sin methods
terabox-sin call checkLogin '[]'
terabox-sin call getRemoteDir '["/"]'
```

MCP clients receive `terabox_<method>` for every public method plus
`terabox_call`, `terabox_methods`, `terabox_status`, and
`terabox_session_status`. Methods are annotated for client UI, not removed.

See `SKILL.md`, `docs/AGENT-USAGE.md`, and `docs/CHATGPT-WEB.md`.

## Security

The TeraBox NDUS session is an account credential. TeraBox-SIN stores it in the
macOS Keychain and redacts known secret fields from returned objects. Never put
it in source control, shell history, logs, issues, or chat messages.

## License and attribution

MIT. Original TeraBox API implementation by Seiya Dev.; SIN integration by
Delqhi/SIN. See `docs/UPSTREAM.md` and the preserved Git history.
