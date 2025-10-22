# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when contributing to this repository.

## Project Overview

Chrome Manifest V3 extension that downloads every media asset from a user's Grok Imagine favorites page, retries failed downloads, and optionally unfavorites items once the backup completes. All logic runs locally inside the browser session.

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
- After completion, exercise the unfavorite workspace: try the quick filters, run **Unfavorite Selected**, and confirm skipped flows
- Watch `chrome://extensions/?errors=extension` and `chrome://downloads/` for runtime diagnostics

## Architecture

### Component Structure

**Service worker** – `extension/background.js`
- Maintains global run state (`runState`) with queue tracking, retry bookkeeping, and unfavorite metadata (`items`) (`extension/background.js:1`)
- `handleStart()` validates tab context, applies optional download limits, and kicks off scraping (`extension/background.js:120`)
- `processQueue()` streams downloads, records outcomes, and enqueues failures for `processRetries()` (`extension/background.js:216`, `extension/background.js:314`)
- `sendDownloadsComplete()` packages metadata for the panel's unfavorite UI (`extension/background.js:418`)
- `executeUnfavorites()` synthesizes clicks on "Unsave" buttons when the user confirms (`extension/background.js:437`)

**Content script** – `extension/panel.js`
- Injects the side panel UI, progress widgets, debug toggle, and download limit input (`extension/panel.js:16`)
- Renders status history, mirrors background progress, and keeps local state for the unfavorite workspace (`extension/panel.js:147`, `extension/panel.js:334`)
- Provides range/type selection helpers and forwards unfavorite actions back to the service worker (`extension/panel.js:386`, `extension/panel.js:450`)

**Stylesheet** – `extension/panel.css`
- Controls fixed-position layout, dark theme, progress bar, and unfavorite grid styling

### Key Workflows

**Download session**
1. Panel posts `START_DOWNLOADS` with debug + limit flags
2. `handleStart()` validates the tab, announces scan mode, executes `scrapeFavorites()`, and prepares filenames (`extension/background.js:120`)
3. Optional limit truncates the collected items before queue creation (`extension/background.js:174`)
4. `processQueue()` downloads sequentially, snapshots progress, and queues failures (`extension/background.js:216`)
5. `processRetries()` loops failed items up to `MAX_RETRIES`, logging success or permanent failure (`extension/background.js:314`)
6. Completion triggers progress finalization and an unfavorite payload for the panel (`extension/background.js:389`)

**Scraping algorithm** (`extension/background.js:529`)
- Waits for the favorites grid, performs human-like scroll steps, and advances pagination when the DOM stabilizes
- Collects visible media, groups cards by container ID, and records whether each favorite contains images, videos, or both
- Returns structured metadata used to build filenames and feed the unfavorite UI

**Unfavorite workflow**
- Panel receives `DOWNLOADS_COMPLETE`, renders selectable cards with filters, and gathers indices (`extension/panel.js:480`)
- On confirm, posts `EXECUTE_UNFAVORITES`; service worker injects click automation and clears metadata (`extension/background.js:437`)
- `SKIP_UNFAVORITE` clears state without modifying the page (`extension/background.js:510`)

## Code Style

- Modern JavaScript, 2-space indentation, arrow callbacks, early returns
- Keep helpers pure (`prepareQueue`, `deriveBaseName`, `notify`) and secure (`truncate()` for log output)
- Message types are uppercase strings (`STATUS`, `DOWNLOADS_COMPLETE`, etc.) – reuse existing enums

## Debugging Tips

- Enable the panel debug checkbox to surface scroll, pagination, and media count metrics in the console
- Service worker logs (retries, failures, unfavorite notices) appear in the panel history; check `chrome://extensions/?errors=extension` for stack traces
- Verify DOM selectors against the live Grok page before changing the scraper; log updates with `log()` inside `scrapeFavorites()`
- When editing download filenames, ensure paired assets stay grouped and sanitize using the existing helpers
