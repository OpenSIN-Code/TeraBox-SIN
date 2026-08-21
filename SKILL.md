---
name: terabox-sin
description: >
  Use TeraBox through the TeraBox-SIN CLI/MCP client or the optional persistent
  browser workflow. Discover and call the installed TeraBoxApp method surface;
  list, search, inspect, download, upload, create, copy, move, rename, delete,
  restore, share, transfer, manage remote uploads and use cloud-download
  operations when supported by the installed client. Use for TeraBox files,
  folders, quota, shares, uploads/downloads and account status.
license: MIT
compatibility:
  - chatgpt
  - claude-code
  - codex
  - opencode
  - mimo-code
  - jcode
  - cline
  - orca
metadata:
  author: Delqhi/SIN
  category: cloud-storage
  lifecycle: bundled
  version: "3.0.0-sin.3"
  updated: "2026-08-21"
---

# TeraBox-SIN

Use TeraBox-SIN for TeraBox Storage Cloud operations. Prefer the MCP server or CLI for structured operations. Use the separate browser automation only when a normal logged-in web workflow is specifically needed or the inherited API path is unsuitable.

## Authentication boundary

The core CLI/MCP client authenticates with an **NDUS session**. It is read from, in priority order:

1. `TERABOX_NDUS` in the process environment.
2. macOS Keychain service `TeraBox-SIN`, account `ndus`.

Never print, log, commit, paste, summarize or return the complete NDUS value. Treat browser cookies, OAuth tokens, passwords and persistent browser profiles the same way.

Use these commands for authentication state:

```bash
terabox-sin session status
terabox-sin doctor
terabox-sin status
```

To configure authentication interactively on macOS:

```bash
terabox-sin login user@example.com
# or
terabox-sin session set
```

`session set` and `login` use native dialogs in an interactive macOS terminal. Controlled non-interactive input is supported where the CLI implementation permits it.

## Required agent workflow

1. Start with `terabox_status` or `terabox-sin status` when authentication/state matters.
2. Call `terabox_methods` or `terabox-sin methods` before relying on an unfamiliar method name or signature.
3. Prefer a direct `terabox_<method>` tool when the method is known.
4. Use `terabox_call` for generic or forward-compatible access.
5. Supply positional arguments exactly as required by the installed upstream method.
6. Use an explicit `output_path` for downloads or other binary/streaming results when the destination matters.
7. Before destructive or account-changing operations, verify the target and user intent. MCP annotations are heuristics, not authorization guarantees.
8. After a mutation, verify the resulting remote state when practical.

## MCP tools

- `terabox_status` — local configuration, login state, endpoint and quota when available.
- `terabox_session_status` — reports session presence and masked metadata; never returns the full NDUS value.
- `terabox_methods` — discovers public methods from the installed `TeraBoxApp` implementation.
- `terabox_call` — invokes any discovered public method using positional `args`.
- `terabox_<method>` — generated direct wrapper for each discovered public method.

The method set is generated at server startup. Do not assume that a documentation list is more authoritative than `terabox_methods` for the currently installed version.

## Generic MCP call shape

```json
{
  "method": "getRemoteDir",
  "args": ["/"]
}
```

Direct wrappers accept:

```json
{
  "args": ["/"],
  "output_path": "/absolute/path/when-needed"
}
```

## Local-value adapters

TeraBox-SIN materializes the following special JSON values before calling an upstream method:

```json
{"$file":"/absolute/path"}
{"$blob":"/absolute/path","type":"application/octet-stream"}
{"$stream":"/absolute/path"}
{"$json_file":"/absolute/path/data.json"}
{"$env":"VARIABLE_NAME"}
{"$abort_signal":true}
{"$progress":true}
```

Meaning:

- `$file` — reads a local file into a `Buffer`.
- `$blob` — reads a local file into a `Blob`; optional `type` sets its MIME type.
- `$stream` — opens a local readable stream.
- `$json_file` — reads and parses a local JSON file.
- `$env` — substitutes an environment-variable value.
- `$abort_signal` — creates a new abort signal.
- `$progress` — creates a progress callback that emits structured progress events on stderr.

