import { ExtractedStyles, SourceLocation } from './types';

// Reusable 1x1 canvas for color conversion
let _colorCanvas: HTMLCanvasElement | null = null;
let _colorCtx: CanvasRenderingContext2D | null = null;

function getColorCtx(): CanvasRenderingContext2D | null {
  if (!_colorCtx) {
    _colorCanvas = document.createElement('canvas');
    _colorCanvas.width = 1;
    _colorCanvas.height = 1;
    _colorCtx = _colorCanvas.getContext('2d', { willReadFrequently: true });
  }
  return _colorCtx;
}

function rgbToHex(color: string): string {
  // Handle rgb/rgba directly
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return '#' + [match[1], match[2], match[3]]
      .map(v => parseInt(v).toString(16).padStart(2, '0'))
      .join('').toUpperCase();
  }

  // Already hex
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.toUpperCase();

  // For modern color formats (lab, oklch, oklab, lch, etc.),
  // paint a pixel and read back as RGB
  try {
    const ctx = getColorCtx();
    if (ctx) {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    }
  } catch {}

  return color;
}

export function extractStyles(el: HTMLElement): ExtractedStyles {
  const computed = window.getComputedStyle(el);

  return {
    font: {
      family: computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
      size: computed.fontSize,
      weight: computed.fontWeight,
      lineHeight: computed.lineHeight,
    },
    color: {
      text: rgbToHex(computed.color),
      background: rgbToHex(computed.backgroundColor),
    },
    spacing: {
      margin: `${computed.marginTop} ${computed.marginRight} ${computed.marginBottom} ${computed.marginLeft}`,
      padding: `${computed.paddingTop} ${computed.paddingRight} ${computed.paddingBottom} ${computed.paddingLeft}`,
    },
    alignment: {
      textAlign: computed.textAlign,
      display: computed.display,
      alignItems: computed.alignItems,
      justifyContent: computed.justifyContent,
    },
  };
}

/**
 * Extract source location from a DOM element.
 * Tries multiple strategies in order:
 * 1. data-pt-* attributes (companion Vite plugin)
 * 2. data-inspector-* attributes (react-dev-inspector)
 * 3. React Fiber _debugSource (React < 19, dev mode)
 */
export function extractSourceLocation(el: HTMLElement): SourceLocation | null {
  // Strategy 1: data-pt-* attributes (companion plugin)
  const ptFile = el.getAttribute('data-pt-file') || el.getAttribute('data-dev-file');
  const ptLine = el.getAttribute('data-pt-line') || el.getAttribute('data-dev-line');
  if (ptFile && ptLine) {
    return {
      fileName: el.getAttribute('data-pt-path') || el.getAttribute('data-dev-path') || ptFile,
      lineNumber: parseInt(ptLine, 10),
      componentName: el.getAttribute('data-pt-component') || el.getAttribute('data-dev-component') || undefined,
    };
  }

  // Strategy 2: data-inspector-* attributes (react-dev-inspector babel plugin)
  const inspectorPath = el.getAttribute('data-inspector-relative-path');
  const inspectorLine = el.getAttribute('data-inspector-line');
  if (inspectorPath && inspectorLine) {
    return {
      fileName: inspectorPath,
      lineNumber: parseInt(inspectorLine, 10),
      columnNumber: parseInt(el.getAttribute('data-inspector-column') || '0', 10) || undefined,
    };
  }

  // Strategy 3: React Fiber _debugSource (React < 19, dev mode)
  // Walk up from the element to find the nearest fiber with source info
  let current: HTMLElement | null = el;
  while (current) {
    const source = getReactFiberSource(current);
    if (source) return source;
    current = current.parentElement;
  }

  return null;
}

/**
 * Read React Fiber _debugSource from a DOM element.
 * React attaches fibers with randomized keys like __reactFiber$abc123.
 */
function getReactFiberSource(el: HTMLElement): SourceLocation | null {
  try {
    const fiberKey = Object.keys(el).find(k =>
      k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
    );
    if (!fiberKey) return null;

    let fiber = (el as any)[fiberKey];

    // Walk up the fiber tree to find one with _debugSource
    let maxDepth = 15;
    while (fiber && maxDepth-- > 0) {
      if (fiber._debugSource) {
        const src = fiber._debugSource;
        return {
          fileName: src.fileName || src.file || '',
          lineNumber: src.lineNumber || src.line || 0,
          columnNumber: src.columnNumber || src.col || undefined,
          componentName: getComponentName(fiber),
        };
      }
      fiber = fiber._debugOwner || fiber.return;
    }
  } catch {
    // Fiber access can throw in edge cases — fail silently
  }
  return null;
}

/** Extract component name from a React Fiber node. */
function getComponentName(fiber: any): string | undefined {
  try {
    if (!fiber?.type) return undefined;
    if (typeof fiber.type === 'string') return fiber.type; // HTML element
    return fiber.type.displayName || fiber.type.name || undefined;
  } catch {
    return undefined;
  }
}

/** Extract CSS classes from an element, filtering out Promptotype's own classes. */
export function extractCssClasses(el: HTMLElement): string[] {
  if (!el.className || typeof el.className !== 'string') return [];
  return el.className.trim().split(/\s+/).filter(c => c && !c.startsWith('pt-'));
}

/** Extract meaningful text content from an element (first 100 chars, first text node only). */
export function extractTextContent(el: HTMLElement): string {
  // Get direct text (not children's text)
  let text = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent?.trim();
      if (t) { text = t; break; }
    }
  }
  // Fallback to innerText if no direct text node
  if (!text) {
    text = el.innerText?.trim() || '';
  }
  // Truncate
  if (text.length > 100) text = text.slice(0, 100) + '...';
  return text;
}

/**
 * Capture a screenshot of an element.
 * In extension mode, this requests a capture from the background script
 * via a custom event. Returns null if not available.
 */
export async function captureElementScreenshot(el: HTMLElement): Promise<string | null> {
  try {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    // Request screenshot from extension background script via custom event
    return new Promise<string | null>((resolve) => {
      const requestId = 'pt-capture-' + Date.now();

      // Listen for the response
      const handler = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.requestId === requestId) {
          window.removeEventListener('__pt_screenshot_response', handler);
          resolve(detail.dataUrl || null);
        }
      };
      window.addEventListener('__pt_screenshot_response', handler);

      // Dispatch request
      window.dispatchEvent(new CustomEvent('__pt_screenshot_request', {
        detail: {
          requestId,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          dpr: window.devicePixelRatio || 1,
        },
      }));

      // Timeout — don't block forever if extension isn't handling screenshots
      setTimeout(() => {
        window.removeEventListener('__pt_screenshot_response', handler);
        resolve(null);
      }, 3000);
    });
  } catch {
    return null;
  }
}

export function generateSelector(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const classes = el.className && typeof el.className === 'string'
    ? '.' + el.className.trim().split(/\s+/).filter(c => !c.startsWith('pt-')).slice(0, 2).join('.')
    : '';

  if (id) return `${tag}${id}`;
  if (classes && classes !== '.') return `${tag}${classes}`;
  return tag;
}
