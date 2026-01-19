# Grok Favorites Downloader

A Chrome extension that scrolls through your [Grok Imagine](https://grok.com/imagine) favorites, downloads every image and video to your local machine.

## Features

- **Bulk Download**: Scroll automation collects the entire favorites grid before queueing downloads
- **Live Progress Tracking**: Background worker snapshots status updates for the side panel and history log
- **Automatic Retry Loop**: Failed downloads retry up to three times before being marked as permanent failures
- **Download Limit Control**: Optional limit input for quick smoke tests without pulling the whole library
- **Media Type Filter**: Download all media, images only, or videos only
- **Paired Filenames**: Media from the same favorite uses sequential numbering so related files stay grouped
- **Privacy First**: No external network calls; everything runs in your logged-in browser session

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** and select the `extension/` folder
5. Pin `Grok Downloader` for easy access

## Usage

1. Visit [https://grok.com/imagine/favorites](https://grok.com/imagine/favorites) and resolve any verification prompts
2. Click the extension icon to open the side panel
3. *(Optional)* Enable debug logs for verbose console output
4. *(Optional)* Select media type filter (All, Images only, Videos only)
5. *(Optional)* Enter a download limit (`0` keeps all items)
6. Press **Start Download** and leave the tab focused while the panel scrolls the grid
7. Monitor progress in the panel; retries are surfaced in the status feed
8. Files land under `grok-favorites/<timestamp>/` in your Downloads folder

## How It Works

1. `background.js` validates the active tab, toggles debug mode, and executes `scrapeFavorites()` in-page
2. The scraper performs human-like scrolling, pagination advances, and groups media by favorite card
3. Queue preparation enforces unique filenames, pairs related media, and applies the optional limit
4. The queue processor streams items through Chrome's downloads API with retry tracking and progress snapshots
5. Failed downloads automatically retry up to 3 times with backoff before being marked as permanent failures

## Troubleshooting

**Only getting a few downloads?** Ensure the favorites grid was visible, try enabling debug logs, and confirm no rate limits in `chrome://extensions/?errors=extension`.

**Stuck on "Scanning favorites"?** Scroll the page manually once, refresh, and re-run; the scraper needs the grid root to mount.

**Need to retry a handful of failures?** They will automatically cycle up to three times; check the status feed for permanent failures.

## Technical Details

- **Manifest Version**: 3 (service worker extension)
- **Background**: `extension/background.js` (~875 lines) - orchestrates scraping, downloads, retries
- **Content Script**: `extension/panel.js` (~325 lines) - renders the side panel and progress UI
- **Styling**: `extension/panel.css` (~295 lines) - Grok.com-matching dark theme
- **Dependencies**: None (plain JavaScript, no build step)

## Privacy & Security

- No analytics, telemetry, or off-domain requests
- Only operates on Grok Imagine URLs while the panel is open
- Downloaded files stay local under the `grok-favorites/` directory tree

## Contributing

- Follow the 2-space indentation, modern JS style, and pure helper patterns
- Run a manual download pass (limit to a small number if needed)
- Capture relevant debug console output when adjusting selectors
- Update documentation (`README.md`, `CLAUDE.md`, `SECURITY.md`) when behavior changes

## License

MIT License – see [LICENSE](LICENSE) for details.

## Disclaimer

This is an unofficial tool not affiliated with X.AI or Grok. Respect Grok's Terms of Service and confirm you have rights to download content.
