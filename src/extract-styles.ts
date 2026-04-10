import { ExtractedStyles, SourceLocation } from './types';

function rgbToHex(color: string): string {
  // Handle rgb/rgba directly
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  // For modern color formats (lab, oklch, oklab, lch, etc.),
  // use canvas to force conversion to hex
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx) {
      ctx.fillStyle = color;
      const result = ctx.fillStyle; // Canvas normalizes to #rrggbb or rgb()
      if (result.startsWith('#')) return result.toUpperCase();
      // Canvas might return rgb() — recurse once
      const rgbMatch = result.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (rgbMatch) {
        return '#' + [rgbMatch[1], rgbMatch[2], rgbMatch[3]]
          .map(v => parseInt(v).toString(16).padStart(2, '0'))
          .join('').toUpperCase();
      }
    }
  } catch {}

  return color; // Return as-is if conversion fails
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
