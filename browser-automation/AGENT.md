# Agent instructions for TeraBox browser automation

Use this workflow only when browser automation is the selected TeraBox integration mode.

## Startup

1. Work in `browser-automation/`.
2. Run `npm install` when dependencies are missing or the lockfile changed.
3. Start the dedicated browser with `npm run start`.
4. Verify state with `npm run status`.
5. Continue automated file actions only when the dedicated profile is logged in and the intended TeraBox area is visible.

If login is required, ask the user to complete the normal TeraBox login in the opened dedicated Chrome window. Do not replace that step by exporting browser cookies or authentication files.

## Supported helpers

```bash
npm run status
npm run snapshot
npm run upload -- /absolute/path/to/file
npm run mkdir -- "Folder name"
```

Treat upload and folder creation as remote mutations. Confirm the target context before executing them when ambiguity exists.

## Local state

Runtime data belongs under the configured local directories, defaulting to:

- `browser-profile/`
- `data/`
- `downloads/`

Never add those directories to Git.

Do not print or copy authentication material from the persistent profile into prompts, source files, logs or chat output.

## CDP safety

The default endpoint is `http://127.0.0.1:9225`.

- Keep CDP loopback-only.
- Do not expose CDP directly to the network.
- Do not attach to unrelated personal Chrome profiles when the dedicated profile is sufficient.
- Use the same `TERABOX_CDP_PORT` value across commands when overriding the default.

## Failure handling

If `npm run status` cannot connect:

1. run `npm run start`;
2. confirm the configured port is consistent;
3. verify Google Chrome exists at the configured `TERABOX_CHROME` path;
4. inspect the dedicated TeraBox window;
5. avoid deleting the persistent profile as a first-line fix because doing so removes the stored browser login.

If a UI helper fails after connecting successfully, assume a TeraBox UI/selector change is possible. Inspect the current page and update selectors using the smallest non-destructive test.

## Relationship to root TeraBox-SIN

The root CLI/MCP client and browser mode are separate:

- root CLI/MCP: NDUS + inherited API client;
- browser mode: normal web login + persistent Chrome profile.

Do not silently mix their credential models.
