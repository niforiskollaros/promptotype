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
    // Step 1: create Shadow DOM in MAIN world and store refs on window
    const [setupResult] = await chrome.scripting.executeScript({
      target: { tabId },
      func: setupShadowDOM,
      args: [MCP_DEFAULT_PORT],
      world: 'MAIN',
    });

    // If already injected, setupShadowDOM toggled the overlay — nothing more to do.
    if (setupResult?.result?.alreadyInjected) {
      chrome.action.setBadgeText({ text: 'ON', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#7C3AED', tabId });
      return { success: true };
    }

    // Step 2: inject overlay.js directly via the scripting API (bypasses page CSP).
    // This works on both Mac and Windows — unlike a dynamic <script src="chrome-extension://…">
    // which can be blocked by the page's Content-Security-Policy on Windows.
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['overlay.js'],
      world: 'MAIN',
    });

    // Step 3: initialize the overlay with the Shadow DOM refs stored in step 1
    await chrome.scripting.executeScript({
      target: { tabId },
      func: initOverlay,
      world: 'MAIN',
    });

    chrome.action.setBadgeText({ text: 'ON', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#7C3AED', tabId });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Runs in MAIN world: sets up Shadow DOM host and stores refs on window for initOverlay.
function setupShadowDOM(mcpPort) {
  if (document.getElementById('promptotype-root')) {
    if (window.Promptotype) {
      window.Promptotype.toggle();
    }
    return { alreadyInjected: true };
  }

  const host = document.createElement('div');
  host.id = 'promptotype-root';
  host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'open' });

  const container = document.createElement('div');
  container.id = 'pt-shadow-container';
  container.style.cssText = 'all:initial;pointer-events:auto;';
  shadow.appendChild(container);

  document.body.appendChild(host);

  window.__PT_MCP__ = true;
  window.__PT_MCP_PORT__ = mcpPort;

  // Store refs so initOverlay (next executeScript call) can find them
  window.__PT_SHADOW__ = shadow;
  window.__PT_CONTAINER__ = container;
  window.__PT_HOST__ = host;

  return { alreadyInjected: false };
}

// Runs in MAIN world AFTER overlay.js has defined window.Promptotype.
function initOverlay() {
  if (window.Promptotype && window.Promptotype.initWithShadowDOM) {
    window.Promptotype.initWithShadowDOM(
      window.__PT_SHADOW__,
      window.__PT_CONTAINER__,
      window.__PT_HOST__
    );
  }
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
        delete window.__PT_SHADOW__;
        delete window.__PT_CONTAINER__;
        delete window.__PT_HOST__;
      },
      world: 'MAIN',
    });

    chrome.action.setBadgeText({ text: '', tabId });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Crop a full-page screenshot to an element's bounding rect
async function cropScreenshot(fullDataUrl, rect, dpr) {
  const img = await createImageBitmap(await (await fetch(fullDataUrl)).blob());

  const padding = 8;
  const x = Math.max(0, Math.round((rect.x - padding) * dpr));
  const y = Math.max(0, Math.round((rect.y - padding) * dpr));
  const w = Math.min(Math.round((rect.width + padding * 2) * dpr), img.width - x);
  const h = Math.min(Math.round((rect.height + padding * 2) * dpr), img.height - y);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'capture-screenshot') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ dataUrl: null });
      return true;
    }

    chrome.tabs.captureVisibleTab(null, { format: 'png' }, async (fullDataUrl) => {
      if (chrome.runtime.lastError || !fullDataUrl) {
        sendResponse({ dataUrl: null });
        return;
      }
      try {
        const cropped = await cropScreenshot(fullDataUrl, message.rect, message.dpr);
        sendResponse({ dataUrl: cropped });
      } catch {
        sendResponse({ dataUrl: null });
      }
    });
    return true;
  }

  if (message.type === 'check-health') {
    checkMcpHealth(message.port || MCP_DEFAULT_PORT).then(sendResponse);
    return true;
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
            func: () => {
              const injected = !!document.getElementById('promptotype-root');
              const mode = window.Promptotype?.getMode?.() ?? null;
              return { injected, mode };
            },
            world: 'MAIN',
          });
          sendResponse({
            injected: result?.result?.injected || false,
            mode: result?.result?.mode ?? null,
          });
        } catch {
          sendResponse({ injected: false, mode: null });
        }
      } else {
        sendResponse({ injected: false, mode: null });
      }
    });
    return true;
  }

  if (message.type === 'toggle') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]?.id) {
        try {
          const [result] = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
              if (!window.Promptotype) return { success: false, mode: null };
              window.Promptotype.toggle();
              return { success: true, mode: window.Promptotype.getMode?.() ?? null };
            },
            world: 'MAIN',
          });
          sendResponse(result?.result || { success: false, mode: null });
        } catch (err) {
          sendResponse({ success: false, mode: null, error: err.message });
        }
      } else {
        sendResponse({ success: false, mode: null, error: 'No active tab' });
      }
    });
    return true;
  }
});
