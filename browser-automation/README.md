# TeraBox browser automation

Local TeraBox web automation using Playwright, a dedicated persistent Chrome profile and a loopback-only Chrome DevTools Protocol (CDP) endpoint.

This is an **optional integration mode**. It is separate from the root TeraBox-SIN CLI/MCP client and does not require NDUS configuration.

## When to use it

Use browser automation when:

- the task specifically needs the TeraBox web UI;
- a normal web login is already the preferred authentication path;
- the inherited API client does not support the required workflow reliably.

Prefer the root CLI/MCP client for structured operations when it works for the task.

## Security model

The browser login remains inside a dedicated Chrome profile. The workflow does not require exporting cookies into source code or configuration files.

Keep these directories private and local:

- `browser-profile/`
- `data/`
- `downloads/`

They are ignored by Git.

The CDP endpoint binds only to `127.0.0.1` by default. Do not expose it to a public interface or tunnel it without a separate security review.

## Install

```bash
cd browser-automation
npm install
```

## First start

```bash
npm run start
```

A dedicated Chrome window opens at the TeraBox file area. On the first run, complete the normal TeraBox login in that window.

The default runtime profile is:

```text
browser-automation/browser-profile/
```

Subsequent starts reuse that profile.

## Verify login/file area

```bash
npm run status
```

A healthy logged-in file view looks conceptually like:

```json
{
  "ok": true,
  "likelyLoginScreen": false,
  "likelyFileArea": true
}
```

The checks are UI heuristics and can require updates if TeraBox changes its page text/layout.

## Commands

Save the visible page text locally:

```bash
npm run snapshot
```

Upload a file through the web UI:

```bash
npm run upload -- /absolute/path/to/file.zip
```

Create a folder through the web UI:

```bash
npm run mkdir -- "Folder name"
```

UI automation is inherently less stable than a documented API. If selectors stop matching after a TeraBox redesign, update the helper and test it against a non-destructive operation first.

## Runtime configuration

Optional environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `TERABOX_CDP_PORT` | `9225` | Local CDP port |
| `TERABOX_CHROME` | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` | Chrome executable |
| `TERABOX_BROWSER_PROFILE` | `./browser-profile` | Persistent profile directory |
| `TERABOX_BROWSER_DATA` | `./data` | Snapshot/metadata directory |
| `TERABOX_BROWSER_DOWNLOADS` | `./downloads` | Reserved download directory |

Relative defaults are resolved from the `browser-automation/` directory, so the project can be cloned anywhere.

Example with a different port:

```bash
TERABOX_CDP_PORT=9335 npm run start
TERABOX_CDP_PORT=9335 npm run status
```

Use the same configuration for all commands that connect to the same browser instance.

## What this mode does not do

It does not:

- implement the official TeraBox OAuth/Open Platform flow;
- automatically convert a browser login into NDUS;
- export browser cookies as a supported project workflow;
- expose the browser helpers automatically through the root MCP server.

If MCP exposure for browser operations is added later, keep it explicitly separated from the core NDUS client and preserve the local-profile security boundary.