Adapters can appear recursively inside arrays and objects.

For MCP, local adapters are sandboxed. `$file`, `$blob`, `$stream`, `$json_file` and explicit `output_path` values require the target path to be within `TERABOX_SIN_ALLOWED_ROOTS`. If that variable is empty, those local accesses are denied. `$env` requires the variable name to appear in the comma-separated `TERABOX_SIN_ALLOWED_ENV` allowlist. Do not broaden either allowlist merely to make a failing agent call succeed.

## Binary and streaming results

Small binary results may be returned inline as base64. Larger binary results, streams and response-like bodies are written to disk.

If `output_path` is supplied, TeraBox-SIN uses it. Otherwise automatic files are written beneath:

```text
~/.cache/terabox-sin/results
```

Prefer an explicit output path when the user expects a particular file location.

## CLI reference

```bash
terabox-sin doctor
terabox-sin status
terabox-sin methods
terabox-sin call checkLogin '[]'
terabox-sin call getRemoteDir '["/"]'
terabox-sin call search '["invoice"]'
terabox-sin call METHOD @args.json
terabox-sin call METHOD '[...]' --output /absolute/path
terabox-sin session status
terabox-sin session set
terabox-sin session delete
terabox-sin login user@example.com
terabox-sin mcp
```

## Mutation safety

The MCP server uses conservative name-based classification. Known reads such as `checkLogin`, list/search/get methods and `shareList` are marked read-only; ambiguous generic methods such as `doReq` and `filemanager` are treated as potentially destructive. These annotations remain UX hints rather than authorization.

Therefore:

- inspect the actual operation, not only the annotation;
- confirm remote paths/file IDs before delete, clear, overwrite, move or share changes;
- do not infer permission from the presence of an MCP tool;
- verify important mutations after execution.

## Browser automation mode

The optional browser workflow lives in `browser-automation/` and is separate from the NDUS/MCP client.

Use it when the task specifically requires the TeraBox web UI or when a supported API operation is unavailable/unreliable. The browser uses a dedicated persistent Chrome profile and a local CDP endpoint. It must not export authentication material into prompts, logs or source files.

Typical workflow:

```bash
cd browser-automation
npm install
npm run start
# user completes normal TeraBox login once if needed
npm run status
```

Then use the supported browser primitives:

```bash
terabox-sin browser root
terabox-sin browser open "Folder name"
terabox-sin browser mkdir "Folder name"
terabox-sin browser upload /absolute/path/to/file
terabox-sin browser snapshot
```

For durable mirrors, keep the browser/API client deliberately dumb: the consuming repository owns the manifest, hashes and pending queue; TeraBox-SIN only navigates, uploads and verifies visible remote state. A higher-level mirror should therefore:

1. hash local source files (SHA-256 or stronger);
2. skip files already recorded as remotely verified;
3. return to `All Files`, enter the dedicated remote folder, and upload only pending files;
4. verify the uploaded filename/remote listing before marking it mirrored;
5. persist the manifest in the consuming system, never inside the browser profile;
6. leave failures pending and resumable instead of silently declaring success.

This is the canonical pattern used by the Personal Life Record mirror. It avoids cookie export, avoids a second storage database, and keeps TeraBox as a file mirror rather than a source of truth.

## Official Open API distinction

TeraBox publishes a separate official Open Platform that uses OAuth access tokens and application credentials. The current TeraBox-SIN core runtime does **not** use that OAuth flow; it inherits web/PCS-style behavior from `seiya-npm/terabox-api` and authenticates with NDUS.

Do not mix official Open API `access_token` examples with TeraBox-SIN NDUS configuration.

## Failure handling

If an operation fails:

1. Run `terabox-sin doctor`.
2. Run `terabox-sin status`.
3. Re-run `terabox-sin methods` to confirm the method still exists.
4. Verify argument order against `api.js` or generated API docs.
5. Assume upstream TeraBox endpoint changes are possible before assuming local credentials are wrong.
6. Use the browser workflow only when it is appropriate for the requested operation, not as an automatic credential-extraction fallback.
