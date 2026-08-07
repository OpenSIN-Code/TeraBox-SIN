# Development notes

This file contains maintainer guidance for TeraBox-SIN. It intentionally avoids storing live credentials, copied session material or large dumps of private web endpoints.

## Architecture

### Core client

`api.js` contains the inherited `TeraBoxApp` implementation from `seiya-npm/terabox-api`.

The SIN layer lives under `src/sin/`:

- `client.js` — client construction, public-method discovery, argument materialization and result normalization
- `keychain.js` — NDUS lookup/storage/redaction helpers
- `cli.js` — human/agent CLI
- `server.js` — MCP tool registration
- `stdio.js` — stdio transport entry point

### Browser automation

`browser-automation/` is deliberately separate from the core client. It uses `chrome-remote-interface` over a loopback-only Chrome DevTools Protocol endpoint and stores browser state only in ignored runtime directories.

Do not couple browser-profile authentication to NDUS storage unless there is a separately reviewed design for that conversion.

## Authentication

The core client resolves NDUS in this order:

1. `TERABOX_NDUS`
2. macOS Keychain (`TeraBox-SIN` / `ndus`)

`createTeraBoxClient({ requireAuth: false })` is used for method discovery and other operations that do not require a configured session at construction time.

Never add debug logging that prints request cookies, NDUS, passwords, OAuth credentials or unredacted authentication responses.

## Public-method discovery

`listPublicMethods()` walks the prototype chain until `Object.prototype`, excludes `constructor` and names beginning with `_`, and returns function-valued properties.

This design keeps MCP exposure forward-compatible with upstream methods. Any upstream public method can therefore become an MCP tool automatically after an update.

Consequences:

- method discovery must remain deterministic;
- private/internal helpers should begin with `_` or otherwise not be public functions;
- documentation must tell agents to use `terabox_methods` instead of relying on a frozen static list.

## Mutation annotations

`isLikelyMutating()` and `isLikelyDestructive()` provide conservative MCP annotations. Known reads are explicitly recognized, ambiguous generic entry points such as `doReq` and `filemanager` are forced into the mutating/destructive class, and unknown methods fall back to mutating.

Do not make authorization decisions solely from these annotations. Keep the conservative fallback when upstream adds new methods.

## Argument materialization

`materializeArguments()` supports recursive special values:

- `$file`
- `$blob`
- `$stream`
- `$json_file`
- `$env`
- `$abort_signal`
- `$progress`

Keep these adapters small and deterministic. MCP calls pass explicit filesystem and environment allowlists into materialization. Filesystem-backed adapters and explicit output paths are deny-by-default unless `TERABOX_SIN_ALLOWED_ROOTS` is configured; `$env` is deny-by-default unless the variable is named in `TERABOX_SIN_ALLOWED_ENV`. Path checks canonicalize existing path components to block symlink escapes.

Direct CLI invocation remains a local-user trust boundary and does not apply the MCP allowlists. New adapters that access credentials, network resources or executable code require additional security review.

## Result normalization

`normalizeResult()` converts upstream return values into MCP/JSON-friendly forms and masks common secret-shaped fields.

Current behavior includes:

- BigInt → string
- small Buffer/Uint8Array/Blob → base64 envelope
- large binary values → local file
- streams → local file
- Error → structured object
- circular references → `[Circular]`
- common credential field names → masked/redacted values

Redaction is defense-in-depth. Do not assume unknown upstream fields are safe merely because normalization succeeded.

## Official Open Platform research

TeraBox's official integration documentation is separate from the inherited client:

https://www.terabox.com/integrations/docs?lang=en

As of August 2026, the documented official flow requires pre-issued application credentials and OAuth-style access/refresh tokens.

If official Open Platform support is added, implement it as an explicit authentication/backend mode instead of silently replacing NDUS semantics.

## Endpoint research

Historical endpoint research can be recovered from Git history when needed. Avoid maintaining an unstructured list of web routes in this file because:

- routes become stale quickly;
- official and unofficial interfaces get mixed together;
- examples can accidentally encourage credential leakage;
- destructive endpoints are easy to copy without context.

For active investigation, document only the endpoint needed for a specific issue or change, its source, date, observed behavior and whether it is official or inherited/private.

## Tests

Run before committing:

```bash
npm run check
```

The suite covers public-method discovery, declared/required arity reporting, materialization allowlists, symlink-escape blocking, redaction and MCP server exposure/annotations. Add focused regression tests whenever these boundaries change.

Browser automation has its own `npm test` suite for origin validation and startup failure handling. CI runs both root and browser tests. Do not automate destructive remote operations as part of the default test suite.

## Version consistency

The MCP server reads its version from root `package.json` at runtime, so that value cannot drift independently. Keep `SKILL.md` metadata aligned with the root package version when releasing.

## Release hygiene

Before a release:

1. `git status` is clean or contains only intended changes.
2. `npm run check` passes.
3. documentation matches actual CLI commands and package exports.
4. browser runtime state is absent from the Git index.
5. no NDUS/cookie/token/password values appear in the diff.
6. upstream attribution remains intact.
