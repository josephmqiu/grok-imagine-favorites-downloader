# Grok Favorites Downloader Extension

This Chrome extension collects all media links from your Grok Imagine favorites page and triggers the download buttons one by one. Because it runs inside your logged-in browser profile, you can complete any Cloudflare or login prompts manually before starting the automation.

## Load the extension locally

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and choose the `extension/` directory in this repository.
4. You should now see the **Grok Favorites Downloader** extension in the toolbar.

## Run a download session

1. Open `https://grok.com/imagine/favorites` in a normal tab.
2. Log in and satisfy any “verify you are human” challenges until the favorites grid is visible.
3. Click the extension icon to open the right-side control panel, then press **Start Download**.
4. Keep the panel visible if you want live updates—the extension will:
   - Mimic human scrolling across the paginated favorites list to surface every tile.
   - Harvest all images and videos per card, grouping them under a shared stem.
   - Trigger Chrome downloads directly, saving each run into `grok-favorites/<timestamp>/`.
5. When the panel reports *Finished*, review Chrome’s Downloads list for any items that might need manual retries.

## Tips

- Use the **Enable debug logs** checkbox when diagnosing scroll issues—the status feed will emit step-by-step metrics (media counts, heights, pagination events).
- Downloads persist in the side panel until you refresh the favorites page; closing and reopening the panel during a session will restore the same progress.
- The previous Playwright automation (`download_favorites.py`) has been removed; the extension now drives all automation directly from the browser.
