import { Annotation } from './types';
import { pulseHighlight } from './highlight-overlay';

const PANEL_ID = 'da-review-panel';

let panel: HTMLDivElement | null = null;

function formatProps(a: Annotation): string {
  const s = a.styles;
  return `Font: ${s.font.family} ${s.font.size} ${s.font.weight} · Color: ${s.color.text} on ${s.color.background} · Padding: ${s.spacing.padding} · Margin: ${s.spacing.margin}`;
}

export function showReviewPanel(
  annotations: Annotation[],
  onEdit: (id: string) => void,
  onDelete: (id: string) => void,
  onCopy: () => void,
  onBack: () => void,
): void {
  hideReviewPanel();

  panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 380px;
    z-index: 2147483646;
    background: #1A1A1A;
    color: #E0E0E0;
    font: 13px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    border-left: 1px solid #333;
    display: flex;
    flex-direction: column;
    box-shadow: -4px 0 24px rgba(0,0,0,0.3);
    animation: da-slide-in 0.2s ease-out;
  `;

  const header = `
    <div style="padding:14px 16px;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:600;font-size:14px;">Review Annotations (${annotations.length})</span>
      <button id="da-review-close" style="background:none;border:none;color:#666;cursor:pointer;font-size:18px;padding:0;line-height:1;">&times;</button>
    </div>
  `;

  let cards = '';
  if (annotations.length === 0) {
    cards = `
      <div style="flex:1;display:flex;align-items:center;justify-content:center;color:#666;text-align:center;padding:32px;">
        <div>
          <div style="font-size:32px;margin-bottom:12px;">🎯</div>
          <div>No annotations yet.<br>Go back and click on elements to annotate them.</div>
        </div>
      </div>
    `;
  } else {
    cards = `<div style="flex:1;overflow-y:auto;padding:8px;">`;
    annotations.forEach((a, i) => {
      const selector = a.selector;
      const promptText = a.prompt.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      cards += `
        <div class="da-review-card" data-id="${a.id}" style="
          background:#242424;
          border:1px solid #333;
          border-radius:6px;
          padding:12px;
          margin-bottom:8px;
          cursor:pointer;
          transition:border-color 0.15s;
        ">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="
                background:#7C3AED;
                color:white;
                width:20px;
                height:20px;
                border-radius:50%;
                font-size:11px;
                font-weight:600;
                display:flex;
                align-items:center;
                justify-content:center;
              ">${i + 1}</span>
              <span style="color:#A78BFA;font-weight:500;font-size:12px;">${selector}</span>
            </div>
            <button class="da-delete-btn" data-id="${a.id}" style="
              background:none;
              border:none;
              color:#666;
              cursor:pointer;
              font-size:14px;
              padding:0 2px;
              line-height:1;
            ">&times;</button>
          </div>
          <div style="color:#888;font-size:11px;line-height:1.4;margin-bottom:6px;word-break:break-all;">
            ${formatProps(a)}
          </div>
          <div style="color:#E0E0E0;font-size:12px;font-style:italic;border-left:2px solid #7C3AED;padding-left:8px;">
            "${promptText}"
          </div>
          ${a.colorSuggestion ? `
            <div style="margin-top:6px;font-size:11px;color:#888;">
              Suggested color: <span style="
                display:inline-block;
                width:10px;
                height:10px;
                background:${a.colorSuggestion};
                border:1px solid rgba(255,255,255,0.2);
                border-radius:2px;
                vertical-align:middle;
                margin:0 4px;
              "></span>${a.colorSuggestion}
            </div>
          ` : ''}
          <div style="margin-top:8px;text-align:right;">
            <button class="da-edit-btn" data-id="${a.id}" style="
              background:none;
              border:1px solid #444;
              border-radius:3px;
              color:#999;
              padding:3px 10px;
              font-size:11px;
              cursor:pointer;
            ">Edit</button>
          </div>
        </div>
      `;
    });
    cards += '</div>';
  }

  const footer = `
    <div style="padding:12px 16px;border-top:1px solid #333;display:flex;gap:8px;">
      <button id="da-back-btn" style="
        flex:1;
        background:none;
        border:1px solid #444;
        border-radius:4px;
        color:#999;
        padding:8px;
        font-size:12px;
        cursor:pointer;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      ">Back to Inspect</button>
      ${annotations.length > 0 ? `
        <button id="da-copy-btn" style="
          flex:1;
          background:#7C3AED;
          border:none;
          border-radius:4px;
          color:white;
          padding:8px;
          font-size:12px;
          font-weight:500;
          cursor:pointer;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        ">Copy to Clipboard</button>
      ` : ''}
    </div>
  `;

  panel.innerHTML = header + cards + footer;
  document.body.appendChild(panel);

  // Event handlers
  panel.querySelector('#da-review-close')!.addEventListener('click', onBack);
  panel.querySelector('#da-back-btn')!.addEventListener('click', onBack);

  if (annotations.length > 0) {
    panel.querySelector('#da-copy-btn')!.addEventListener('click', () => {
      onCopy();
      const btn = panel!.querySelector<HTMLButtonElement>('#da-copy-btn')!;
      btn.textContent = 'Copied!';
      btn.style.background = '#059669';
      setTimeout(() => {
        if (btn.isConnected) {
          btn.textContent = 'Copy to Clipboard';
          btn.style.background = '#7C3AED';
        }
      }, 2000);
    });
  }

  // Card clicks — highlight element on page
  panel.querySelectorAll('.da-review-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.da-edit-btn') || target.closest('.da-delete-btn')) return;
      const id = (card as HTMLElement).dataset.id!;
      const annotation = annotations.find(a => a.id === id);
      if (annotation?.element?.isConnected) {
        annotation.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        pulseHighlight(annotation.element);
      }
    });
  });

  // Edit buttons
  panel.querySelectorAll('.da-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onEdit((btn as HTMLElement).dataset.id!);
    });
  });

  // Delete buttons
  panel.querySelectorAll('.da-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onDelete((btn as HTMLElement).dataset.id!);
    });
  });
}

export function hideReviewPanel(): void {
  panel?.remove();
  panel = null;
}

export function isReviewOpen(): boolean {
  return panel !== null;
}
