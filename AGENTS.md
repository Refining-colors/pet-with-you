# Working on pet-with-you

This checkout is the canonical development source. Keep the sibling daily-use installation and media workspace independent. Use Dev-Pet.cmd / npm start for manual preview; never run the production launcher as a routine test. See docs/WORKSPACE.md.

Read README.md and docs/ARCHITECTURE.md before code changes. For installation, read docs/INSTALL.md and docs/TROUBLESHOOTING.md. Use the user's chosen scope; do not publish or export source unless requested.

## Runtime and privacy

- Windows desktop application. Install with npm ci; Node.js >=22.12 is required.
- Keep the legacy data directory and Startup shortcut compatible. project.cjs owns the data directory choice.
- Do not read or print live keys, auth.json, connection.json, private session contents, or the complete user config. Ask users to enter secrets through Settings.
- Use npm test and npm run test:ui. The UI runner uses temporary data and mocked providers. Do not run model calls or alter the live Codex installation for tests.
- Restart only the verified pet process, after checking no pet chat request is pending; never stop the user's Codex client.

## Behavior contracts

- Pure pet is the default. It retains own-API chat, whispers and provider quota without Codex.
- Settings save on close; profile save/load/delete/clear are explicit actions. Preserve masked secrets and unsaved drafts.
- Quota appears only for manual queries or opted-in new turn completions. No startup or periodic quota popup. Event mute blocks task reactions and automatic quota, not manual queries.
- Preserve position across recreation. Animation transitions must not introduce a second visible video or override dragging/manual actions.
- Avoid unnecessary scrollbars and keep module reorder handles using the normal pointer. Multi-task feedback shows counts and priority status on separate lines.

## Packaging and assets

- Launch paths must be derived from the checkout, environment or OS APIs, never a developer's username or drive.
- Root launchers are public entry points. Keep root services, runtime/, ui/, scripts/, test/, docs/ responsibilities clear.
- Generated files go to qa-output/ or media-output/. Neither belongs in source releases except explicitly selected safe docs images.
- Keep upstream copyright/license and attribution. Original character assets remain noncommercial; extracting or recording them does not make them original.
- The maintainer is Refining-colors and the repository is https://github.com/Refining-colors/pet-with-you. The new code license is not finalized; do not claim the whole repository is unrestricted MIT.
- Update user documentation and meaningful regression tests for behavior changes. Use npm run check:docs for local file links.
