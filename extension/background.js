const runState = {
  active: false,
  queue: [],
  index: 0,
  results: [],
  runId: 0,
  sessionFolder: '',
  total: 0,
  completed: 0,
  debug: false,
  tabId: null,
  history: [],
  progress: { total: 0, completed: 0 },
  items: [], // Store items with metadata for unfavorite UI
  retryQueue: [], // Items that failed and need retry
  retryAttempts: new Map(), // Track retry count per item
};

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function resetForPage(tabId) {
  runState.runId += 1;
  runState.active = false;
  runState.queue = [];
  runState.index = 0;
  runState.results = [];
  runState.sessionFolder = '';
  runState.total = 0;
  runState.completed = 0;
  runState.debug = false;
  runState.progress = { total: 0, completed: 0 };
  runState.history = [];
  runState.items = [];
  runState.retryQueue = [];
  runState.retryAttempts.clear();
  runState.tabId = tabId ?? runState.tabId;
}

function finalizeRun() {
  runState.active = false;
  runState.queue = [];
  runState.index = 0;
  runState.results = [];
  runState.sessionFolder = '';
  runState.debug = false;
  // Keep items for unfavorite UI
}

function appendHistory(entry) {
  runState.history.push(entry);
  const maxHistory = 500;
  if (runState.history.length > maxHistory) {
    runState.history.splice(0, runState.history.length - maxHistory);
  }
}

function sendStatus(entry) {
  appendHistory(entry);
  const message = {
    type: 'STATUS',
    text: entry.text,
    state: entry.state,
    timestamp: entry.timestamp,
    progress: entry.progress,
  };
  if (runState.tabId != null) {
    chrome.tabs.sendMessage(runState.tabId, message, () => {
      void chrome.runtime.lastError;
    });
  } else {
    chrome.runtime.sendMessage(message, () => {
      void chrome.runtime.lastError;
    });
  }
}

function snapshotProgress(progress) {
  if (progress) {
    const normalized = {
      total: Math.max(0, Number(progress.total) || 0),
      completed: Math.max(0, Number(progress.completed) || 0),
    };
    runState.progress = normalized;
    return { ...normalized };
  }
  if (runState.progress.total || runState.progress.completed) {
    return { ...runState.progress };
  }
  return null;
}

function notify(text, state = 'running', progress) {
  const entry = {
    text,
    state,
    timestamp: Date.now(),
    progress: snapshotProgress(progress),
  };
  sendStatus(entry);
}

function emitDebugLogs(lines) {
  if (!runState.debug || !Array.isArray(lines) || lines.length === 0) {
    return;
  }
  const progressSnapshot = snapshotProgress();
  lines.forEach((line) => {
    if (typeof line === 'string' && line.trim()) {
      sendStatus({
        text: line.trim(),
        state: 'debug',
        timestamp: Date.now(),
        progress: progressSnapshot,
      });
    }
  });
}

async function handleStart(tabId, debugEnabled, limit = 0) {
  if (runState.active) {
    return { status: 'busy' };
  }

  if (!tabId) {
    return { status: 'need_tab' };
  }

  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || !tab.url || tab.url.startsWith('chrome://')) {
    return { status: 'need_tab' };
  }

  runState.tabId = tabId;
  runState.debug = Boolean(debugEnabled);
  const downloadLimit = parseInt(limit) || 0;

  if (downloadLimit > 0) {
    notify(`Scanning favorites page (will limit to ${downloadLimit} files for testing)…`, 'running');
  } else {
    notify('Scanning favorites page (scrolling and loading all media)…', 'running');
  }

  const favoritesResult = await collectFavorites(tabId).catch((error) => ({
    status: 'error',
    message: error.message || String(error),
    items: [],
  }));

  emitDebugLogs(favoritesResult.debug);

  if (favoritesResult.status === 'not_ready') {
    notify(
      favoritesResult.message ||
        'Favorites grid not detected. Solve verification prompts, reload the page, then try again.',
      'error'
    );
    return {
      status: 'error',
      message: 'Favorites grid not detected. Solve verification prompts, reload the page, then try again.',
    };
  }

  if (!favoritesResult.items || favoritesResult.items.length === 0) {
    notify('Could not locate any downloadable media on this page.', 'error');
    return { status: 'empty' };
  }

  notify(`✓ Found ${favoritesResult.items.length} media items. Preparing download queue…`, 'running');

  const sessionFolder = createSessionFolderName();
  let itemsToProcess = favoritesResult.items;

  // Apply limit if specified
  if (downloadLimit > 0 && itemsToProcess.length > downloadLimit) {
    itemsToProcess = itemsToProcess.slice(0, downloadLimit);
    notify(`Limited to first ${downloadLimit} items for testing.`, 'running');
  }

  const preparedQueue = prepareQueue(itemsToProcess, sessionFolder);
  if (preparedQueue.length === 0) {
    notify('Collected media but failed to prepare download queue.', 'error');
    return { status: 'empty' };
  }

  runState.runId += 1;
  const currentRunId = runState.runId;
  runState.active = true;
  runState.queue = preparedQueue;
  runState.index = 0;
  runState.results = [];
  runState.sessionFolder = sessionFolder;
  runState.total = preparedQueue.length;
  runState.completed = 0;
  snapshotProgress({ total: runState.total, completed: 0 });

  notify(
    `Starting download of ${runState.queue.length} files to ${sessionFolder}/`,
    'running',
    { total: runState.total, completed: 0 }
  );
  void processQueue(currentRunId);

  return { status: 'started', total: runState.queue.length };
}

