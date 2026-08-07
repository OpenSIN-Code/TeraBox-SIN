# TeraBox-SIN

TeraBox-SIN is a TeraBox client, CLI, MCP server, and optional browser-automation layer for local agents.

The repository has two distinct integration modes:

1. **API client / CLI / MCP** — the maintained `seiya-npm/terabox-api` codebase with SIN wrappers, authenticated with an NDUS session.
2. **Browser automation** — a separate raw-CDP workflow that keeps a normal TeraBox login inside a dedicated Chrome profile and does not export browser authentication data.

These modes are intentionally separate. The browser profile is never committed and is not required to use the CLI or MCP server.

## Features

### CLI and MCP

- Runtime discovery of every public `TeraBoxApp` method
- Direct MCP tools named `terabox_<method>`
- Forward-compatible generic `terabox_call`
- File listing, metadata, search, quota, download, upload, share, file-management, recycle-bin, remote-upload and cloud-download operations exposed by the installed client
- Local argument adapters for files, blobs, streams, JSON files, environment variables, abort signals and progress callbacks
- Binary/stream result materialization to disk
- macOS Keychain storage for the NDUS session
- Session redaction in normalized results
- CLI and stdio MCP entry points

### Browser automation

- Dedicated persistent Chrome profile
- Local-only Chrome DevTools Protocol endpoint
- Login/status verification
- Visible-page snapshots
- UI-driven upload and folder creation helpers
- No browser-cookie export in the repository workflow

See [`browser-automation/README.md`](browser-automation/README.md).

## Requirements

- Node.js 20 or newer
- npm
- macOS for Keychain-backed session storage and native login/session dialogs
- Google Chrome only for the optional browser-automation mode

The core client can run on other operating systems when `TERABOX_NDUS` is supplied at runtime, but automatic secure session persistence currently uses macOS Keychain.

## Install

```bash
git clone https://github.com/OpenSIN-Code/TeraBox-SIN.git
cd TeraBox-SIN
npm install
npm run check
npm link
```

After `npm link`, the following commands are available:

```bash
terabox-sin --help
terabox-sin-mcp
```

For the SIN/wow-my-zsh integration on macOS, use:

```bash
WOW_MY_ZSH_ROOT="$HOME/dev/wow-my-zsh" bash scripts/install-mac.sh
```

That installer also validates and regenerates the configured MCP registries. It is not required for a normal standalone install.

## Authentication

### Option 1: interactive TeraBox login

```bash
terabox-sin login user@example.com
```

On macOS, the password is requested in a hidden native dialog. If login succeeds and the upstream response contains an NDUS session, TeraBox-SIN stores it in macOS Keychain.

### Option 2: import an existing NDUS session

```bash
terabox-sin session set
```

Interactive macOS sessions use a hidden native dialog. Controlled non-interactive use can provide the value on stdin.

### Option 3: runtime environment variable

```bash
export TERABOX_NDUS='...'
terabox-sin status
```

Environment-based authentication is useful outside macOS, but the process environment must be protected like any other credential store.

Check local and remote state with:

```bash
terabox-sin session status
terabox-sin doctor
terabox-sin status
```

## CLI

Discover the installed method surface instead of assuming a fixed API version:

```bash
terabox-sin methods
```

Invoke a method with positional arguments encoded as a JSON array:

```bash
terabox-sin call checkLogin '[]'
terabox-sin call getRemoteDir '["/"]'
terabox-sin call search '["invoice"]'
```

Arguments can also be read from a JSON file:

```bash
terabox-sin call someMethod @args.json
```

For binary or streaming responses, choose an output file explicitly:

```bash
terabox-sin call download '[...]' --output ./download.bin
```

See [`SKILL.md`](SKILL.md) and [`docs/AGENT-USAGE.md`](docs/AGENT-USAGE.md) for the special local-value adapters and agent workflow.

## MCP

Start the stdio server with either command:

```bash
terabox-sin mcp
# or
terabox-sin-mcp
```

