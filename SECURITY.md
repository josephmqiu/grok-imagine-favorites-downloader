# Security Policy

## Supported Versions

This project is currently in active development. Security updates will be applied to the latest version.

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | :white_check_mark: |
| < 0.3   | :x:                |

## Security Considerations

### Extension Permissions

This extension requests minimal permissions:
- **downloads**: Required to trigger browser downloads
- **scripting**: Required to inject content script for page scraping
- **tabs**: Required for communication between background and content scripts

### Host Permissions

Limited to Grok-related domains:
- `https://grok.com/imagine/*` - User's favorites page
- `https://imagine-public.x.ai/*` - Image hosting
- `https://assets.grok.com/*` - Asset hosting

### What This Extension Does NOT Do

- ❌ Collect or transmit your personal data
- ❌ Make external API calls
- ❌ Access cookies or authentication tokens
- ❌ Monitor your browsing activity
- ❌ Modify content on other websites
- ❌ Access your browsing history

### What This Extension DOES

- ✅ Reads media URLs from Grok favorites page you're viewing
- ✅ Triggers Chrome's built-in download API
- ✅ Runs entirely locally in your browser
- ✅ Only activates when you click the extension icon

## Privacy

- No analytics or tracking
- No user data leaves your browser
- Downloaded files stored locally only
- Extension state resets on page refresh

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by:

1. **DO NOT** open a public GitHub issue
2. Email the maintainer directly (see GitHub profile)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work on a fix promptly.

## Best Practices for Users

1. Only install from trusted sources (official GitHub repository)
2. Review the code before installing (all source is available)
3. Keep Chrome/Chromium updated to latest version
4. Don't share your downloaded media folder path publicly (may contain identifiable filenames)
5. Respect Grok's Terms of Service regarding content ownership

## Code Audit

The extension codebase is:
- **938 lines** of vanilla JavaScript
- **Zero dependencies** (no npm packages)
- **Open source** - fully auditable
- **No minification** - you see exactly what runs

Last security review: January 2025
