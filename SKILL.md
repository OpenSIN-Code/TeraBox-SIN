---
name: terabox-sin
description: >
  Full TeraBox Storage Cloud access through the TeraBox-SIN fork of
  seiya-npm/terabox-api. List, search, inspect, download, upload, create,
  copy, move, rename, delete, restore, share, transfer and use cloud-download
  operations. Every public upstream method is exposed dynamically through MCP.
  Use for TeraBox, cloud storage, remote files, file uploads/downloads, shared
  links, storage quota, TeraBox folders, and TeraBox account operations.
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
  version: "3.0.0-sin.1"
  updated: "2026-08-03"
---

# TeraBox-SIN

Use the MCP server `terabox-sin` or CLI `terabox-sin` for complete TeraBox
Storage Cloud operations. Authentication is an NDUS session stored only in the
macOS Keychain service `TeraBox-SIN`, account `ndus`, or supplied at runtime as
`TERABOX_NDUS`. Never print, log, commit, or paste the complete token.

## MCP tools

- `terabox_methods`: discover every currently installed public upstream method.
- `terabox_call`: call any public method using positional JSON arguments.
- `terabox_<method>`: direct generated wrapper for every public method.
- `terabox_status`: verify the current account/session and quota when available.
- `terabox_session_status`: report local session presence without exposing it.

No upstream method category is removed. Tool annotations describe likely read,
write, and destructive behavior for clients, but the methods remain callable.

## Argument adapters

Use positional `args`. Local file and runtime values can be represented as:

```json
{"$file":"/absolute/path"}
{"$blob":"/absolute/path","type":"application/octet-stream"}
{"$stream":"/absolute/path"}
{"$json_file":"/absolute/path/data.json"}
{"$env":"VARIABLE_NAME"}
{"$abort_signal":true}
{"$progress":true}
```

Binary and stream results are written to the requested `output_path`, or to
`~/.cache/terabox-sin/results` when too large to return inline.

## CLI

```bash
terabox-sin doctor
terabox-sin status
terabox-sin methods
terabox-sin call checkLogin '[]'
terabox-sin call getRemoteDir '["/"]'
terabox-sin session set
terabox-sin session delete
terabox-sin login user@example.com
```

`session set` and `login` use a hidden native macOS dialog when run from an
interactive terminal. Piped input is supported for controlled automation.