async function collectFavorites(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: scrapeFavorites,
    args: [runState.debug],
  });
  return result || { status: 'error', message: 'Unknown scrape failure', items: [] };
}

async function processQueue(runId) {
  if (!runState.active || runId !== runState.runId) {
    return;
  }

  if (runState.index >= runState.queue.length) {
    // Check if we have items to retry
    if (runState.retryQueue.length > 0) {
      notify(`Retrying ${runState.retryQueue.length} failed downloads...`, 'running');
      await processRetries(runId);
      return;
    }

    const successes = runState.results.filter((item) => item.success).length;
    const failures = runState.results.length - successes;
    snapshotProgress({ total: runState.total, completed: runState.total });

    if (failures > 0) {
      notify(`✓ Downloads complete. Success: ${successes}, Failed: ${failures}.`, 'idle');
    } else {
      notify(`✓ All downloads complete! Success: ${successes}.`, 'idle');
    }

    finalizeRun();

    // Show unfavorite UI
    if (runState.items.length > 0) {
      sendDownloadsComplete();
    }
    return;
  }

  const item = runState.queue[runState.index];

  // Only show "Downloading X of Y" message every 10 files or in debug mode
  if (runState.debug || runState.index % 10 === 0) {
    notify(
      `Downloading ${runState.index + 1} of ${runState.queue.length}…`,
      'running',
      { total: runState.total, completed: runState.completed }
    );
  }

  try {
    const outcome = await downloadAsset(item);
    runState.results.push({ url: item.url, ...outcome });
    if (runId !== runState.runId) {
      return;
    }
    runState.completed += 1;
    const progress = snapshotProgress({ total: runState.total, completed: runState.completed });

    if (outcome.success) {
      // Only log success in debug mode
      if (runState.debug) {
        notify(`✔ Download queued for ${truncate(item.label || item.filename || item.url)}`, 'running', progress);
      }
    } else {
      // Add to retry queue
      runState.retryQueue.push(item);

      // Log failure (always show, not just in debug)
      if (runState.debug) {
        notify(
          `✖ Failed: ${truncate(item.label || item.filename || item.url)} - ${outcome.message || 'unknown error'} (will retry)`,
          'running',
          progress
        );
      } else {
        notify(
          `✖ Failed: ${truncate(item.label || item.filename || item.url)} (will retry)`,
          'running',
          progress
        );
      }
    }
  } catch (error) {
    runState.results.push({ url: item.url, success: false, message: String(error) });
    runState.completed += 1;
    const progress = snapshotProgress({ total: runState.total, completed: runState.completed });

    // Add to retry queue
    runState.retryQueue.push(item);

    // Always show errors
    notify(
      `✖ Error: ${truncate(item.label || item.filename || item.url)} - ${error.message || error} (will retry)`,
      'running',
      progress
    );
  }

  runState.index += 1;
  setTimeout(() => {
    void processQueue(runId);
  }, 350);
}

