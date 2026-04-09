/**
 * Runtime context for Promptotype overlay.
 * Abstracts where UI elements are appended (document.body vs Shadow DOM)
 * so the same overlay code works in proxy mode and extension mode.
 */

let uiRoot: HTMLElement | null = null;
let styleRoot: HTMLElement | ShadowRoot | null = null;
let shadowHost: HTMLElement | null = null;

/**
 * Initialize the context. Call once before any UI is created.
 * - In proxy/standalone mode: call with no args (defaults to document.body)
 * - In extension mode: call with the shadow root's container and the shadow root itself
 */
export function initContext(options?: {
  uiRoot: HTMLElement;
  styleRoot: ShadowRoot;
  shadowHost: HTMLElement;
}): void {
  if (options) {
    uiRoot = options.uiRoot;
    styleRoot = options.styleRoot;
    shadowHost = options.shadowHost;
  } else {
    uiRoot = null;
    styleRoot = null;
    shadowHost = null;
  }
}

/** Where to append overlay UI elements (popovers, pins, panels, etc.) */
export function getUIRoot(): HTMLElement {
  return uiRoot ?? document.body;
}

/** Where to inject overlay CSS (animations, scrollbars). Shadow root or document.head. */
export function getStyleRoot(): HTMLElement | ShadowRoot {
  return styleRoot ?? document.head;
}

/** The shadow host element, if running in Shadow DOM mode. */
export function getShadowHost(): HTMLElement | null {
  return shadowHost;
}

/** Whether the overlay is running inside a Shadow DOM. */
export function isShadowMode(): boolean {
  return shadowHost !== null;
}
