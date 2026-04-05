import { tokens } from './styles';

const BAR_ID = 'da-status-bar';

let bar: HTMLDivElement | null = null;

function ensureBar(): HTMLDivElement {
  if (bar) return bar;
  bar = document.createElement('div');
  bar.id = BAR_ID;
  bar.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: ${tokens.z.statusBar};
    background: ${tokens.color.surface.base}F2;
    color: ${tokens.color.text.secondary};
    font: ${tokens.font.weight.regular} ${tokens.font.size.base}/${tokens.font.lineHeight.tight} ${tokens.font.family};
    padding: ${tokens.space[3]} ${tokens.space[5]};
    display: flex;
    align-items: center;
    gap: ${tokens.space[3]};
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-top: 1px solid ${tokens.color.surface.borderSubtle};
    animation: da-slide-up 0.2s ease-out;
  `;
  document.body.appendChild(bar);
  return bar;
}

// SVG icon for the logo mark
const logoSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2"/>
  <circle cx="8" cy="8" r="2" fill="currentColor"/>
  <line x1="13" y1="8" x2="19" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="7" y1="13" x2="17" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="7" y1="17" x2="14" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`;

export function updateStatusBar(count: number, onReview: () => void, onExit: () => void): void {
  const b = ensureBar();

  b.innerHTML = `
    <div style="display:flex;align-items:center;gap:${tokens.space[2]};">
      <div style="
        color: ${tokens.color.primary[400]};
        display: flex;
        align-items: center;
      ">${logoSVG}</div>
      <span style="
        color: ${tokens.color.text.primary};
        font-weight: ${tokens.font.weight.semibold};
        font-size: ${tokens.font.size.sm};
        letter-spacing: 0.3px;
      ">DesignAnnotator</span>
    </div>

    <div style="width:1px;height:16px;background:${tokens.color.surface.border};"></div>

    <span style="color:${tokens.color.text.secondary};font-size:${tokens.font.size.sm};">
      ${count === 0
        ? 'Click elements to annotate'
        : `<span style="
            display:inline-flex;
            align-items:center;
            gap:${tokens.space[1]};
          ">
            <span style="
              background:${tokens.color.primary[600]};
              color:white;
              min-width:20px;
              height:20px;
              border-radius:${tokens.radius.full};
              display:inline-flex;
              align-items:center;
              justify-content:center;
              font-size:${tokens.font.size.xs};
              font-weight:${tokens.font.weight.bold};
            ">${count}</span>
            annotation${count !== 1 ? 's' : ''}
          </span>`
      }
    </span>

    <div style="flex:1;"></div>

    <span style="color:${tokens.color.text.tertiary};font-size:${tokens.font.size.xs};">
      <kbd style="
        background:${tokens.color.surface.elevated};
        border:1px solid ${tokens.color.surface.border};
        border-radius:${tokens.radius.sm};
        padding:1px 5px;
        font-size:${tokens.font.size.xs};
        font-family:${tokens.font.family};
      ">Esc</kbd> to exit
    </span>

    ${count > 0 ? `
      <button id="da-review-btn" style="
        background: ${tokens.color.primary[600]};
        color: white;
        border: none;
        border-radius: ${tokens.radius.md};
        padding: ${tokens.space[2]} ${tokens.space[4]};
        font: ${tokens.font.weight.medium} ${tokens.font.size.sm}/${tokens.font.lineHeight.tight} ${tokens.font.family};
        cursor: pointer;
        transition: background ${tokens.transition.fast}, transform ${tokens.transition.fast};
        display: flex;
        align-items: center;
        gap: ${tokens.space[2]};
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polyline points="9 11 12 14 22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        Review & Submit
      </button>
    ` : ''}
  `;

  if (count > 0) {
    const btn = b.querySelector<HTMLButtonElement>('#da-review-btn')!;
    btn.addEventListener('click', onReview);
    btn.addEventListener('mouseenter', () => {
      btn.style.background = tokens.color.primary[700];
      btn.style.transform = 'translateY(-1px)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = tokens.color.primary[600];
      btn.style.transform = 'translateY(0)';
    });
    btn.addEventListener('mousedown', () => {
      btn.style.transform = 'translateY(0) scale(0.98)';
    });
    btn.addEventListener('mouseup', () => {
      btn.style.transform = 'translateY(-1px)';
    });
  }
}

export function hideStatusBar(): void {
  if (bar) bar.style.display = 'none';
}

export function showStatusBar(): void {
  if (bar) bar.style.display = 'flex';
}

export function destroyStatusBar(): void {
  bar?.remove();
  bar = null;
}
