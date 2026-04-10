/**
 * Content script bridge (ISOLATED world).
 * Relays screenshot requests between the page (MAIN world) and the background script.
 */

// Listen for screenshot requests from the page
window.addEventListener('__pt_screenshot_request', async (e) => {
  const { requestId, rect, dpr } = e.detail;

  try {
    // Ask background to capture the visible tab
    const response = await chrome.runtime.sendMessage({
      type: 'capture-screenshot',
      rect,
      dpr,
    });

    // Send the cropped screenshot back to the page
    window.dispatchEvent(new CustomEvent('__pt_screenshot_response', {
      detail: { requestId, dataUrl: response?.dataUrl || null },
    }));
  } catch {
    window.dispatchEvent(new CustomEvent('__pt_screenshot_response', {
      detail: { requestId, dataUrl: null },
    }));
  }
});
