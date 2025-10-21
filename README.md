# Grok Favorites Downloader

A Chrome extension that downloads all media (images and videos) from your [Grok Imagine](https://grok.com/imagine) favorites page. Perfect for backing up your AI-generated artwork.

## Features

- 📥 **Bulk Download**: Automatically scrolls through your entire favorites gallery and downloads all media
- 🎨 **Handles Virtual Scrolling**: Collects media as it scrolls to work with Grok's dynamic page loading
- 📊 **Live Progress Tracking**: Real-time progress bar and status updates
- 🐛 **Debug Mode**: Optional verbose logging for troubleshooting
- 🗂️ **Organized Storage**: Files saved in timestamped folders (`grok-favorites/YYYY-MM-DD_HH-MM-SS/`)
- 🔒 **Privacy First**: No external API calls, runs entirely in your browser

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** and select the `extension/` folder
5. The extension icon should appear in your toolbar

## Usage

1. Visit [https://grok.com/imagine/favorites](https://grok.com/imagine/favorites)
2. Log in and complete any verification challenges
3. Click the extension icon to open the side panel
4. *(Optional)* Enable debug logs to see detailed progress
5. Click **Start Download**
6. Wait for the extension to scroll through and collect all media
7. Files will download to your browser's download folder under `grok-favorites/<timestamp>/`

## How It Works

The extension:
1. Finds the scrollable container on the Grok favorites page
2. Scrolls progressively to trigger lazy-loaded content
3. Collects media URLs as it scrolls (to handle virtual DOM unmounting)
4. Uses Chrome's downloads API to save each file with a unique filename
5. Groups related media (images + videos) under shared base names when possible

## Troubleshooting

**Only getting a few downloads?**
- Make sure you've scrolled to the top of the page before starting
- Try enabling debug mode to see what's happening
- Check `chrome://extensions/?errors=<extension-id>` for errors

**Extension not working?**
- Verify you're on `https://grok.com/imagine/favorites`
- Check that Developer Mode is enabled
- Try reloading the extension

## Technical Details

- **Manifest Version**: 3
- **Permissions**: `downloads`, `scripting`, `tabs`
- **Host Permissions**: `grok.com/imagine/*`, `imagine-public.x.ai/*`, `assets.grok.com/*`
- **File Size**: ~900 lines of vanilla JavaScript
- **Dependencies**: None

## Privacy & Security

- ✅ No external API calls or analytics
- ✅ No data collection or tracking
- ✅ Runs entirely in your browser
- ✅ Only accesses Grok URLs you're already logged into
- ✅ Open source - review the code yourself

## Contributing

Contributions welcome! Please:
- Test your changes thoroughly with the manual test flow
- Follow the existing code style (2-space indentation, modern JS)
- Add debug logging for new features
- Update CLAUDE.md if adding significant functionality

## License

MIT License - see [LICENSE](LICENSE) file for details

## Disclaimer

This is an unofficial tool not affiliated with X.AI or Grok. Use responsibly and in accordance with Grok's Terms of Service. You are responsible for ensuring you have the right to download the content.

## Credits

Built for personal use to backup AI-generated artwork. If Grok adds an official bulk export feature, please use that instead!
