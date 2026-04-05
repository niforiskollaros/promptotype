import { Annotation, Mode } from './types';
import { extractStyles, generateSelector } from './extract-styles';
import { showHighlight, hideHighlight, destroyHighlight } from './highlight-overlay';
import { updateBreadcrumb, hideBreadcrumb, destroyBreadcrumb } from './breadcrumb-bar';
import { showPopover, hidePopover, isPopoverOpen } from './annotation-popover';
import { updateAllPins, clearAllPins, onPinClick } from './pin-markers';
import { updateStatusBar, destroyStatusBar } from './status-bar';
import { showReviewPanel, hideReviewPanel, isReviewOpen } from './review-panel';
import { generateMarkdown, copyToClipboard } from './output';

// --- State ---
let mode: Mode = 'inactive';
let annotations: Annotation[] = [];
let hoveredElement: HTMLElement | null = null;
let depthStack: HTMLElement[] = [];
let depthIndex = 0;

// --- CSS Animations ---
function injectStyles(): void {
  if (document.getElementById('da-global-styles')) return;
  const style = document.createElement('style');
  style.id = 'da-global-styles';
  style.textContent = `
    @keyframes da-pulse {
      0% { opacity: 1; }
      100% { opacity: 0; transform: scale(1.05); }
    }
    @keyframes da-slide-in {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
    .da-inspect-cursor, .da-inspect-cursor * {
      cursor: crosshair !important;
    }
  `;
  document.head.appendChild(style);
}

// --- Depth Traversal ---
function buildDepthStack(el: HTMLElement): HTMLElement[] {
  const stack: HTMLElement[] = [];
  let current: HTMLElement | null = el;
  while (current && current !== document.body && current !== document.documentElement) {
    stack.unshift(current);
    current = current.parentElement;
  }
  return stack;
}

function getElementAtDepth(x: number, y: number, goDeeper: boolean): HTMLElement | null {
  if (!hoveredElement) return null;

  if (goDeeper) {
    // Try to find a child at the cursor position
    const children = Array.from(hoveredElement.children) as HTMLElement[];
    for (const child of children) {
      const rect = child.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return child;
      }
    }
    return hoveredElement; // Can't go deeper
  } else {
    // Go to parent
    return hoveredElement.parentElement && hoveredElement.parentElement !== document.body
      ? hoveredElement.parentElement
      : hoveredElement;
  }
}

// --- Helpers ---
function isOwnElement(el: HTMLElement): boolean {
  return !!(
    el.id?.startsWith('da-') ||
    el.className?.toString().includes('da-') ||
    el.closest('[id^="da-"]')
  );
}

function findAnnotation(el: HTMLElement): Annotation | null {
  return annotations.find(a => a.element === el) ?? null;
}

function isElementAnnotated(el: HTMLElement): boolean {
  return annotations.some(a => a.element === el);
}

// --- Mode Transitions ---
function activate(): void {
  if (mode !== 'inactive') return;
  mode = 'inspect';
  injectStyles();
  document.documentElement.classList.add('da-inspect-cursor');
  updateStatusBar(annotations.length, openReview, deactivate);
  updateAllPins(annotations);

  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('wheel', handleWheel, { capture: true, passive: false });
  document.addEventListener('keydown', handleKeyDown, true);
}

function deactivate(): void {
  if (annotations.length > 0 && mode !== 'review') {
    if (!confirm(`You have ${annotations.length} annotation${annotations.length !== 1 ? 's' : ''}. Exit and discard?`)) {
      return;
    }
  }

  mode = 'inactive';
  annotations = [];
  hoveredElement = null;

  document.documentElement.classList.remove('da-inspect-cursor');
  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('wheel', handleWheel, true);
  document.removeEventListener('keydown', handleKeyDown, true);

  hideHighlight();
  hideBreadcrumb();
  hidePopover();
  hideReviewPanel();
  clearAllPins();
  destroyHighlight();
  destroyBreadcrumb();
  destroyStatusBar();
}

function enterAnnotateMode(el: HTMLElement): void {
  mode = 'annotate';
  hideHighlight();
  document.documentElement.classList.remove('da-inspect-cursor');

  const styles = extractStyles(el);
  const existing = findAnnotation(el);

  showPopover(
    el,
    styles,
    existing,
    (prompt, colorSuggestion) => {
      // Save annotation
      if (existing) {
        existing.prompt = prompt;
        existing.colorSuggestion = colorSuggestion;
      } else {
        annotations.push({
          id: 'ann-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          element: el,
          selector: generateSelector(el),
          styles,
          prompt,
          colorSuggestion,
          timestamp: Date.now(),
        });
      }
      hidePopover();
      returnToInspect();
    },
    () => {
      hidePopover();
      returnToInspect();
    },
  );
}

function returnToInspect(): void {
  mode = 'inspect';
  document.documentElement.classList.add('da-inspect-cursor');
  updateAllPins(annotations);
  updateStatusBar(annotations.length, openReview, deactivate);
}

