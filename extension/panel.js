(() => {
  if (window.__grokDownloaderPanelInjected) {
    return;
  }
  window.__grokDownloaderPanelInjected = true;

  const state = {
    open: false,
    working: false,
    history: [],
    progress: { total: 0, completed: 0 },
    allItems: [], // Store items for unfavorite selection
    showingUnfavoriteUI: false,
  };

  const panel = document.createElement('aside');
  panel.id = 'grok-downloader-panel';

  const inner = document.createElement('div');
  inner.className = 'grok-panel-inner';
  panel.appendChild(inner);

  const header = document.createElement('div');
  header.className = 'grok-header';
  inner.appendChild(header);

  const titleWrap = document.createElement('div');
  const title = document.createElement('h1');
  title.textContent = 'Grok Downloader';
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Solve any verification prompts on https://grok.com/imagine/favorites, then start the queue.';
  titleWrap.appendChild(title);
  titleWrap.appendChild(subtitle);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'grok-close';
  closeButton.setAttribute('aria-label', 'Close Grok Downloader panel');
  closeButton.textContent = '×';

  header.appendChild(titleWrap);
  header.appendChild(closeButton);

  const controls = document.createElement('div');
  controls.className = 'grok-controls';
  inner.appendChild(controls);

  const debugLabel = document.createElement('label');
  debugLabel.className = 'grok-debug-toggle';
  const debugCheckbox = document.createElement('input');
  debugCheckbox.type = 'checkbox';
  debugCheckbox.id = 'grok-debug-toggle';
  const debugText = document.createElement('span');
  debugText.textContent = 'Enable debug logs';
  debugLabel.appendChild(debugCheckbox);
  debugLabel.appendChild(debugText);

  const limitLabel = document.createElement('label');
  limitLabel.className = 'grok-limit-input';
  const limitText = document.createElement('span');
  limitText.textContent = 'Limit downloads (0 = all):';
  const limitInput = document.createElement('input');
  limitInput.type = 'number';
  limitInput.id = 'grok-limit-input';
  limitInput.min = '0';
  limitInput.placeholder = '0';
  limitInput.value = '0';
  limitLabel.appendChild(limitText);
  limitLabel.appendChild(limitInput);

  const startButton = document.createElement('button');
  startButton.id = 'grok-start';
  startButton.type = 'button';
  startButton.textContent = 'Start Download';

  controls.appendChild(debugLabel);
  controls.appendChild(limitLabel);
  controls.appendChild(startButton);

  const progressContainer = document.createElement('div');
  progressContainer.className = 'grok-progress';
  progressContainer.hidden = true;
  const progressTrack = document.createElement('div');
  progressTrack.className = 'grok-progress-track';
  const progressFill = document.createElement('div');
  progressFill.className = 'grok-progress-fill';
  progressTrack.appendChild(progressFill);
  const progressLabel = document.createElement('span');
  progressLabel.className = 'grok-progress-label';
  progressLabel.textContent = '0 / 0';
  progressContainer.appendChild(progressTrack);
  progressContainer.appendChild(progressLabel);
  inner.appendChild(progressContainer);

  const statusBox = document.createElement('div');
  statusBox.className = 'grok-status';
  inner.appendChild(statusBox);

  const footer = document.createElement('div');
  footer.className = 'grok-footer';
  footer.textContent = 'Downloads will be saved under grok-favorites/<timestamp>/ via Chrome downloads.';
  inner.appendChild(footer);

  // Unfavorite View (hidden initially)
  const unfavoriteView = document.createElement('div');
  unfavoriteView.id = 'grok-unfavorite-view';
  unfavoriteView.className = 'grok-unfavorite-view';
  unfavoriteView.hidden = true;
  unfavoriteView.innerHTML = `
    <h3>✓ Downloads Complete!</h3>
    <p><span id="grok-total-count">0</span> favorites downloaded successfully.</p>

    <div class="grok-unfav-options">
      <label>Unfavorite:</label>
      <div class="grok-filter-group">
        <button id="grok-unfav-all" class="grok-filter-btn" type="button">All</button>
        <button id="grok-unfav-first-100" class="grok-filter-btn" type="button">First 100</button>
        <button id="grok-unfav-first-200" class="grok-filter-btn" type="button">First 200</button>
        <button id="grok-unfav-first-300" class="grok-filter-btn" type="button">First 300</button>
      </div>
      <div class="grok-filter-group">
        <button id="grok-unfav-last-100" class="grok-filter-btn" type="button">Last 100</button>
        <button id="grok-unfav-last-200" class="grok-filter-btn" type="button">Last 200</button>
        <button id="grok-unfav-last-300" class="grok-filter-btn" type="button">Last 300</button>
      </div>
    </div>

    <button id="grok-skip-unfavorite" class="grok-skip-btn" type="button">Skip (Keep All Favorited)</button>
  `;
  inner.appendChild(unfavoriteView);

  document.body.appendChild(panel);

  const maxHistory = 400;

  function renderEntry(entry) {
    const line = document.createElement('div');
    line.className = 'grok-status-entry';
    if (entry.state === 'debug') {
      line.classList.add('debug');
    }
    const time = new Date(entry.timestamp || Date.now()).toLocaleTimeString();
    line.textContent = `[${time}] ${entry.text}`;
    statusBox.appendChild(line);
  }

  function pushHistory(entry) {
    state.history.push(entry);
    if (state.history.length > maxHistory) {
      state.history.splice(0, state.history.length - maxHistory);
    }
    if (state.open) {
      renderEntry(entry);
      statusBox.scrollTop = statusBox.scrollHeight;
    }
  }

  function renderHistory() {
    if (!state.open) {
      return;
    }
    statusBox.innerHTML = '';
    state.history.forEach((entry) => renderEntry(entry));
    statusBox.scrollTop = statusBox.scrollHeight;
  }

  function setWorking(working) {
    state.working = working;
    startButton.disabled = working;
    startButton.textContent = working ? 'Running…' : 'Start Download';
  }

  function updateProgress(progress) {
    if (!progress || !progress.total) {
      progressContainer.hidden = true;
      progressFill.style.width = '0%';
      progressLabel.textContent = '0 / 0';
      state.progress = { total: 0, completed: 0 };
      return;
    }
    state.progress = {
      total: progress.total,
      completed: Math.min(progress.completed ?? 0, progress.total),
    };
    const percentage = Math.min(100, Math.round((state.progress.completed / state.progress.total) * 100));
    progressContainer.hidden = false;
    progressFill.style.width = `${percentage}%`;
    progressLabel.textContent = `${state.progress.completed} / ${state.progress.total}`;
  }

  function setPanelOpen(open) {
    if (state.open === open) {
      return;
    }
    state.open = open;
    panel.classList.toggle('open', open);
    document.body.classList.toggle('grok-downloader-panel-open', open);
    if (open) {
      // Ensure unfavorite view is hidden when opening panel
      if (!state.showingUnfavoriteUI) {
        unfavoriteView.hidden = true;
        controls.hidden = false;
        statusBox.hidden = false;
        footer.hidden = false;
      }
      renderHistory();
      if (state.history.length) {
        statusBox.scrollTop = statusBox.scrollHeight;
      }
      requestState();
    }
  }

  function requestState() {
    chrome.runtime.sendMessage({ type: 'REQUEST_STATE' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        return;
      }
      const { history, progress, active } = response;
      if (Array.isArray(history)) {
        state.history = history.slice(-maxHistory);
        renderHistory();
      }
      updateProgress(progress);
      setWorking(Boolean(active));
    });
  }

  function togglePanel() {
    setPanelOpen(!state.open);
  }

  closeButton.addEventListener('click', () => {
    setPanelOpen(false);
  });

  startButton.addEventListener('click', () => {
    if (state.working) {
      return;
    }
    setWorking(true);
    const limit = parseInt(limitInput.value) || 0;
    chrome.runtime.sendMessage(
      {
        type: 'START_DOWNLOADS',
        debugEnabled: Boolean(debugCheckbox.checked),
        limit: limit,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          setWorking(false);
          const errorMsg = chrome.runtime.lastError.message || 'Unexpected runtime error.';
          const entry = { text: `Error: ${errorMsg}`, state: 'error', timestamp: Date.now() };
          pushHistory(entry);
          return;
        }
        if (!response) {
          setWorking(false);
          pushHistory({ text: 'No response from background.', state: 'error', timestamp: Date.now() });
          return;
        }
        if (response.status === 'started') {
          setPanelOpen(true);
        } else if (response.status === 'need_tab') {
          setWorking(false);
          pushHistory({
            text: 'Open the favorites page before starting.',
            state: 'error',
            timestamp: Date.now(),
          });
        } else if (response.status === 'empty') {
          setWorking(false);
          pushHistory({
            text: 'Could not find any favorites on this page.',
            state: 'error',
            timestamp: Date.now(),
          });
        } else if (response.status === 'busy') {
          setPanelOpen(true);
          pushHistory({ text: 'A download run is already in progress.', state: 'info', timestamp: Date.now() });
        } else if (response.status === 'error') {
          setWorking(false);
          pushHistory({
            text: response.message || 'Unexpected error.',
            state: 'error',
            timestamp: Date.now(),
          });
        }
      }
    );
  });

  // Unfavorite UI functions
  function formatMediaType(type) {
    const labels = {
      'both': '🖼️ + 🎬',
      'image-only': '🖼️ only',
      'video-only': '🎬 only'
    };
    return labels[type] || type;
  }

  function showUnfavoriteView(items) {
    if (!items || items.length === 0) {
      return; // Don't show unfavorite UI if no items
    }

    state.allItems = items;
    state.showingUnfavoriteUI = true;

    // Hide download view elements (but keep statusBox visible for logs)
    controls.hidden = true;
    progressContainer.hidden = true;
    footer.hidden = true;

    // Show unfavorite view
    unfavoriteView.hidden = false;

    // Update count
    unfavoriteView.querySelector('#grok-total-count').textContent = items.length;

    // Attach event listeners
    setupUnfavoriteEventListeners();
  }

  function hideUnfavoriteView() {
    state.showingUnfavoriteUI = false;
    state.allItems = [];

    // Show download view elements
    controls.hidden = false;
    statusBox.hidden = false;
    footer.hidden = false;

    // Hide unfavorite view
    unfavoriteView.hidden = true;
  }

  function setupUnfavoriteEventListeners() {
    const executeUnfavorite = (indices, description) => {
      if (indices.length === 0) {
        pushHistory({ text: 'No items to unfavorite', state: 'error', timestamp: Date.now() });
        return;
      }

      pushHistory({ text: `Starting unfavorite for ${description} (${indices.length} items)...`, state: 'info', timestamp: Date.now() });

      chrome.runtime.sendMessage({
        type: 'EXECUTE_UNFAVORITES',
        indices: indices
      }, (response) => {
        if (chrome.runtime.lastError || response?.status === 'error') {
          const errorMsg = chrome.runtime.lastError?.message || response?.message || 'Unknown error';
          pushHistory({ text: `Error: ${errorMsg}`, state: 'error', timestamp: Date.now() });
          return;
        }

        pushHistory({
          text: `✓ Unfavorite complete`,
          state: 'info',
          timestamp: Date.now(),
        });

        hideUnfavoriteView();
      });
    };

    // Unfavorite All
    unfavoriteView.querySelector('#grok-unfav-all').addEventListener('click', () => {
      const allIndices = Array.from({ length: state.allItems.length }, (_, i) => i);
      executeUnfavorite(allIndices, 'all');
    });

    // Unfavorite First X
    unfavoriteView.querySelector('#grok-unfav-first-100').addEventListener('click', () => {
      const indices = Array.from({ length: Math.min(100, state.allItems.length) }, (_, i) => i);
      executeUnfavorite(indices, 'first 100');
    });

    unfavoriteView.querySelector('#grok-unfav-first-200').addEventListener('click', () => {
      const indices = Array.from({ length: Math.min(200, state.allItems.length) }, (_, i) => i);
      executeUnfavorite(indices, 'first 200');
    });

    unfavoriteView.querySelector('#grok-unfav-first-300').addEventListener('click', () => {
      const indices = Array.from({ length: Math.min(300, state.allItems.length) }, (_, i) => i);
      executeUnfavorite(indices, 'first 300');
    });

    // Unfavorite Last X
    unfavoriteView.querySelector('#grok-unfav-last-100').addEventListener('click', () => {
      const count = Math.min(100, state.allItems.length);
      const startIndex = state.allItems.length - count;
      const indices = Array.from({ length: count }, (_, i) => startIndex + i);
      executeUnfavorite(indices, 'last 100');
    });

    unfavoriteView.querySelector('#grok-unfav-last-200').addEventListener('click', () => {
      const count = Math.min(200, state.allItems.length);
      const startIndex = state.allItems.length - count;
      const indices = Array.from({ length: count }, (_, i) => startIndex + i);
      executeUnfavorite(indices, 'last 200');
    });

    unfavoriteView.querySelector('#grok-unfav-last-300').addEventListener('click', () => {
      const count = Math.min(300, state.allItems.length);
      const startIndex = state.allItems.length - count;
      const indices = Array.from({ length: count }, (_, i) => startIndex + i);
      executeUnfavorite(indices, 'last 300');
    });

    // Skip button
    unfavoriteView.querySelector('#grok-skip-unfavorite').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'SKIP_UNFAVORITE' }, () => {
        void chrome.runtime.lastError;
        hideUnfavoriteView();
      });
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'TOGGLE_PANEL') {
      togglePanel();
      sendResponse?.({ ok: true });
      return true;
    }
    if (message?.type === 'DOWNLOADS_COMPLETE') {
      if (Array.isArray(message.items) && message.items.length > 0) {
        showUnfavoriteView(message.items);
      }
      sendResponse?.({ ok: true });
      return true;
    }
    if (message?.type === 'STATUS') {
      const timestamp = message.timestamp || Date.now();
      const baseState = message.state || 'info';
      const entry = {
        text: message.text || '',
        state: baseState,
        timestamp,
      };
      if (message.progress) {
        updateProgress(message.progress);
      }
      if (baseState === 'idle') {
        setWorking(false);
      } else if (baseState === 'running' && !state.working && message.progress && message.progress.total) {
        setWorking(true);
      }
      if (baseState === 'debug') {
        entry.state = 'debug';
      }
      pushHistory(entry);
      sendResponse?.({ ok: true });
      return true;
    }
    return undefined;
  });

  chrome.runtime.sendMessage({ type: 'CONTENT_READY' }, () => {
    state.history = [];
    updateProgress(null);
    setWorking(false);
    if (state.open) {
      renderHistory();
    }
  });
})();
