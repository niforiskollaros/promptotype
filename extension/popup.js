/**
 * Promptotype Extension — Popup Logic
 */

const mcpDot = document.getElementById('mcp-dot');
const mcpStatus = document.getElementById('mcp-status');
const overlayStatusRow = document.getElementById('overlay-status-row');
const overlayDot = document.getElementById('overlay-dot');
const overlayStatus = document.getElementById('overlay-status');
const pageInfo = document.getElementById('page-info');
const pageUrl = document.getElementById('page-url');
const injectBtn = document.getElementById('inject-btn');
const errorMsg = document.getElementById('error-msg');

let mcpConnected = false;
let isInjected = false;

function checkHealth() {
  chrome.runtime.sendMessage({ type: 'check-health' }, (connected) => {
    mcpConnected = !!connected;
    mcpDot.className = `status-dot ${mcpConnected ? 'on' : 'off'}`;
    mcpStatus.textContent = mcpConnected ? 'Connected' : 'Not running';
    updateButton();
  });
}

function checkInjected() {
  chrome.runtime.sendMessage({ type: 'check-injected' }, (response) => {
    isInjected = response?.injected || false;
    overlayStatusRow.style.display = isInjected ? 'flex' : 'none';
    updateButton();
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

        if (!isLocal) {
          pageUrl.textContent += ' (non-local)';
        }
      } catch {
        pageInfo.style.display = 'none';
      }
    }
  });
}

function updateButton() {
  injectBtn.disabled = false;

  if (isInjected) {
    injectBtn.textContent = 'Deactivate';
    injectBtn.className = 'btn btn-danger';
  } else {
    injectBtn.textContent = mcpConnected ? 'Activate on Page' : 'Activate (clipboard mode)';
    injectBtn.className = 'btn btn-primary';
  }
}

injectBtn.addEventListener('click', () => {
  errorMsg.style.display = 'none';

  if (isInjected) {
    chrome.runtime.sendMessage({ type: 'remove' }, (result) => {
      if (result?.success) {
        isInjected = false;
        overlayStatusRow.style.display = 'none';
        updateButton();
      } else {
        showError(result?.error || 'Failed to remove overlay');
      }
    });
  } else {
    chrome.runtime.sendMessage({ type: 'inject' }, (result) => {
      if (result?.success) {
        isInjected = true;
        overlayStatusRow.style.display = 'flex';
        updateButton();
        window.close();
      } else {
        showError(result?.error || 'Failed to inject overlay');
      }
    });
  }
});

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = 'block';
}

// Init
checkHealth();
checkInjected();
getPageInfo();
