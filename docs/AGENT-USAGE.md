# Agent usage

This document describes how an autonomous agent should use TeraBox-SIN without guessing method signatures or exposing authentication material.

## Choose the integration mode first

TeraBox-SIN has two separate execution paths:

- **CLI/MCP client:** structured calls into the inherited `TeraBoxApp` implementation, authenticated with NDUS.
- **Browser automation:** UI automation through a dedicated persistent Chrome profile under `browser-automation/`.

Prefer CLI/MCP for structured file operations. Use browser automation when the task explicitly requires the web interface or when the inherited API path does not support the required workflow reliably.

## Discovery-first workflow

The public method surface is discovered dynamically from the installed `TeraBoxApp` implementation.

For MCP:

1. Call `terabox_status` when account state matters.
2. Call `terabox_methods` before using an unfamiliar method.
3. Prefer `terabox_<method>` once the method is known.
4. Use `terabox_call` for generic access.

For CLI:

```bash
terabox-sin status
terabox-sin methods
```

Do not rely on a static method list when `terabox_methods` is available.

## Generic MCP examples

Read the root directory:

```json
{
  "method": "getRemoteDir",
  "args": ["/"]
}
```

Search:

```json
{
  "method": "search",
  "args": ["invoice"]
}
```

Check quota:

```json
{
  "method": "getQuota",
  "args": []
}
```

The corresponding direct wrapper uses the same positional arguments:

```json
{
  "args": ["/"]
}
```

for `terabox_getRemoteDir`.

## Positional arguments

`terabox_call` and every generated direct wrapper ultimately invoke:

```text
TeraBoxApp.method(...args)
```

Argument order is therefore significant. `terabox_methods` reports `arity` as the total declared parameter count and `required_arity` as JavaScript's required-parameter count before the first default value.

When uncertain, inspect `api.js` or the generated API documentation instead of guessing.

## Local-value adapters

Structured MCP/CLI arguments can represent local runtime values:

```json
{"$file":"/absolute/path"}
{"$blob":"/absolute/path","type":"application/octet-stream"}
{"$stream":"/absolute/path"}
{"$json_file":"/absolute/path/data.json"}
{"$env":"VARIABLE_NAME"}
{"$abort_signal":true}
{"$progress":true}
```

These values are recursively materialized immediately before the upstream method is called.

Typical uses:

- `$file` for an API expecting a `Buffer`.
- `$blob` for an API expecting browser-style binary data.
- `$stream` for stream-capable methods.
- `$json_file` for large structured argument objects.
- `$env` for controlled runtime substitution without embedding a value in the tool call.
- `$progress` for upstream methods that accept a progress callback.

For MCP calls these adapters are sandboxed: filesystem-backed adapters and explicit `output_path` values must stay inside `TERABOX_SIN_ALLOWED_ROOTS`, and `$env` names must be listed in `TERABOX_SIN_ALLOWED_ENV`. Both allowlists are empty/deny-by-default unless explicitly configured. Do not expand them merely to bypass a failed tool call.

Do not use `$env` to expose secrets in tool output. It only substitutes the value into the method call.

## Binary results

If a method returns binary or streaming data, use `output_path` whenever the target location matters:

```json
{
  "method": "download",
  "args": [[123456789]],
  "output_path": "/absolute/path/output.bin"
}
```

Small binary values may be normalized inline as base64. Larger values and streams are written under `~/.cache/terabox-sin/results` when no output path is provided.

## Mutations and destructive actions

Tool annotations are generated conservatively from method names. Known read operations are marked read-only, while ambiguous generic entry points such as `doReq`, `filemanager`, and `terabox_call` are treated as potentially destructive. Annotations are still not an authorization model.

Before operations such as delete, clear, overwrite, move, rename, restore, transfer or share changes:

1. Resolve the exact remote path/file ID/task ID.
2. Confirm the intended operation and scope.
3. Avoid broad or ambiguous targets.
4. Execute the smallest necessary mutation.
5. Re-read the relevant remote state to verify the result.

## Authentication handling

Never return or log the complete value of:

- NDUS sessions
- TeraBox passwords
- browser cookies
- OAuth access/refresh tokens
- Chrome profile authentication data

Use:

```bash
terabox-sin session status
terabox-sin doctor
```

or MCP `terabox_session_status` to inspect configuration without exposing the full NDUS value.

## Browser workflow

The browser helper is separate from the MCP server.

```bash
cd browser-automation
npm install
npm run start
npm run status
```

If the dedicated profile is not logged in, the user completes the normal TeraBox login in the opened Chrome window. Do not attempt to solve that state by exporting cookies or browser authentication files.

Available helpers currently include:

```bash
npm run snapshot
npm run root
npm run open -- "Folder name"
npm run upload -- /absolute/path/to/file
npm run mkdir -- "Folder name"
```

See `browser-automation/README.md` and `browser-automation/AGENT.md`.

### Repository-backed mirror contract

When an agent mirrors a repository or case archive to TeraBox, the source repository owns the manifest and hash state. TeraBox-SIN owns only remote navigation, upload and verification. Do not create a second authoritative database in TeraBox-SIN.

Use this sequence: local hash/manifest -> `browser root` -> `browser open` -> upload pending file -> verify remote visibility -> mark manifest verified. On any failure, keep the item pending so a later run is resumable and idempotent. Never treat an upload click alone as proof of durable remote storage.

## Troubleshooting sequence

Use this order to minimize destructive debugging:

```bash
terabox-sin doctor
terabox-sin status
terabox-sin methods
npm run check
```

Then inspect the exact method implementation/signature in `api.js`.

TeraBox-SIN inherits interfaces that can change upstream without a package release. An endpoint failure can therefore be an upstream compatibility issue even when local authentication and tests are healthy.
