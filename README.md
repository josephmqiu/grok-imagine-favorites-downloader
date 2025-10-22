# Grok Favorites Downloader

A Chrome extension that scrolls through your [Grok Imagine](https://grok.com/imagine) favorites, downloads every image and video, and optionally helps you unfavorite items once they are backed up.

## Features

- 📥 **Bulk Download**: Scroll automation collects the entire favorites grid before queueing downloads.
- 📊 **Live Progress Tracking**: Background worker snapshots status updates for the side panel and history log.
- ♻️ **Automatic Retry Loop**: Failed downloads retry up to three times with backoff before being marked permanent.
- 🔢 **Download Limit Control**: Optional limit input for quick smoke tests without pulling the whole library.
- 🧮 **Paired Filenames**: Media from the same favorite reuses the stem from `buildFilename()` so related files stay grouped.
- 🧹 **Post-Run Unfavorite UI**: After downloads finish, select items to unfavorite in bulk with range/type filters.
- 🔒 **Privacy First**: No external network calls; everything runs in your logged-in browser session.

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in top-right).
4. Click **Load unpacked** and select the `extension/` folder.
5. Pin `Grok Downloader` for easy access.

## Usage

1. Visit [https://grok.com/imagine/favorites](https://grok.com/imagine/favorites) and resolve any verification prompts.
2. Click the extension icon to open the side panel.
3. *(Optional)* Enable debug logs for verbose console output.
4. *(Optional)* Enter a download limit (`0` keeps all items).
5. Press **Start Download** and leave the tab focused while the panel scrolls the grid.
6. Monitor progress in the panel; retries are surfaced in the status feed.
7. When complete, review the unfavorite workspace to select cards to unsave, or skip to keep everything.
8. Files land under `grok-favorites/<timestamp>/` in your Downloads folder.

## How It Works

1. `background.js` validates the active tab, toggles debug mode, and executes `scrapeFavorites()` in-page.
2. The scraper performs human-like scrolling, pagination advances, and groups media by favorite card.
3. Queue preparation enforces unique filenames, pairs related media, and applies the optional limit.
4. The queue processor streams items through Chrome's downloads API with retry tracking and progress snapshots.
5. Once every item succeeds or exhausts retries, the panel receives a completion message plus unfavorite metadata.

## Troubleshooting

**Only getting a few downloads?** Ensure the favorites grid was visible, try enabling debug logs, and confirm no rate limits in `chrome://extensions/?errors=extension`.

**Stuck on "Scanning favorites"?** Scroll the page manually once, refresh, and re-run; the scraper needs the grid root to mount.

**Need to retry a handful of failures?** They will automatically cycle up to three times; check the status feed for permanent failures.

## Technical Details

- **Manifest Version**: 3 service worker extension
- **Background**: `extension/background.js` (~930 lines) orchestrates scraping, retries, unfavorite messaging
- **Content Script**: `extension/panel.js` (~520 lines) renders the side panel, progress UI, and unfavorite workspace
- **Styling**: `extension/panel.css` (~415 lines)
- **Dependencies**: None (plain JavaScript, no build step)

## Privacy & Security

- No analytics, telemetry, or off-domain requests
- Only operates on Grok Imagine URLs while the panel is open
- Unfavorite automation simply clicks the page's existing "Unsave" buttons
- Downloaded files stay local under the `grok-favorites/` directory tree

## Contributing

- Follow the 2-space indentation, modern JS style, and pure helper patterns
- Run a manual download pass (limit to a small number if needed) and exercise the unfavorite UI
- Capture relevant debug console output when adjusting selectors
- Update documentation (`README.md`, `AGENTS.md`, `CLAUDE.md`, `SECURITY.md`) when behavior changes

## License

MIT License – see [LICENSE](LICENSE) for details.

## Disclaimer

This is an unofficial tool not affiliated with X.AI or Grok. Respect Grok's Terms of Service and confirm you have rights to download and unfavorite content.
