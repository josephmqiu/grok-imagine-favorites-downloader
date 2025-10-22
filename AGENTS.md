# Repository Guidelines

## Project Structure & Module Organization
- Load the unpacked Chrome extension from `extension/`.
- `background.js` hosts the Manifest V3 service worker, managing queue orchestration, retries, and unfavorite messaging.
- `panel.js` renders the side-panel UI, progress log, download limit input, and post-run unfavorite workspace; matching styles live in `panel.css`.
- Keep shared icons or HTML fragments in `extension/assets/` if needed, and store documentation at the repository root.

## Build, Test, and Development Commands
- There is no build step. Use Chrome: `chrome://extensions` → enable **Developer Mode** → **Load unpacked** → select `extension/`.
- Chrome hot-reloads on save. Reopen the panel after UI edits to confirm changes.
- Manual verification flow: visit `https://grok.com/imagine/favorites`, complete any verification prompts, open the panel, optionally set a download limit (`0` = all), toggle debug logs, press **Start Download**, and monitor the status feed plus `chrome://extensions/?errors=extension` for diagnostics.

## Coding Style & Naming Conventions
- Modern JavaScript with 2-space indentation; prefer `const`/`let`, arrow callbacks, and early returns.
- Keep helpers (`notify`, `prepareQueue`, `deriveBaseName`, `truncate`) pure and reusable.
- Use camelCase for variables/functions, kebab-case for asset filenames, and reuse stems from `buildFilename()` so paired media share a base name.

## Testing Guidelines
- No automated harness. Perform smoke passes covering: complete download run, retry handling (simulate by throttling network), and the unfavorite workflow (filters, select all/none, skip, execute).
- Capture debug console lines when adjusting selectors in `scrapeFavorites()`; attach to reviews for context.
- Verify files land under `grok-favorites/<timestamp>/` and that the panel progress totals match detected items.

## Commit & Pull Request Guidelines
- Use imperative commit subjects ≈65 characters, e.g., `Add pagination fallback logging`.
- Separate documentation-only changes when practical.
- PRs should describe manual verification (URL visited, counts observed, retry outcomes, destination path), include screenshots or GIFs for UI updates, and link related issues or support tickets.

## Security & Configuration Tips
- Never log full asset URLs or user identifiers; rely on `truncate()` for obfuscation.
- Ensure downloaded media stays inside the ignored `grok-favorites/` directory tree and avoid committing user data or session artifacts.