async function processRetries(runId) {
  if (!runState.active || runId !== runState.runId) {
    return;
  }

  const itemsToRetry = [...runState.retryQueue];
  runState.retryQueue = [];

  for (const item of itemsToRetry) {
    if (runId !== runState.runId) {
      return;
    }

    const itemKey = item.url;
    const currentAttempts = runState.retryAttempts.get(itemKey) || 0;

    if (currentAttempts >= MAX_RETRIES) {
      notify(
        `✖ Permanently failed: ${truncate(item.label || item.filename || item.url)} (max retries exceeded)`,
        'running'
      );
      continue;
    }

    runState.retryAttempts.set(itemKey, currentAttempts + 1);
    const attemptNum = currentAttempts + 1;

    notify(
      `Retry attempt ${attemptNum}/${MAX_RETRIES} for ${truncate(item.label || item.filename || item.url)}`,
      'running'
    );

    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));

    try {
      const outcome = await downloadAsset(item);

      if (outcome.success) {
        notify(`✔ Retry successful for ${truncate(item.label || item.filename || item.url)}`, 'running');
        // Update the failed result to success
        const resultIndex = runState.results.findIndex(r => r.url === item.url && !r.success);
        if (resultIndex !== -1) {
          runState.results[resultIndex] = { url: item.url, ...outcome };
        }
      } else {
        // Add back to retry queue if not at max retries
        if (attemptNum < MAX_RETRIES) {
          runState.retryQueue.push(item);
        }
      }
    } catch (error) {
      // Add back to retry queue if not at max retries
      if (attemptNum < MAX_RETRIES) {
        runState.retryQueue.push(item);
      }
    }
  }

  // If there are still items to retry, process them
  if (runState.retryQueue.length > 0) {
    await processRetries(runId);
  } else {
    // All retries done, finalize
    const successes = runState.results.filter((item) => item.success).length;
    const failures = runState.results.length - successes;
    snapshotProgress({ total: runState.total, completed: runState.total });

    if (failures > 0) {
      notify(`✓ Downloads complete. Success: ${successes}, Failed: ${failures}.`, 'idle');
    } else {
      notify(`✓ All downloads complete! Success: ${successes}.`, 'idle');
    }

    finalizeRun();

    // Show unfavorite UI
    if (runState.items.length > 0) {
      sendDownloadsComplete();
    }
  }
}

function downloadAsset(item) {
  return new Promise((resolve) => {
    const options = { url: item.url };
    if (item.filename) {
      options.filename = item.filename;
      options.saveAs = false;
    }

    chrome.downloads.download(options, (downloadId) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, message: chrome.runtime.lastError.message || 'Download API error.' });
        return;
      }
      if (typeof downloadId !== 'number') {
        resolve({ success: false, message: 'Download did not start (no ID returned).' });
        return;
      }
      resolve({ success: true, message: `Download started (ID ${downloadId}).` });
    });
  });
}

function sendDownloadsComplete() {
  const message = {
    type: 'DOWNLOADS_COMPLETE',
    items: runState.items.map(item => ({
      index: item.index,
      thumbnailUrl: item.thumbnailUrl,
      filename: item.filename,
      hasImage: item.hasImage,
      hasVideo: item.hasVideo,
      mediaType: item.mediaType,
    })),
  };
  if (runState.tabId != null) {
    chrome.tabs.sendMessage(runState.tabId, message, () => {
      void chrome.runtime.lastError;
    });
  }
}

