import { tokens } from './styles';

const OVERLAY_ID = 'pt-highlight-overlay';
const LABEL_ID = 'pt-highlight-label';
const MARGIN_ID = 'pt-highlight-margin';
const PADDING_ID = 'pt-highlight-padding';

let overlay: HTMLDivElement | null = null;
let label: HTMLDivElement | null = null;
let marginBox: HTMLDivElement | null = null;
let paddingBox: HTMLDivElement | null = null;

function ensureElements(): void {
  if (overlay) return;

  // Margin visualization (outermost)
  marginBox = document.createElement('div');
  marginBox.id = MARGIN_ID;
  marginBox.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: ${tokens.z.highlight};
    background: ${tokens.color.highlight.margin};
    display: none;
  `;
  document.body.appendChild(marginBox);

  // Main element border
  overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: ${tokens.z.highlight};
    border: 2px solid ${tokens.color.highlight.border};
    background: ${tokens.color.highlight.fill};
    transition: left ${tokens.transition.fast}, top ${tokens.transition.fast},
                width ${tokens.transition.fast}, height ${tokens.transition.fast};
    display: none;
  `;
  document.body.appendChild(overlay);

  // Padding visualization (innermost)
  paddingBox = document.createElement('div');
  paddingBox.id = PADDING_ID;
  paddingBox.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: ${tokens.z.highlight};
    background: ${tokens.color.highlight.padding};
    display: none;
  `;
  document.body.appendChild(paddingBox);

  // Label
  label = document.createElement('div');
  label.id = LABEL_ID;
  label.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: ${tokens.z.highlightLabel};
    background: ${tokens.color.primary[600]};
    color: white;
    font: ${tokens.font.weight.medium} ${tokens.font.size.xs}/${tokens.font.lineHeight.tight} ${tokens.font.family};
    padding: 3px 8px;
    border-radius: ${tokens.radius.sm};
    white-space: nowrap;
    display: none;
    box-shadow: ${tokens.shadow.sm};
    letter-spacing: 0.2px;
  `;
  document.body.appendChild(label);
}

export function showHighlight(el: HTMLElement, selector: string, isAnnotated: boolean): void {
  ensureElements();
  const rect = el.getBoundingClientRect();
  const computed = window.getComputedStyle(el);

  const borderColor = isAnnotated ? tokens.color.primary[500] : tokens.color.highlight.border;
  const bgColor = isAnnotated ? tokens.color.highlight.fillAnnotated : tokens.color.highlight.fill;

  // Main overlay
  overlay!.style.left = rect.left + 'px';
  overlay!.style.top = rect.top + 'px';
  overlay!.style.width = rect.width + 'px';
  overlay!.style.height = rect.height + 'px';
  overlay!.style.borderColor = borderColor;
  overlay!.style.background = bgColor;
  overlay!.style.display = 'block';

  // Margin visualization
  const mt = parseFloat(computed.marginTop) || 0;
  const mr = parseFloat(computed.marginRight) || 0;
  const mb = parseFloat(computed.marginBottom) || 0;
  const ml = parseFloat(computed.marginLeft) || 0;
  const hasMargin = mt || mr || mb || ml;

  if (hasMargin && marginBox) {
    marginBox.style.left = (rect.left - ml) + 'px';
    marginBox.style.top = (rect.top - mt) + 'px';
    marginBox.style.width = (rect.width + ml + mr) + 'px';
    marginBox.style.height = (rect.height + mt + mb) + 'px';
    marginBox.style.display = 'block';
    // Cut out the center with clip-path
    const innerL = ml;
    const innerT = mt;
    const innerR = ml + rect.width;
    const innerB = mt + rect.height;
    const outerW = rect.width + ml + mr;
    const outerH = rect.height + mt + mb;
    marginBox.style.clipPath = `polygon(
      0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
      ${innerL}px ${innerT}px, ${innerL}px ${innerB}px, ${innerR}px ${innerB}px, ${innerR}px ${innerT}px, ${innerL}px ${innerT}px
    )`;
  } else if (marginBox) {
    marginBox.style.display = 'none';
  }

  // Padding visualization
  const pt = parseFloat(computed.paddingTop) || 0;
  const pr = parseFloat(computed.paddingRight) || 0;
  const pb = parseFloat(computed.paddingBottom) || 0;
  const pl = parseFloat(computed.paddingLeft) || 0;
  const hasPadding = pt || pr || pb || pl;

  if (hasPadding && paddingBox) {
    paddingBox.style.left = rect.left + 'px';
    paddingBox.style.top = rect.top + 'px';
    paddingBox.style.width = rect.width + 'px';
    paddingBox.style.height = rect.height + 'px';
    paddingBox.style.display = 'block';
    const contentL = pl;
    const contentT = pt;
    const contentR = rect.width - pr;
    const contentB = rect.height - pb;
    paddingBox.style.clipPath = `polygon(
      0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
      ${contentL}px ${contentT}px, ${contentL}px ${contentB}px, ${contentR}px ${contentB}px, ${contentR}px ${contentT}px, ${contentL}px ${contentT}px
    )`;
  } else if (paddingBox) {
    paddingBox.style.display = 'none';
  }

  // Label
  if (label) {
    const dims = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    label.textContent = `${selector}  ${dims}`;
    label.style.left = rect.left + 'px';
    label.style.top = Math.max(0, rect.top - 26) + 'px';
    label.style.background = borderColor;
    label.style.display = 'block';
  }
}

export function hideHighlight(): void {
  if (overlay) overlay.style.display = 'none';
  if (label) label.style.display = 'none';
  if (marginBox) marginBox.style.display = 'none';
  if (paddingBox) paddingBox.style.display = 'none';
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
    border: 2px solid ${tokens.color.primary[500]};
    background: rgba(168, 85, 247, 0.12);
    z-index: ${tokens.z.highlight};
    pointer-events: none;
    border-radius: ${tokens.radius.sm};
    animation: pt-pulse-highlight 0.6s ease-out forwards;
  `;
  document.body.appendChild(pulse);
  setTimeout(() => pulse.remove(), 600);
}

export function destroyHighlight(): void {
  overlay?.remove();
  label?.remove();
  marginBox?.remove();
  paddingBox?.remove();
  overlay = null;
  label = null;
  marginBox = null;
  paddingBox = null;
}
