const BAR_ID = 'da-breadcrumb-bar';

let bar: HTMLDivElement | null = null;

function ensureBar(): HTMLDivElement {
  if (bar) return bar;
  bar = document.createElement('div');
  bar.id = BAR_ID;
  bar.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 2147483643;
    background: rgba(30, 30, 30, 0.92);
    color: #ccc;
    font: 12px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    padding: 6px 12px;
    display: none;
    overflow-x: auto;
    white-space: nowrap;
    backdrop-filter: blur(8px);
  `;
  document.body.appendChild(bar);
  return bar;
}

function buildPath(el: HTMLElement): HTMLElement[] {
  const path: HTMLElement[] = [];
  let current: HTMLElement | null = el;
  while (current && current !== document.body && current !== document.documentElement) {
    path.unshift(current);
    current = current.parentElement;
  }
  return path.slice(-6); // Show last 6 levels max
}

function tagLabel(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const cls = el.className && typeof el.className === 'string'
    ? '.' + el.className.trim().split(/\s+/).filter(c => !c.startsWith('da-')).slice(0, 1).join('.')
    : '';
  const id = el.id ? `#${el.id}` : '';
  return tag + id + (cls !== '.' ? cls : '');
}

export function updateBreadcrumb(el: HTMLElement, onSelect: (el: HTMLElement) => void): void {
  const b = ensureBar();
  const path = buildPath(el);

  b.innerHTML = '';
  path.forEach((node, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.textContent = ' > ';
      sep.style.cssText = 'color: #666; margin: 0 4px;';
      b.appendChild(sep);
    }

    const span = document.createElement('span');
    span.textContent = tagLabel(node);
    const isLast = i === path.length - 1;
    span.style.cssText = `
      cursor: pointer;
      color: ${isLast ? '#A78BFA' : '#ccc'};
      font-weight: ${isLast ? '600' : '400'};
    `;
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect(node);
    });
    b.appendChild(span);
  });

  b.style.display = 'block';
}

export function hideBreadcrumb(): void {
  if (bar) bar.style.display = 'none';
}

export function destroyBreadcrumb(): void {
  bar?.remove();
  bar = null;
}
