# Repository Guidelines

## Project Structure & Module Organization
The Chrome extension sources live in `extension/`. Service-worker logic resides in `background.js`, panel UI code and styles sit in `panel.js` and `panel.css`, and extension metadata stays in `manifest.json`. Store icons or shared fragments inside `extension/assets/` (create it if missing) to keep the root clean. Docs such as this guide stay at the repository top level for quick reference.

## Build, Test, and Development Commands
Load the unpacked extension via `chrome://extensions`, enable Developer Mode, and point Chrome to the `extension/` directory—saving files triggers an automatic reload. To verify end-to-end, visit `https://grok.com/imagine/favorites`, open the extension’s side panel, and use **Start Download**; the progress bar should match the detected media count. Watch runtime logs in `chrome://extensions/?errors=extension` and confirm assets land in timestamped `grok-favorites/<datetime>/` folders through `chrome://downloads/`.

## Coding Style & Naming Conventions
JavaScript follows modern Chrome standards: 2-space indentation, `const`/`let` for bindings, and arrow functions for inline callbacks. Prefer early returns for guard clauses and keep helpers (`notify`, `prepareQueue`, `deriveBaseName`) pure when practical. Use camelCase for variables, kebab-case for asset filenames, and reuse stems produced by `buildFilename()` across image/video pairs.

## Testing Guidelines
There is no automated test suite; rely on manual smoketests. Run a full download session and ensure the panel counter increments as files finish. Toggle the panel’s debug checkbox when diagnosing pagination so the status log echoes scroll metrics. When adjusting DOM selectors in `scrapeFavorites()`, validate against live favorites and capture relevant console output from the active tab to include in review notes.

## Commit & Pull Request Guidelines
Write imperative, ~65-character commit subjects (e.g., `Streamline download queue handling`). Separate functional changes from documentation updates when possible. Pull requests should summarize manual verification steps (page visited, progress observed, files created), attach UI screenshots or GIFs if the panel changes, and link any related issues or support tickets to provide context.

## Security & Privacy Tips
Avoid logging full asset URLs; use the `truncate()` helper to keep identifiers short without leaking user data. Downloaded media directories (`grok-favorites/`) are automatically excluded via `.gitignore`. Never commit user-generated content, credentials, or session data.
