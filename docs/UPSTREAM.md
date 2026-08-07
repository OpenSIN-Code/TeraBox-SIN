# Upstream relationship

TeraBox-SIN is a maintained fork of [`seiya-npm/terabox-api`](https://github.com/seiya-npm/terabox-api). The repository preserves the upstream MIT license, attribution and Git history while adding the SIN CLI/MCP/authentication layer and optional browser automation.

## Upstream remote

Recommended configuration:

```bash
git remote add upstream https://github.com/seiya-npm/terabox-api.git
git fetch upstream
```

Verify before adding the remote if one may already exist:

```bash
git remote -v
```

## Branch model

The historical upstream project uses a `package` branch. TeraBox-SIN development can occur on `main`, so do not assume the branch names match.

Inspect available upstream branches before merging:

```bash
git branch -r
```

A typical sync is:

```bash
git fetch upstream
git switch main
git merge upstream/package
```

Resolve conflicts deliberately. In particular, do not discard SIN-specific files under:

- `src/sin/`
- `bin/terabox-sin*`
- `scripts/`
- `SKILL.md`
- `docs/`
- `browser-automation/`

## What should remain upstream-compatible

`api.js` and `helper.js` should stay as close to upstream semantics as practical so future synchronization remains reviewable.

Prefer placing SIN-specific behavior in `src/sin/` instead of modifying inherited methods solely for agent integration.

When an upstream method requires a compatibility fix, keep the patch focused and add a regression test where practical.

## MCP method exposure

TeraBox-SIN discovers public methods dynamically. This means an upstream merge can change the MCP tool surface without an explicit edit to `server.js`.

After every upstream sync:

```bash
npm install
npm run check
node src/sin/cli.js methods
```

Review newly exposed methods, especially mutations or account-changing operations, before release.

## Attribution

Do not remove upstream copyright/license notices or rewrite the project history to obscure the original implementation.

TeraBox-SIN-specific documentation should distinguish clearly between:

- upstream `seiya-npm/terabox-api` behavior;
- SIN wrappers/integration;
- official TeraBox Open Platform behavior;
- optional browser automation.