async function executeUnfavorites(tabId, indices) {
  if (!Array.isArray(indices) || indices.length === 0) {
    notify('No items selected to unfavorite.', 'error');
    return;
  }

  // Map indices to groupIds (position on page, starting from 1)
  const targetGroupIds = indices.map(idx => runState.items[idx]?.groupId).filter(id => id != null);

  if (targetGroupIds.length === 0) {
    notify('No valid items to unfavorite.', 'error');
    return;
  }

  notify(`Starting unfavorite process for ${targetGroupIds.length} items at positions: ${targetGroupIds.join(', ')}...`, 'running');

  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (groupIds, clickDelay) => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const logs = [];

        logs.push(`Finding buttons for positions: ${groupIds.join(', ')}`);

        // Find scroll container
        const allDivs = Array.from(document.querySelectorAll('div'));
        const scrollContainer = allDivs.find(el => {
          const style = getComputedStyle(el);
          return (style.overflowY === 'scroll' || style.overflow === 'scroll') &&
                 el.scrollHeight > el.clientHeight + 100;
        });

        if (!scrollContainer) {
          return { success: 0, failed: groupIds.length, logs: ['No scroll container found'] };
        }

        // Scroll to top and collect all buttons
        scrollContainer.scrollTop = 0;
        await wait(500);

        const collectedButtons = [];
        const seenButtons = new Set();

        // Scroll through page collecting all buttons
        for (let attempt = 0; attempt < 100; attempt++) {
          const buttons = Array.from(document.querySelectorAll('button[aria-label="Unsave"]'));
          buttons.forEach(btn => {
            if (!seenButtons.has(btn)) {
              seenButtons.add(btn);
              collectedButtons.push(btn);
            }
          });

          const step = Math.max(280, Math.floor((window.innerHeight || 900) * 0.85));
          const oldTop = scrollContainer.scrollTop;
          const newTop = Math.min(oldTop + step, scrollContainer.scrollHeight - scrollContainer.clientHeight);

          if (newTop === oldTop) break;

          scrollContainer.scrollTop = newTop;
          await wait(400);
        }

        logs.push(`Collected ${collectedButtons.length} total buttons`);

        let success = 0;
        let failed = 0;

        // Click buttons at specified positions
        for (const groupId of groupIds) {
          const buttonIndex = groupId - 1; // Convert 1-based to 0-based

          if (buttonIndex < 0 || buttonIndex >= collectedButtons.length) {
            logs.push(`✗ Position ${groupId}: out of range`);
            failed++;
            continue;
          }

          const button = collectedButtons[buttonIndex];
          button.scrollIntoView({ block: 'center', behavior: 'instant' });
          await wait(200);
          button.click();
          logs.push(`✓ Clicked position ${groupId}`);
          success++;
          await wait(clickDelay);
        }

        return { success, failed, logs };
      },
      args: [targetGroupIds, 120],
    });

    const output = result[0]?.result || { success: 0, failed: targetGroupIds.length, logs: ['No result returned'] };

    // Show logs
    if (output.logs) {
      output.logs.forEach(log => notify(log, 'running'));
    }

    if (output.success > 0) {
      notify(`✓ Unfavorited ${output.success} items`, 'idle');
    }
    if (output.failed > 0) {
      notify(`⚠️ ${output.failed} items failed`, 'error');
    }

    // Reset items after unfavoriting
    runState.items = [];
  } catch (error) {
    notify(`Error during unfavorite: ${error.message || error}`, 'error');
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'CONTENT_READY') {
    const tabId = sender.tab?.id ?? null;
    resetForPage(tabId);
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === 'REQUEST_STATE') {
    runState.tabId = sender.tab?.id ?? runState.tabId;
    sendResponse({
      history: runState.history,
      progress: runState.progress,
      active: runState.active,
      total: runState.total,
      completed: runState.completed,
    });
    return false;
  }

  if (message?.type === 'START_DOWNLOADS') {
    const tabId = sender.tab?.id ?? null;
    handleStart(tabId, message.debugEnabled, message.limit)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ status: 'error', message: String(error) }));
    return true;
  }

  if (message?.type === 'EXECUTE_UNFAVORITES') {
    const tabId = sender.tab?.id ?? runState.tabId;
    if (!tabId) {
      sendResponse({ status: 'error', message: 'No tab ID available' });
      return false;
    }
    executeUnfavorites(tabId, message.indices)
      .then(() => sendResponse({ status: 'ok' }))
      .catch((error) => sendResponse({ status: 'error', message: String(error) }));
    return true;
  }

  if (message?.type === 'SKIP_UNFAVORITE') {
    runState.items = [];
    notify('Skipped unfavorite. All items remain favorited.', 'idle');
    sendResponse({ status: 'ok' });
    return false;
  }

  return undefined;
});

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) {
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' }, () => {
    void chrome.runtime.lastError;
  });
});

