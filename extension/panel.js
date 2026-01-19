(() => {
  // Versioned injection guard prevents conflicts with older versions
  const INJECTED_KEY = '__grokDownloaderInjected_v1__';
  if (window[INJECTED_KEY]) {
    return;
  }
  window[INJECTED_KEY] = true;

  const state = {
    open: false,
    working: false,
    history: [],
    progress: { total: 0, completed: 0 },
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

  const mediaTypeLabel = document.createElement('label');
  mediaTypeLabel.className = 'grok-media-type';
  const mediaTypeText = document.createElement('span');
  mediaTypeText.textContent = 'Media type:';
  const mediaTypeSelect = document.createElement('select');
  mediaTypeSelect.id = 'grok-media-type';
  const optAll = document.createElement('option');
  optAll.value = 'all';
  optAll.textContent = 'All';
  optAll.selected = true;
  const optImages = document.createElement('option');
  optImages.value = 'image';
  optImages.textContent = 'Images only';
  const optVideos = document.createElement('option');
  optVideos.value = 'video';
  optVideos.textContent = 'Videos only';
  mediaTypeSelect.appendChild(optAll);
  mediaTypeSelect.appendChild(optImages);
  mediaTypeSelect.appendChild(optVideos);
  mediaTypeLabel.appendChild(mediaTypeText);
  mediaTypeLabel.appendChild(mediaTypeSelect);

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
  controls.appendChild(mediaTypeLabel);
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
    const mediaType = mediaTypeSelect.value;
    chrome.runtime.sendMessage(
      {
        type: 'START_DOWNLOADS',
        debugEnabled: Boolean(debugCheckbox.checked),
        limit: limit,
        mediaType: mediaType,
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

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'TOGGLE_PANEL') {
      togglePanel();
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
