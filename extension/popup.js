/**
 * Promptotype Extension — Popup Logic
 */

const mcpDot = document.getElementById('mcp-dot');
const mcpStatus = document.getElementById('mcp-status');
const overlayDot = document.getElementById('overlay-dot');
const overlayStatus = document.getElementById('overlay-status');
const pageInfo = document.getElementById('page-info');
const pageUrl = document.getElementById('page-url');
const injectBtn = document.getElementById('inject-btn');
const errorMsg = document.getElementById('error-msg');
const toggleRow = document.getElementById('toggle-row');
const toggleInput = document.getElementById('toggle-input');
const shortcutKbd = document.getElementById('shortcut-kbd');

let mcpConnected = false;
let isInjected = false;
let currentMode = null;

const isMac = /Mac|iPhone|iPad/i.test(navigator.platform);
shortcutKbd.textContent = `${isMac ? 'Cmd' : 'Ctrl'}+Shift+D`;

const versionEl = document.getElementById('version');
if (versionEl) {
  const manifest = chrome.runtime.getManifest();
  versionEl.textContent = `v${manifest.version}`;
}

function checkHealth() {
  chrome.runtime.sendMessage({ type: 'check-health' }, (connected) => {
    mcpConnected = !!connected;
    mcpDot.className = `status-dot ${mcpConnected ? 'on' : 'off'}`;
    mcpStatus.textContent = mcpConnected ? 'Connected' : 'Not running';
    updateUI();
  });
}

function checkInjected() {
  chrome.runtime.sendMessage({ type: 'check-injected' }, (response) => {
    isInjected = response?.injected || false;
    currentMode = response?.mode ?? null;
    updateUI();
  });
}

function getPageInfo() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.url) {
      try {
        const url = new URL(tabs[0].url);
        const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
        pageInfo.style.display = 'block';
        pageUrl.textContent = url.hostname + (url.port ? ':' + url.port : '') + url.pathname;
        if (!isLocal) pageUrl.textContent += ' (non-local)';
      } catch {
        pageInfo.style.display = 'none';
      }
    }
  });
}

function updateUI() {
  injectBtn.disabled = false;

  // Overlay status row reflects injection state
  if (isInjected) {
    overlayDot.className = 'status-dot on';
    overlayStatus.textContent = 'Connected';
  } else {
    overlayDot.className = 'status-dot off';
    overlayStatus.textContent = 'Disconnected';
  }

  // Primary button = inject / uninject
  if (isInjected) {
    injectBtn.textContent = 'Deactivate';
    injectBtn.className = 'btn btn-danger';
  } else {
    injectBtn.textContent = mcpConnected ? 'Activate on Page' : 'Activate (clipboard mode)';
    injectBtn.className = 'btn btn-primary';
  }

  // Toggle = inspect ↔ inactive within an injected overlay
  toggleInput.disabled = !isInjected;
  toggleRow.classList.toggle('disabled', !isInjected);
  toggleInput.checked = isInjected && currentMode !== null && currentMode !== 'inactive';
}

injectBtn.addEventListener('click', () => {
  errorMsg.style.display = 'none';

  if (isInjected) {
    chrome.runtime.sendMessage({ type: 'remove' }, (result) => {
      if (result?.success) {
        isInjected = false;
        currentMode = null;
        updateUI();
      } else {
        showError(result?.error || 'Failed to remove overlay');
      }
    });
  } else {
    chrome.runtime.sendMessage({ type: 'inject' }, (result) => {
      if (result?.success) {
        isInjected = true;
        // Overlay auto-activates on inject → inspect mode
        currentMode = 'inspect';
        updateUI();
        window.close();
      } else {
        showError(result?.error || 'Failed to inject overlay');
      }
    });
  }
});

toggleInput.addEventListener('change', () => {
  if (!isInjected) return;
  errorMsg.style.display = 'none';
  // Optimistic: flip immediately, reconcile on response
  const desired = toggleInput.checked;
  chrome.runtime.sendMessage({ type: 'toggle' }, (result) => {
    if (result?.success) {
      currentMode = result.mode;
      updateUI();
    } else {
      // Revert
      toggleInput.checked = !desired;
      showError(result?.error || 'Failed to toggle overlay');
    }
  });
});

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = 'block';
}

// Init
checkHealth();
checkInjected();
getPageInfo();
