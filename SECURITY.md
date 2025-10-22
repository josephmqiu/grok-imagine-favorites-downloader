# Security Policy

## Supported Versions

This project is in active development. Security fixes land on the current minor version and are not backported.

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | :white_check_mark: |
| < 0.3   | :x:                |

## Security Considerations

### Extension Permissions

The extension requests the minimum MV3 permissions necessary:
- **downloads** – Trigger Chrome's download manager for collected media
- **scripting** – Inject scraper code and unfavorite helpers into the active tab
- **tabs** – Validate the active tab URL and exchange messages with the panel

### Host Permissions

Scopes are limited to Grok-owned domains:
- `https://grok.com/imagine/*` – Favorites grid and unfavorite controls
- `https://imagine-public.x.ai/*` – Hosted image assets
- `https://assets.grok.com/*` – Additional media resources

### What This Extension Does NOT Do

- ❌ Collect or transmit personal data
- ❌ Call third-party APIs or external services
- ❌ Access cookies, tokens, or storage outside the page context
- ❌ Inspect unrelated tabs or browsing history
- ❌ Modify non-Grok webpages

### What This Extension DOES

- ✅ Reads media URLs from the Grok favorites page you're already viewing
- ✅ Scrolls and paginates to expose lazy-loaded content before downloading
- ✅ Triggers Chrome's downloads API under the `grok-favorites/<timestamp>/` tree
- ✅ Provides an optional unfavorite helper that clicks existing "Unsave" buttons after download completion
- ✅ Runs entirely inside your browser session with no background servers

## Privacy

- No analytics, telemetry, or logging beyond the truncated status feed
- Downloaded files stay local; the repo `.gitignore` excludes the `grok-favorites/` directory
- Run state resets when the tab refreshes or a new page is opened

## Reporting a Vulnerability

If you discover a security issue:
1. **Do not** open a public GitHub issue
2. Email the maintainer directly (see GitHub profile)
3. Include clear reproduction steps, impact assessment, and suggested mitigations if available

We aim to acknowledge reports within 48 hours and prioritize fixes promptly.

## Best Practices for Users

1. Install the extension only from this repository (review the source before loading)
2. Keep Chrome/Chromium up to date for the latest MV3 patches
3. Avoid sharing the downloaded folder structure publicly—it may contain identifiable filenames
4. Use the unfavorite helper cautiously; pause if the page layout changes unexpectedly
5. Respect Grok's Terms of Service when archiving or removing content

## Code Audit

The extension comprises:
- ~930 lines in `extension/background.js`
- ~520 lines in `extension/panel.js`
- ~415 lines in `extension/panel.css`
- No third-party dependencies or bundlers

Last security review: February 2025