async function scrapeFavorites(debugEnabled = false) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const mediaSelector = 'img[alt*="Generated image"][src], video[src]';
  const debug = debugEnabled ? [] : null;
  const log = (message) => {
    if (debug && typeof message === 'string') {
      debug.push(message);
    }
  };

  if (!location.href.includes('/imagine')) {
    log('URL missing /imagine segment; aborting scrape.');
    return { status: 'not_ready', items: [], debug };
  }

  const getMainScrollContainer = () => {
    // Find the actual scrollable container with overflow:scroll
    const allDivs = Array.from(document.querySelectorAll('div'));
    const scrollable = allDivs.find(el => {
      const style = getComputedStyle(el);
      const hasScrollOverflow = style.overflowY === 'scroll' || style.overflow === 'scroll';
      const isScrollable = el.scrollHeight > el.clientHeight + 100;
      return hasScrollOverflow && isScrollable;
    });

    return scrollable || null;
  };

  const performHumanScrollStep = (container) => {
    if (!container) return;

    const step = Math.max(280, Math.floor((window.innerHeight || 900) * 0.9));
    const currentScrollTop = container.scrollTop || 0;
    const newScrollTop = Math.min(currentScrollTop + step, container.scrollHeight - container.clientHeight);

    container.scrollTop = newScrollTop;
  };

  const getScrollSnapshot = (container) => {
    if (!container) return { height: 0, scrollTop: 0 };
    return {
      height: container.scrollHeight || 0,
      scrollTop: container.scrollTop || 0
    };
  };

  const ensureGridVisible = async () => {
    const maxTries = 60;
    for (let attempt = 0; attempt < maxTries; attempt += 1) {
      const hasMedia = document.querySelector(mediaSelector);
      const hasGallery = document.querySelector(
        '[data-testid="drop-container"], [data-testid="favorites-scroll"], [data-radix-scroll-area-viewport]'
      );
      log(`ensureGrid attempt ${attempt + 1}: media=${hasMedia ? 'yes' : 'no'}, gallery=${hasGallery ? 'yes' : 'no'}`);
      if (hasMedia) {
        log('Media element detected; grid ready for scraping.');
        return true;
      }
      if (hasGallery) {
        log('Gallery container present but media missing; performing additional scroll.');
        const container = getMainScrollContainer();
        performHumanScrollStep(container);
        await wait(400 + Math.random() * 200);
        continue;
      }
      await wait(250 + Math.random() * 200);
    }
    log('Failed to detect favorites grid after repeated attempts.');
    return false;
  };

  const gridReady = await ensureGridVisible();
  if (!gridReady) {
    return { status: 'not_ready', items: [], debug };
  }

  const scrollContainer = getMainScrollContainer();
  if (!scrollContainer) {
    log('Could not find scrollable container');
    return { status: 'not_ready', items: [], debug };
  }

  log(`Found scroll container: scrollHeight=${scrollContainer.scrollHeight}, clientHeight=${scrollContainer.clientHeight}, scrollTop=${scrollContainer.scrollTop}`);

  // Reset scroll to top
  scrollContainer.scrollTop = 0;
  await wait(300);

  // Collect URLs as we scroll to handle virtual scrolling
  const seenUrls = new Set();
  const collectedItems = [];

  // Map to track unique containers and assign stable IDs
  const containerMap = new Map();
  let nextContainerId = 0;

  const collectVisibleMedia = () => {
    const mediaNodes = Array.from(document.querySelectorAll(mediaSelector));
    mediaNodes.forEach(node => {
      if (!node || !node.src) return;
      const url = node.currentSrc || node.src;
      if (!url || seenUrls.has(url)) return;

      seenUrls.add(url);
      const kind = node.tagName.toLowerCase() === 'video' ? 'video' : 'image';
      const poster = kind === 'video' ? (node.poster || node.getAttribute('poster') || '') : '';

      // Find the container that has the unfavorite button
      // Walk up the DOM tree until we find an element with an "Unsave" button
      let container = node.parentElement;
      while (container && container !== document.body) {
        const unsaveButton = container.querySelector('button[aria-label="Unsave"]');
        if (unsaveButton) {
          break; // Found the container with the unfavorite button
        }
        container = container.parentElement;
      }

      // If no container found, use the immediate parent
      if (!container || container === document.body) {
        container = node.parentElement;
      }

      // Assign a stable ID to this container
      let containerId;
      if (!containerMap.has(container)) {
        containerId = nextContainerId++;
        containerMap.set(container, containerId);
      } else {
        containerId = containerMap.get(container);
      }

      collectedItems.push({ url, kind, poster, containerId });
    });
  };

  const maxPasses = 320;
  let stableHeightCount = 0;
  let stableMediaCount = 0;
  let lastSnapshot = getScrollSnapshot(scrollContainer);
  let lastMediaCount = document.querySelectorAll(mediaSelector).length;
  let paginationCycles = 0;

  const tryAdvancePage = async () => {
    const selectors = [
      'button[aria-label*="Next" i]:not([disabled])',
      'button[data-testid*="next" i]:not([disabled])',
      'button[aria-disabled="false"][data-testid*="pagination"]',
      'a[rel="next"]',
    ];
    for (const selector of selectors) {
      const control = document.querySelector(selector);
      if (control) {
        log(`Advancing pagination via selector: ${selector}`);
        control.click();
        await wait(900 + Math.random() * 400);
        return true;
      }
    }
    const fallback = Array.from(document.querySelectorAll('button, a')).find((element) => {
      if (element.disabled || element.getAttribute('aria-disabled') === 'true') {
        return false;
      }
      const label = (element.getAttribute('aria-label') || '').trim();
      const text = (element.textContent || '').trim();
      return /^(next|older|more)$/i.test(label || text) || /^[>›»]+$/.test(text);
    });
    if (fallback) {
      log('Advancing pagination via fallback control.');
      fallback.click();
      await wait(900 + Math.random() * 400);
      return true;
    }
    return false;
  };

  for (let attempt = 0; attempt < maxPasses; attempt += 1) {
    // Collect visible media before scrolling
    collectVisibleMedia();

    performHumanScrollStep(scrollContainer);
    await wait(520 + Math.random() * 320);

    const currentSnapshot = getScrollSnapshot(scrollContainer);
    const currentMediaCount = document.querySelectorAll(mediaSelector).length;
    log(
      `scroll pass ${attempt + 1}: media=${currentMediaCount}, height=${currentSnapshot.height}, scrollTop=${currentSnapshot.scrollTop}, collected=${collectedItems.length}, stableHeight=${stableHeightCount}, stableMedia=${stableMediaCount}`
    );

    if (currentSnapshot.height === lastSnapshot.height && currentSnapshot.scrollTop === lastSnapshot.scrollTop) {
      stableHeightCount += 1;
    } else {
      stableHeightCount = 0;
    }

    if (currentMediaCount === lastMediaCount) {
      stableMediaCount += 1;
    } else {
      stableMediaCount = 0;
    }

    lastSnapshot = currentSnapshot;
    lastMediaCount = currentMediaCount;

    if (currentMediaCount === 0) {
      continue;
    }

    if (stableHeightCount >= 3 && stableMediaCount >= 3) {
      if (paginationCycles < 20) {
        const advanced = await tryAdvancePage();
        if (advanced) {
          paginationCycles += 1;
          stableHeightCount = 0;
          stableMediaCount = 0;
          lastSnapshot = getScrollSnapshot(scrollContainer);
          lastMediaCount = document.querySelectorAll(mediaSelector).length;
          await wait(600 + Math.random() * 300);
          continue;
        }
      }
      break;
    }
  }

  // Final collection pass
  collectVisibleMedia();
  log(`Final collection: ${collectedItems.length} total unique media items`);

  // Now process the collected items to generate proper base names
  if (collectedItems.length === 0) {
    log('No media items were collected during scrolling.');
    return { status: 'not_ready', items: [], debug };
  }

  // Group items by container to pair images and videos that belong to the same favorite
  const containerGroups = new Map();
  collectedItems.forEach((item) => {
    const key = item.containerId;
    if (!containerGroups.has(key)) {
      containerGroups.set(key, []);
    }
    containerGroups.get(key).push(item);
  });

  // Sort containers by containerId to ensure top-to-bottom order
  // then assign sequential group IDs (1, 2, 3...) to each container
  const sortedContainers = Array.from(containerGroups.entries()).sort((a, b) => a[0] - b[0]);

  const items = [];
  sortedContainers.forEach(([_containerId, mediaGroup], index) => {
    const groupId = index + 1; // Start from 1 for user-friendly numbering

    mediaGroup.forEach((item) => {
      items.push({
        url: item.url,
        kind: item.kind,
        groupId: groupId,
        poster: item.poster || ''
      });
    });
  });

  log(`Processed ${items.length} media items into ${sortedContainers.length} favorite groups.`);

  // Debug: log group statistics
  if (debugEnabled) {
    const groupSizes = new Map();
    containerGroups.forEach((mediaGroup) => {
      const size = mediaGroup.length;
      groupSizes.set(size, (groupSizes.get(size) || 0) + 1);
    });
    log(`Group size distribution: ${Array.from(groupSizes.entries()).map(([size, count]) => `${count} groups with ${size} items`).join(', ')}`);
  }

  return { status: 'ok', items, debug };
}

