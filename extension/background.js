/**
 * Promptotype Extension — Background Service Worker
 *
 * Handles:
 * - Injecting the overlay into pages via content script
 * - Checking MCP server health
 * - Badge updates
 */

const MCP_DEFAULT_PORT = 4100;

// Check if MCP server is running
async function checkMcpHealth(port = MCP_DEFAULT_PORT) {
  try {
    const res = await fetch(`http://localhost:${port}/__pt__/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json();
      return data.mcp === true;
    }
    return false;
  } catch {
    return false;
  }
}

// Inject overlay into the active tab
async function injectOverlay(tabId) {
  try {
    // Inject the content script that creates Shadow DOM and loads the overlay
    await chrome.scripting.executeScript({
      target: { tabId },
      func: injectOverlayIntoPage,
      args: [chrome.runtime.getURL('overlay.js'), MCP_DEFAULT_PORT],
      world: 'MAIN', // Run in the page's JS context (needed for DOM access)
    });

    // Update badge
    chrome.action.setBadgeText({ text: 'ON', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#7C3AED', tabId });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// This function runs in the PAGE context (world: 'MAIN')
function injectOverlayIntoPage(overlayUrl, mcpPort) {
  // Prevent double injection
  if (document.getElementById('promptotype-root')) {
    // Already injected — just toggle
    if (window.Promptotype) {
      window.Promptotype.toggle();
    }
    return;
  }

  // Create Shadow DOM host
  const host = document.createElement('div');
  host.id = 'promptotype-root';
  host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'open' });

  // Container inside shadow for overlay UI elements
  const container = document.createElement('div');
  container.id = 'pt-shadow-container';
  container.style.cssText = 'all:initial;pointer-events:auto;';
  shadow.appendChild(container);

  document.body.appendChild(host);

  // Set MCP mode globals
  window.__PT_MCP__ = true;
  window.__PT_MCP_PORT__ = mcpPort;

  // Load the overlay IIFE
  const script = document.createElement('script');
  script.src = overlayUrl;
  script.onload = () => {
    // Initialize with Shadow DOM
    if (window.Promptotype && window.Promptotype.initWithShadowDOM) {
      window.Promptotype.initWithShadowDOM(shadow, container, host);
    }
  };
  document.head.appendChild(script);
}

// Remove overlay from the active tab
async function removeOverlay(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (window.Promptotype) {
          window.Promptotype.deactivate();
        }
        const host = document.getElementById('promptotype-root');
        if (host) host.remove();
        delete window.__PT_MCP__;
        delete window.__PT_MCP_PORT__;
      },
      world: 'MAIN',
    });

    chrome.action.setBadgeText({ text: '', tabId });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'check-health') {
    checkMcpHealth(message.port || MCP_DEFAULT_PORT).then(sendResponse);
    return true; // async response
  }

  if (message.type === 'inject') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]?.id) {
        const result = await injectOverlay(tabs[0].id);
        sendResponse(result);
      } else {
        sendResponse({ success: false, error: 'No active tab' });
      }
    });
    return true;
  }

  if (message.type === 'remove') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]?.id) {
        const result = await removeOverlay(tabs[0].id);
        sendResponse(result);
      } else {
        sendResponse({ success: false, error: 'No active tab' });
      }
    });
    return true;
  }

  if (message.type === 'check-injected') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]?.id) {
        try {
          const [result] = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => !!document.getElementById('promptotype-root'),
            world: 'MAIN',
          });
          sendResponse({ injected: result?.result || false });
        } catch {
          sendResponse({ injected: false });
        }
      } else {
        sendResponse({ injected: false });
      }
    });
    return true;
  }
});