The server exposes:

- `terabox_status`
- `terabox_session_status`
- `terabox_methods`
- `terabox_call`
- one generated `terabox_<method>` tool for each public method discovered at startup

Tool annotations are conservative UX hints, not authorization. Ambiguous generic methods such as `doReq` and `filemanager` are treated as potentially destructive. `terabox_methods` is available without authentication so agents can discover the installed method surface before a session is configured.

## Browser automation

The browser workflow is intentionally isolated from the API/MCP package:

```bash
cd browser-automation
npm install
npm run start
```

Log in normally in the opened TeraBox window once. The dedicated profile persists locally. Then:

```bash
npm run status
npm run snapshot
npm run upload -- /absolute/path/to/file
npm run mkdir -- "Folder name"
```

Runtime state lives under `browser-automation/browser-profile`, `data`, and `downloads`; these paths are ignored by Git.

## Official TeraBox Open API vs. this project

TeraBox also publishes an official Open Platform using OAuth access tokens. As of August 2026, TeraBox states that applications must obtain `client_id`, `client_secret`, and `private_secret` in advance.

**TeraBox-SIN's current core runtime does not use that official OAuth flow.** The inherited client uses TeraBox web/PCS-style endpoints and an NDUS session. Those interfaces are unofficial from the perspective of the Open Platform and can change without notice.

See [`docs/TERABOX_API.md`](docs/TERABOX_API.md) for the distinction and migration notes.

## Security

Treat all TeraBox authentication material as account credentials.

- Never commit NDUS values, cookies, OAuth tokens, passwords or browser profiles.
- Never paste full credentials into issues, logs, prompts or chat messages.
- Keep Chrome CDP bound to `127.0.0.1`.
- Keep browser runtime directories ignored by Git.
- Prefer Keychain storage over plaintext files on macOS.
- Review destructive operations such as delete, clear, move, overwrite and share changes before execution.

Result normalization masks common token/secret fields, but redaction is defense-in-depth and must not be treated as proof that arbitrary upstream payloads contain no secrets.

### MCP local-access sandbox

MCP local-value adapters and explicit `output_path` writes are denied by default. Configure allowed filesystem roots explicitly with the platform path separator (`:` on macOS/Linux):

```bash
export TERABOX_SIN_ALLOWED_ROOTS="$HOME/Downloads:$HOME/Documents"
```

The `$env` adapter is also denied by default. Permit only named variables:

```bash
export TERABOX_SIN_ALLOWED_ENV="MY_SAFE_INPUT,ANOTHER_SAFE_INPUT"
```

These restrictions apply to MCP calls. Direct CLI use remains a local-user operation and can access paths supplied by that user.

## Stability

TeraBox-SIN wraps interfaces that may change independently of this repository. A successful local test does not guarantee long-term endpoint compatibility. Use:

```bash
npm run check
terabox-sin doctor
terabox-sin status
```

when diagnosing a failure, and use `terabox-sin methods` to inspect the currently installed method surface.

## Documentation

- [`SKILL.md`](SKILL.md) — agent skill contract and usage rules
- [`docs/AGENT-USAGE.md`](docs/AGENT-USAGE.md) — detailed MCP/CLI agent workflow
- [`docs/CHATGPT-WEB.md`](docs/CHATGPT-WEB.md) — ChatGPT Web / MCP tunnel notes
- [`docs/TERABOX_API.md`](docs/TERABOX_API.md) — official Open API vs. current runtime
- [`docs/DEV_NOTES.md`](docs/DEV_NOTES.md) — implementation and maintenance notes
- [`docs/UPSTREAM.md`](docs/UPSTREAM.md) — upstream relationship and sync procedure
- [`browser-automation/README.md`](browser-automation/README.md) — persistent browser workflow

## License and attribution

MIT. Original TeraBox API implementation by Seiya Dev.; SIN integration by Delqhi/SIN. See [`docs/UPSTREAM.md`](docs/UPSTREAM.md) and the Git history.