function prepareQueue(rawItems, sessionFolder) {
  const usedNames = new Set();

  // First, build the download queue (one entry per media file)
  // Use groupId for filename numbering so files match their position on page
  const queue = rawItems.map((item) => {
    const kind = item.kind === 'video' ? 'video' : item.kind === 'image' ? 'image' : 'other';
    const extension = deriveExtension(kind, item.url);
    const base = `${item.groupId}-${kind}`;
    const uniqueFilename = ensureUnique(`${base}${extension}`, usedNames);
    usedNames.add(uniqueFilename.toLowerCase());

    return {
      url: item.url,
      kind,
      filename: `${sessionFolder}/${uniqueFilename}`,
      label: uniqueFilename,
      groupId: item.groupId,
    };
  });

  // Now build unfavorite metadata by grouping (one entry per favorite card)
  const containerGroups = new Map();
  rawItems.forEach((item) => {
    const groupId = item.groupId || 0;
    if (!containerGroups.has(groupId)) {
      containerGroups.set(groupId, { image: null, video: null });
    }
    const group = containerGroups.get(groupId);
    if (item.kind === 'image') {
      group.image = item;
    } else if (item.kind === 'video') {
      group.video = item;
    }
  });

  // Sort by groupId to match DOM order
  const sortedGroups = Array.from(containerGroups.entries()).sort((a, b) => a[0] - b[0]);

  const items = [];
  sortedGroups.forEach(([groupId, group], index) => {
    const hasImage = !!group.image;
    const hasVideo = !!group.video;
    const mediaType = (hasImage && hasVideo) ? 'both' :
                      (hasImage && !hasVideo) ? 'image-only' :
                      (!hasImage && hasVideo) ? 'video-only' : 'unknown';

    items.push({
      index, // This maps to the unfavorite button position (one per favorite card)
      groupId,
      imageUrl: group.image?.url || null,
      videoUrl: group.video?.url || null,
      thumbnailUrl: group.image?.url || group.video?.url || null,
      hasImage,
      hasVideo,
      mediaType,
      filename: `Favorite ${groupId}`,
    });
  });

  // Store items in runState for later use
  runState.items = items;

  if (runState.debug) {
    console.log(`[Grok Downloader] Queue: ${queue.length} files, Unfavorite items: ${items.length} favorites`);
  }

  return queue;
}

