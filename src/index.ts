import { Annotation, Mode } from './types';
import { extractStyles, generateSelector } from './extract-styles';
import { showHighlight, hideHighlight, destroyHighlight } from './highlight-overlay';
import { updateBreadcrumb, hideBreadcrumb, destroyBreadcrumb } from './breadcrumb-bar';
import { showPopover, hidePopover, isPopoverOpen } from './annotation-popover';
import { updateAllPins, clearAllPins, onPinClick } from './pin-markers';
import { updateStatusBar, destroyStatusBar } from './status-bar';
import { showReviewPanel, hideReviewPanel, isReviewOpen } from './review-panel';
import { generateMarkdown, copyToClipboard } from './output';
import { tokens, injectGlobalStyles } from './styles';

// --- State ---
let mode: Mode = 'inactive';
let annotations: Annotation[] = [];
let hoveredElement: HTMLElement | null = null;
let depthStack: HTMLElement[] = [];
let depthIndex = 0;

// (Global styles are now in styles.ts)

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
  injectGlobalStyles();
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
    background: ${tokens.color.surface.raised};
    color: ${tokens.color.text.primary};
    border: 1px solid ${tokens.color.surface.border};
    padding: ${tokens.space[3]} ${tokens.space[5]};
    border-radius: ${tokens.radius.lg};
    font: ${tokens.font.weight.medium} ${tokens.font.size.sm}/${tokens.font.lineHeight.tight} ${tokens.font.family};
    z-index: ${tokens.z.toast};
    box-shadow: ${tokens.shadow.lg};
    animation: da-slide-up 0.2s ease-out;
    display: flex;
    align-items: center;
    gap: ${tokens.space[2]};
    overflow: hidden;
  `;
  toast.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${tokens.color.success}" stroke-width="2.5" stroke-linecap="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    <span>${message}</span>
  `;

  // Auto-dismiss progress bar
  const progress = document.createElement('div');
  progress.style.cssText = `
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    background: ${tokens.color.primary[600]};
    animation: da-toast-progress 3s linear forwards;
  `;
  toast.style.position = 'fixed'; // re-assert for the absolute child
  toast.appendChild(progress);

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = `opacity ${tokens.transition.slow}`;
    setTimeout(() => toast.remove(), 200);
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
    bottom: ${tokens.space[4]};
    left: ${tokens.space[4]};
    width: 44px;
    height: 44px;
    background: ${tokens.color.primary[600]};
    color: white;
    border-radius: ${tokens.radius.lg};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 2147483630;
    box-shadow: ${tokens.shadow.md};
    transition: background ${tokens.transition.fast}, transform ${tokens.transition.spring}, box-shadow ${tokens.transition.normal};
    user-select: none;
  `;
  btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <circle cx="8" cy="8" r="2" fill="currentColor"/>
    <line x1="13" y1="8" x2="19" y2="8" stroke-linecap="round"/>
    <line x1="7" y1="13" x2="17" y2="13" stroke-linecap="round"/>
    <line x1="7" y1="17" x2="14" y2="17" stroke-linecap="round"/>
  </svg>`;
  btn.title = 'Toggle DesignAnnotator (Cmd+Shift+D)';

  btn.addEventListener('mouseenter', () => {
    btn.style.background = tokens.color.primary[700];
    btn.style.transform = 'scale(1.08)';
    btn.style.boxShadow = `${tokens.shadow.lg}, ${tokens.shadow.glow}`;
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = tokens.color.primary[600];
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = tokens.shadow.md;
  });
  btn.addEventListener('mousedown', () => {
    btn.style.transform = 'scale(0.95)';
  });
  btn.addEventListener('mouseup', () => {
    btn.style.transform = 'scale(1.08)';
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
    `background:${tokens.color.primary[600]};color:white;padding:2px 8px;border-radius:4px;font-weight:600`,
    `color:${tokens.color.primary[500]}`,
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
