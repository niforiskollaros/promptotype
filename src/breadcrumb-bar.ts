import { tokens } from './styles';

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
    z-index: ${tokens.z.breadcrumb};
    background: ${tokens.color.surface.base}F0;
    color: ${tokens.color.text.secondary};
    font: ${tokens.font.weight.regular} ${tokens.font.size.sm}/${tokens.font.lineHeight.tight} ${tokens.font.mono};
    padding: ${tokens.space[2]} ${tokens.space[4]};
    display: none;
    overflow-x: auto;
    white-space: nowrap;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid ${tokens.color.surface.borderSubtle};
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
  return path.slice(-6);
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
      sep.textContent = '›';
      sep.style.cssText = `color: ${tokens.color.text.tertiary}; margin: 0 6px; font-size: 14px;`;
      b.appendChild(sep);
    }

    const span = document.createElement('span');
    span.textContent = tagLabel(node);
    const isLast = i === path.length - 1;
    span.style.cssText = `
      cursor: pointer;
      color: ${isLast ? tokens.color.primary[400] : tokens.color.text.secondary};
      font-weight: ${isLast ? tokens.font.weight.semibold : tokens.font.weight.regular};
      padding: 2px 4px;
      border-radius: ${tokens.radius.sm};
      transition: background ${tokens.transition.fast}, color ${tokens.transition.fast};
    `;
    span.addEventListener('mouseenter', () => {
      span.style.background = tokens.color.surface.elevated;
      if (!isLast) span.style.color = tokens.color.text.primary;
    });
    span.addEventListener('mouseleave', () => {
      span.style.background = 'transparent';
      if (!isLast) span.style.color = tokens.color.text.secondary;
    });
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
