# Simpler Unfavorite Approach

The current unfavorite logic tries to match by URL, but Grok's URLs change on each page load.

## New Approach: Position-Based Unfavoriting

Since groupIds represent the top-to-bottom order (1 = first favorite, 2 = second, etc.), we can:

1. Scroll to top of page
2. Collect all Unsave buttons in DOM order as we scroll
3. Click the buttons at positions (groupId - 1) since arrays are 0-indexed

This works because:
- During download, we assigned groupId based on scroll order (top to bottom)
- The page always loads favorites in the same order
- We just need to click buttons 0, 1, 2, etc. corresponding to favorites 1, 2, 3

No URL matching needed!
