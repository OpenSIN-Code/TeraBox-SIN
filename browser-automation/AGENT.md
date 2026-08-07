# Agent instructions for TeraBox browser automation

1. Work in `browser-automation/`.
2. Run `npm install` once when dependencies are missing.
3. Start the dedicated browser with `npm run start`.
4. Verify TeraBox state with `npm run status`.
5. If the profile is not logged in, stop automated file actions and ask the user to complete the normal TeraBox login in the opened window.
6. Use `npm run snapshot` to refresh locally stored visible TeraBox data.
7. Use `npm run upload -- <absolute-file>` for uploads.
8. Use `npm run mkdir -- <folder-name>` for folder creation.
9. Keep generated metadata under `data/` and downloads under `downloads/`.
10. Never commit or copy `browser-profile/`, authentication material, local snapshots, or downloads into Git.
11. Prefer browser UI automation through the persistent profile over reverse-engineered private endpoints when this mode is selected.
