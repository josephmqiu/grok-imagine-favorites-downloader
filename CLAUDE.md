# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when contributing to this repository.

## Project Overview

Chrome Manifest V3 extension that downloads every media asset from a user's Grok Imagine favorites page with automatic retry for failed downloads. All logic runs locally inside the browser session.

## Development Workflow

### Loading the extension
1. Navigate to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` directory
4. Chrome hot-reloads files automatically on save

### Manual Testing
- Visit `https://grok.com/imagine/favorites` and solve verification prompts until the grid renders
- Open the extension panel, optionally toggle debug logs, and set a limit (`0` downloads everything)
- Press **Start Download** and verify: progress bar increments, retries surface in the log, files write to `grok-favorites/<timestamp>/`
- Watch `chrome://extensions/?errors=extension` and `chrome://downloads/` for runtime diagnostics

## Architecture

### Component Structure

**Service worker** – `extension/background.js` (874 lines)
- Maintains global run state (`runState`) with queue tracking and retry bookkeeping
- `CONFIG` object holds tunable constants (retry limits, delays, timeouts)
- `handleStart()` validates tab context, applies optional download limits, and kicks off scraping
- `processQueue()` streams downloads, records outcomes, and enqueues failures for `processRetries()`
- `processRetries()` uses a while loop (not recursion) to retry failed items up to `MAX_RETRIES`
- `downloadAsset()` wraps Chrome downloads API with 30-second timeout

**Content script** – `extension/panel.js` (323 lines)
- Injects the side panel UI with progress widgets, debug toggle, media type filter, and download limit input
- Renders status history and mirrors background progress
- Uses versioned injection guard (`__grokDownloaderInjected_v1__`) to prevent duplicate injection

**Stylesheet** – `extension/panel.css` (295 lines)
- Matches Grok.com design system: pure black (`#000000`), off-white text (`#f9f9f9`), orange accent (`#ff3d00`)
- Fixed-position panel with progress bar and scrollable status log

### Key Workflows

**Download session**
1. Panel posts `START_DOWNLOADS` with debug, limit, and mediaType flags
2. `handleStart()` validates the tab, announces scan mode, executes `scrapeFavorites()`, and prepares filenames
3. Optional limit truncates the collected items before queue creation
4. `processQueue()` downloads sequentially, snapshots progress, and queues failures
5. `processRetries()` loops failed items up to 3 times with 1-second delay between attempts
6. Completion notifies the panel with final success/failure counts

**Scraping algorithm** (`scrapeFavorites()`)
- Waits for the favorites grid, performs human-like scroll steps, and advances pagination when the DOM stabilizes
- Collects visible media, groups cards by container ID for sequential numbering
- Transforms preview/thumbnail URLs to original full-resolution URLs
- Returns structured metadata used to build filenames

### Message Types
- `CONTENT_READY` – Panel loaded, reset state
- `REQUEST_STATE` – Panel requests current progress/history
- `START_DOWNLOADS` – Begin download session
- `STATUS` – Progress update from background to panel
- `TOGGLE_PANEL` – Show/hide panel from extension icon click

## Code Style

- Modern JavaScript, 2-space indentation, arrow callbacks, early returns
- Keep helpers pure (`prepareQueue`, `deriveExtension`, `notify`) and secure (`truncate()` for log output)
- Message types are uppercase strings – reuse existing patterns
- Input validation: use `Math.max(0, ...)` for numbers, whitelist validation for enums

## Debugging Tips

- Enable the panel debug checkbox to surface scroll, pagination, and media count metrics
- Service worker logs (retries, failures) appear in the panel history; check `chrome://extensions/?errors=extension` for stack traces
- Verify DOM selectors against the live Grok page before changing the scraper
- Use `scripts/inspect-grok.mjs` with Playwright to analyze page structure

## File Structure

```
extension/
  background.js    # Service worker - downloads, retries, scraping
  panel.js         # Content script - UI panel
  panel.css        # Grok-themed styles
  manifest.json    # Extension manifest v3
scripts/
  inspect-grok.mjs # Dev utility for page inspection (requires playwright)
```