function deriveExtension(kind, rawUrl) {
  try {
    const url = new URL(rawUrl);
    const lastSegment = url.pathname.split('/').filter(Boolean).pop() || '';
    const extensionMatch = lastSegment.match(/\.[a-z0-9]{2,5}$/i);
    if (extensionMatch) {
      return extensionMatch[0].toLowerCase();
    }
  } catch (_error) {
    /* noop */
  }
  if (kind === 'video') {
    return '.mp4';
  }
  if (kind === 'image') {
    return '.png';
  }
  return '.bin';
}

function ensureUnique(filename, usedNames) {
  const lower = filename.toLowerCase();
  if (!usedNames.has(lower)) {
    return filename;
  }
  const dotIndex = filename.lastIndexOf('.');
  const stem = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  const extension = dotIndex > 0 ? filename.slice(dotIndex) : '';
  let counter = 2;
  let candidate = `${stem}-${counter}${extension}`;
  while (usedNames.has(candidate.toLowerCase())) {
    counter += 1;
    candidate = `${stem}-${counter}${extension}`;
  }
  return candidate;
}

function sanitizeBaseName(raw) {
  return (raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96);
}

function createSessionFolderName() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const folder = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `grok-favorites/${folder}`;
}

function truncate(str, max = 64) {
  if (!str || str.length <= max) return str;
  return `${str.slice(0, max - 3)}...`;
}