function openReview(): void {
  mode = 'review';
  hideHighlight();
  hideBreadcrumb();
  hidePopover();
  document.documentElement.classList.remove('da-inspect-cursor');

  showReviewPanel(
    annotations,
    // onEdit
    (id) => {
      hideReviewPanel();
      const ann = annotations.find(a => a.id === id);
      if (ann?.element?.isConnected) {
        ann.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => enterAnnotateMode(ann.element), 300);
      } else {
        returnToInspect();
      }
    },
    // onDelete
    (id) => {
      annotations = annotations.filter(a => a.id !== id);
      updateAllPins(annotations);
      // Re-render the panel
      openReview();
    },
    // onCopy
    async () => {
      const md = generateMarkdown(annotations);
      const success = await copyToClipboard(md);
      if (success) {
        showToast(`Copied ${annotations.length} annotation${annotations.length !== 1 ? 's' : ''} — paste into your AI agent`);
      } else {
        showToast('Copy failed — check console for output');
        console.log('--- DesignAnnotator Output ---\n\n' + md);
      }
    },
    // onBack
    () => {
      hideReviewPanel();
      returnToInspect();
    },
  );
}

// --- Toast ---
function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    background: #1E1E1E;
    color: #E0E0E0;
    border: 1px solid #333;
    padding: 10px 20px;
    border-radius: 6px;
    font: 13px -apple-system, BlinkMacSystemFont, sans-serif;
    z-index: 2147483647;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    animation: da-slide-in 0.2s ease-out;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// --- Event Handlers ---
function handleMouseMove(e: MouseEvent): void {
  if (mode !== 'inspect') return;

  const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
  if (!el || isOwnElement(el)) {
    hideHighlight();
    hideBreadcrumb();
    hoveredElement = null;
    return;
  }

  if (el !== hoveredElement) {
    hoveredElement = el;
    depthStack = buildDepthStack(el);
    depthIndex = depthStack.length - 1;
  }

  const current = depthStack[depthIndex] || el;
  const selector = generateSelector(current);
  showHighlight(current, selector, isElementAnnotated(current));
  updateBreadcrumb(current, (selected) => {
    hoveredElement = selected;
    depthStack = buildDepthStack(selected);
    depthIndex = depthStack.length - 1;
    const sel = generateSelector(selected);
    showHighlight(selected, sel, isElementAnnotated(selected));
  });
}

function handleClick(e: MouseEvent): void {
  if (mode !== 'inspect') return;

  const el = e.target as HTMLElement;
  if (isOwnElement(el)) return;

  e.preventDefault();
  e.stopPropagation();

  const current = depthStack[depthIndex] || hoveredElement;
  if (current) {
    enterAnnotateMode(current);
  }
}

function handleWheel(e: WheelEvent): void {
  if (mode !== 'inspect') return;
  if (!e.altKey) return;

  e.preventDefault();
  e.stopPropagation();

  if (e.deltaY > 0) {
    // Scroll down — go deeper (child)
    const child = getElementAtDepth(e.clientX, e.clientY, true);
    if (child && child !== hoveredElement) {
      hoveredElement = child;
      depthStack = buildDepthStack(child);
      depthIndex = depthStack.length - 1;
    }
  } else {
    // Scroll up — go shallower (parent)
    if (depthIndex > 0) {
      depthIndex--;
      hoveredElement = depthStack[depthIndex];
    }
  }

  if (hoveredElement) {
    const selector = generateSelector(hoveredElement);
    showHighlight(hoveredElement, selector, isElementAnnotated(hoveredElement));
    updateBreadcrumb(hoveredElement, (selected) => {
      hoveredElement = selected;
      depthStack = buildDepthStack(selected);
      depthIndex = depthStack.length - 1;
    });
  }
}

function handleKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();

    if (isPopoverOpen()) {
      hidePopover();
      returnToInspect();
    } else if (isReviewOpen()) {
      hideReviewPanel();
      returnToInspect();
    } else {
      deactivate();
    }
  }
}

// --- Pin Click Handler ---
onPinClick((id) => {
  if (mode === 'inspect') {
    const ann = annotations.find(a => a.id === id);
    if (ann?.element?.isConnected) {
      enterAnnotateMode(ann.element);
    }
  }
});

// --- Toggle ---
function toggle(): void {
  if (mode === 'inactive') {
    activate();
  } else {
    deactivate();
  }
}

// --- Keyboard Shortcut (Cmd+Shift+D) ---
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    toggle();
  }
});

// --- Floating Toggle Button ---
function createToggleButton(): void {
  const btn = document.createElement('div');
  btn.id = 'da-toggle-button';
  btn.style.cssText = `
    position: fixed;
    bottom: 16px;
    left: 16px;
    width: 40px;
    height: 40px;
    background: rgba(124, 58, 237, 0.8);
    color: white;
    border-radius: 8px;
    font: 700 12px/40px -apple-system, BlinkMacSystemFont, sans-serif;
    text-align: center;
    cursor: pointer;
    z-index: 2147483630;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: all 0.15s ease;
    user-select: none;
  `;
  btn.textContent = 'DA';
  btn.title = 'Toggle DesignAnnotator (Cmd+Shift+D)';

  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'rgba(124, 58, 237, 1)';
    btn.style.transform = 'scale(1.05)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'rgba(124, 58, 237, 0.8)';
    btn.style.transform = 'scale(1)';
  });
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });

  document.body.appendChild(btn);
}

// --- Init ---
function init(): void {
  if (document.getElementById('da-toggle-button')) return;
  createToggleButton();
  console.log(
    '%c DesignAnnotator %c Ready — Cmd+Shift+D to activate',
    'background:#7C3AED;color:white;padding:2px 6px;border-radius:3px;font-weight:600',
    'color:#7C3AED',
  );
}

// Auto-init when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Expose API for programmatic use
(window as any).DesignAnnotator = { activate, deactivate, toggle };
