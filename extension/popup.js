/**
 * Promptotype Extension — Popup Logic
 */

const mcpDot = document.getElementById('mcp-dot');
const mcpStatus = document.getElementById('mcp-status');
const injectBtn = document.getElementById('inject-btn');
const errorMsg = document.getElementById('error-msg');

let mcpConnected = false;
let isInjected = false;

// Check MCP server health
function checkHealth() {
  chrome.runtime.sendMessage({ type: 'check-health' }, (connected) => {
    mcpConnected = !!connected;
    mcpDot.className = `status-dot ${mcpConnected ? 'connected' : 'disconnected'}`;
    mcpStatus.textContent = mcpConnected ? 'Connected' : 'Not running';
    updateButton();
  });
}

// Check if overlay is already injected
function checkInjected() {
  chrome.runtime.sendMessage({ type: 'check-injected' }, (response) => {
    isInjected = response?.injected || false;
    updateButton();
  });
}

// Update button state
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

// Handle inject/remove
injectBtn.addEventListener('click', () => {
  errorMsg.style.display = 'none';

  if (isInjected) {
    chrome.runtime.sendMessage({ type: 'remove' }, (result) => {
      if (result?.success) {
        isInjected = false;
        updateButton();
      } else {
        showError(result?.error || 'Failed to remove overlay');
      }
    });
  } else {
    chrome.runtime.sendMessage({ type: 'inject' }, (result) => {
      if (result?.success) {
        isInjected = true;
        updateButton();
        // Close popup after injection
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
