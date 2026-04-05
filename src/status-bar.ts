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
    z-index: 2147483644;
    background: rgba(30, 30, 30, 0.95);
    color: #ccc;
    font: 13px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    backdrop-filter: blur(8px);
    border-top: 1px solid #333;
  `;
  document.body.appendChild(bar);
  return bar;
}

export function updateStatusBar(count: number, onReview: () => void, onExit: () => void): void {
  const b = ensureBar();

  b.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="
        background:#7C3AED;
        color:white;
        font-weight:700;
        font-size:11px;
        padding:3px 7px;
        border-radius:4px;
        letter-spacing:0.5px;
      ">DA</span>
      <span style="color:#999;">
        ${count === 0
          ? 'Click elements to annotate'
          : `<strong style="color:#E0E0E0;">${count}</strong> annotation${count !== 1 ? 's' : ''}`
        }
      </span>
    </div>
    <div style="flex:1;"></div>
    <span style="color:#666;font-size:12px;">Esc to exit</span>
    ${count > 0 ? `
      <button id="da-review-btn" style="
        background:#7C3AED;
        color:white;
        border:none;
        border-radius:4px;
        padding:6px 16px;
        font-size:12px;
        font-weight:500;
        cursor:pointer;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      ">Review & Submit</button>
    ` : ''}
  `;

  if (count > 0) {
    b.querySelector('#da-review-btn')!.addEventListener('click', onReview);
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
