const OVERLAY_ID = 'da-highlight-overlay';
const LABEL_ID = 'da-highlight-label';

let overlay: HTMLDivElement | null = null;
let label: HTMLDivElement | null = null;

function ensureOverlay(): HTMLDivElement {
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 2147483640;
    border: 2px solid #7C3AED;
    background: rgba(124, 58, 237, 0.08);
    transition: all 0.05s ease-out;
    display: none;
  `;
  document.body.appendChild(overlay);

  label = document.createElement('div');
  label.id = LABEL_ID;
  label.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 2147483641;
    background: #7C3AED;
    color: white;
    font: 11px/1 -apple-system, BlinkMacSystemFont, sans-serif;
    padding: 3px 6px;
    border-radius: 3px;
    white-space: nowrap;
    display: none;
  `;
  document.body.appendChild(label);

  return overlay;
}

export function showHighlight(el: HTMLElement, selector: string, isAnnotated: boolean): void {
  const ov = ensureOverlay();
  const rect = el.getBoundingClientRect();

  const borderColor = isAnnotated ? '#9333EA' : '#7C3AED';
  const bgColor = isAnnotated ? 'rgba(147, 51, 234, 0.12)' : 'rgba(124, 58, 237, 0.08)';

  ov.style.left = rect.left + 'px';
  ov.style.top = rect.top + 'px';
  ov.style.width = rect.width + 'px';
  ov.style.height = rect.height + 'px';
  ov.style.borderColor = borderColor;
  ov.style.background = bgColor;
  ov.style.display = 'block';

  if (label) {
    label.textContent = selector + ` (${Math.round(rect.width)}×${Math.round(rect.height)})`;
    label.style.left = rect.left + 'px';
    label.style.top = Math.max(0, rect.top - 22) + 'px';
    label.style.background = borderColor;
    label.style.display = 'block';
  }
}

export function hideHighlight(): void {
  if (overlay) overlay.style.display = 'none';
  if (label) label.style.display = 'none';
}

export function pulseHighlight(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  const pulse = document.createElement('div');
  pulse.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top: ${rect.top}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    border: 2px solid #7C3AED;
    background: rgba(124, 58, 237, 0.15);
    z-index: 2147483639;
    pointer-events: none;
    animation: da-pulse 0.6s ease-out forwards;
  `;
  document.body.appendChild(pulse);
  setTimeout(() => pulse.remove(), 600);
}

export function destroyHighlight(): void {
  overlay?.remove();
  label?.remove();
  overlay = null;
  label = null;
}
