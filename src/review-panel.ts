import { Annotation } from './types';
import { tokens } from './styles';
import { pulseHighlight } from './highlight-overlay';

const PANEL_ID = 'da-review-panel';

let panel: HTMLDivElement | null = null;

function compactProps(a: Annotation): string {
  const s = a.styles;
  const parts: string[] = [];
  parts.push(`<span style="font-family:${tokens.font.mono};font-size:${tokens.font.size.xs};">${s.font.family} ${s.font.size} · ${s.font.weight}</span>`);

  const colorDot = (hex: string) => `<span style="
    display:inline-block;
    width:10px;height:10px;
    background:${hex};
    border-radius:${tokens.radius.full};
    border:1px solid rgba(255,255,255,0.15);
    vertical-align:middle;
  "></span>`;

  parts.push(`${colorDot(s.color.text)} ${s.color.text} ${colorDot(s.color.background)} ${s.color.background}`);
  return parts.join('<span style="color:' + tokens.color.text.tertiary + ';margin:0 6px;">·</span>');
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
    width: 400px;
    z-index: ${tokens.z.reviewPanel};
    background: ${tokens.color.surface.base};
    color: ${tokens.color.text.primary};
    font: ${tokens.font.weight.regular} ${tokens.font.size.base}/${tokens.font.lineHeight.normal} ${tokens.font.family};
    border-left: 1px solid ${tokens.color.surface.border};
    display: flex;
    flex-direction: column;
    box-shadow: ${tokens.shadow.xl};
    animation: da-slide-in-right 0.25s ease-out;
  `;

  // Header
  const header = `
    <div style="
      padding:${tokens.space[4]} ${tokens.space[5]};
      border-bottom:1px solid ${tokens.color.surface.border};
      display:flex;
      justify-content:space-between;
      align-items:center;
      flex-shrink:0;
    ">
      <div style="display:flex;align-items:center;gap:${tokens.space[3]};">
        <span style="font-weight:${tokens.font.weight.semibold};font-size:${tokens.font.size.md};">Review</span>
        <span style="
          background:${tokens.color.surface.elevated};
          color:${tokens.color.text.secondary};
          border-radius:${tokens.radius.full};
          padding:2px 8px;
          font-size:${tokens.font.size.xs};
          font-weight:${tokens.font.weight.medium};
        ">${annotations.length} annotation${annotations.length !== 1 ? 's' : ''}</span>
      </div>
      <button id="da-review-close" style="
        background:${tokens.color.surface.elevated};
        border:none;
        color:${tokens.color.text.tertiary};
        cursor:pointer;
        width:28px;height:28px;
        border-radius:${tokens.radius.md};
        display:flex;align-items:center;justify-content:center;
        font-size:16px;
        transition:background ${tokens.transition.fast}, color ${tokens.transition.fast};
      ">×</button>
    </div>
  `;

  // Cards
  let cardsHtml = '';
  if (annotations.length === 0) {
    cardsHtml = `
      <div style="
        flex:1;display:flex;align-items:center;justify-content:center;
        color:${tokens.color.text.tertiary};text-align:center;padding:${tokens.space[8]};
      ">
        <div>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${tokens.color.text.tertiary}" stroke-width="1.5" style="margin:0 auto ${tokens.space[4]};display:block;opacity:0.5;">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <circle cx="8" cy="8" r="2"/>
            <line x1="13" y1="8" x2="19" y2="8" stroke-linecap="round"/>
            <line x1="7" y1="13" x2="17" y2="13" stroke-linecap="round"/>
            <line x1="7" y1="17" x2="14" y2="17" stroke-linecap="round"/>
          </svg>
          <div style="font-size:${tokens.font.size.md};font-weight:${tokens.font.weight.medium};color:${tokens.color.text.secondary};margin-bottom:${tokens.space[1]};">No annotations yet</div>
          <div style="font-size:${tokens.font.size.sm};color:${tokens.color.text.tertiary};">Go back and click elements to annotate them</div>
        </div>
      </div>
    `;
  } else {
    cardsHtml = `<div style="flex:1;overflow-y:auto;padding:${tokens.space[3]};">`;
    annotations.forEach((a, i) => {
      const promptText = a.prompt.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      cardsHtml += `
        <div class="da-review-card" data-id="${a.id}" style="
          background:${tokens.color.surface.raised};
          border:1px solid ${tokens.color.surface.border};
          border-radius:${tokens.radius.lg};
          padding:${tokens.space[4]};
          margin-bottom:${tokens.space[2]};
          cursor:pointer;
          transition:border-color ${tokens.transition.fast}, box-shadow ${tokens.transition.fast};
        ">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${tokens.space[3]};">
            <div style="display:flex;align-items:center;gap:${tokens.space[2]};">
              <span style="
                background:${tokens.color.primary[600]};
                color:white;
                width:22px;height:22px;
                border-radius:${tokens.radius.full};
                font-size:${tokens.font.size.xs};
                font-weight:${tokens.font.weight.bold};
                display:flex;align-items:center;justify-content:center;
              ">${i + 1}</span>
              <span style="
                color:${tokens.color.primary[400]};
                font-weight:${tokens.font.weight.medium};
                font-size:${tokens.font.size.sm};
                font-family:${tokens.font.mono};
              ">${a.selector}</span>
            </div>
            <button class="da-delete-btn" data-id="${a.id}" style="
              background:transparent;
              border:none;
              color:${tokens.color.text.tertiary};
              cursor:pointer;
              width:24px;height:24px;
              border-radius:${tokens.radius.sm};
              display:flex;align-items:center;justify-content:center;
              font-size:14px;
              transition:background ${tokens.transition.fast}, color ${tokens.transition.fast};
            ">×</button>
          </div>

          <div style="
            color:${tokens.color.text.secondary};
            font-size:${tokens.font.size.xs};
            line-height:${tokens.font.lineHeight.relaxed};
            margin-bottom:${tokens.space[3]};
          ">
            ${compactProps(a)}
          </div>

          ${promptText ? `
            <div style="
              color:${tokens.color.text.primary};
              font-size:${tokens.font.size.sm};
              line-height:${tokens.font.lineHeight.relaxed};
              border-left:2px solid ${tokens.color.primary[600]};
              padding-left:${tokens.space[3]};
              margin-bottom:${tokens.space[2]};
            ">
              ${promptText}
            </div>
          ` : `
            <div style="
              color:${tokens.color.text.tertiary};
              font-size:${tokens.font.size.xs};
              font-style:italic;
              margin-bottom:${tokens.space[2]};
            ">
              No prompt — properties only
            </div>
          `}

          ${a.colorSuggestion ? `
            <div style="
              display:inline-flex;
              align-items:center;
              gap:${tokens.space[1]};
              background:${tokens.color.surface.elevated};
              border-radius:${tokens.radius.full};
              padding:2px 8px 2px 4px;
              font-size:${tokens.font.size.xs};
              color:${tokens.color.text.secondary};
              margin-bottom:${tokens.space[2]};
            ">
              <span style="
                width:12px;height:12px;
                background:${a.colorSuggestion};
                border-radius:${tokens.radius.full};
                border:1px solid rgba(255,255,255,0.15);
              "></span>
              <span style="font-family:${tokens.font.mono};">${a.colorSuggestion}</span>
            </div>
          ` : ''}

          <div style="text-align:right;">
            <button class="da-edit-btn" data-id="${a.id}" style="
              background:${tokens.color.surface.elevated};
              border:1px solid ${tokens.color.surface.border};
              border-radius:${tokens.radius.md};
              color:${tokens.color.text.secondary};
              padding:${tokens.space[1]} ${tokens.space[3]};
              font:${tokens.font.weight.regular} ${tokens.font.size.xs}/${tokens.font.lineHeight.tight} ${tokens.font.family};
              cursor:pointer;
              transition:background ${tokens.transition.fast}, border-color ${tokens.transition.fast};
            ">Edit</button>
          </div>
        </div>
      `;
    });
    cardsHtml += '</div>';
  }

  // Footer
  const footer = `
    <div style="
      padding:${tokens.space[4]} ${tokens.space[5]};
      border-top:1px solid ${tokens.color.surface.border};
      display:flex;
      gap:${tokens.space[3]};
      flex-shrink:0;
    ">
      <button id="da-back-btn" style="
        flex:1;
        background:transparent;
        border:1px solid ${tokens.color.surface.border};
        border-radius:${tokens.radius.md};
        color:${tokens.color.text.secondary};
        padding:${tokens.space[3]};
        font:${tokens.font.weight.regular} ${tokens.font.size.sm}/${tokens.font.lineHeight.tight} ${tokens.font.family};
        cursor:pointer;
        transition:background ${tokens.transition.fast}, border-color ${tokens.transition.fast};
      ">Back to Inspect</button>
      ${annotations.length > 0 ? `
        <button id="da-copy-btn" style="
          flex:1;
          background:${tokens.color.primary[600]};
          border:none;
          border-radius:${tokens.radius.md};
          color:white;
          padding:${tokens.space[3]};
          font:${tokens.font.weight.medium} ${tokens.font.size.sm}/${tokens.font.lineHeight.tight} ${tokens.font.family};
          cursor:pointer;
          transition:background ${tokens.transition.fast}, transform ${tokens.transition.fast};
          display:flex;
          align-items:center;
          justify-content:center;
          gap:${tokens.space[2]};
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy to Clipboard
        </button>
      ` : ''}
    </div>
  `;

  panel.innerHTML = header + cardsHtml + footer;
  document.body.appendChild(panel);

  // --- Event Handlers ---

  const closeBtn = panel.querySelector<HTMLButtonElement>('#da-review-close')!;
  closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = tokens.color.surface.overlay; closeBtn.style.color = tokens.color.text.primary; });
  closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = tokens.color.surface.elevated; closeBtn.style.color = tokens.color.text.tertiary; });
  closeBtn.addEventListener('click', onBack);

  const backBtn = panel.querySelector<HTMLButtonElement>('#da-back-btn')!;
  backBtn.addEventListener('mouseenter', () => { backBtn.style.background = tokens.color.surface.elevated; backBtn.style.borderColor = tokens.color.text.tertiary; });
  backBtn.addEventListener('mouseleave', () => { backBtn.style.background = 'transparent'; backBtn.style.borderColor = tokens.color.surface.border; });
  backBtn.addEventListener('click', onBack);

  if (annotations.length > 0) {
    const copyBtn = panel.querySelector<HTMLButtonElement>('#da-copy-btn')!;
    copyBtn.addEventListener('mouseenter', () => { copyBtn.style.background = tokens.color.primary[700]; copyBtn.style.transform = 'translateY(-1px)'; });
    copyBtn.addEventListener('mouseleave', () => { copyBtn.style.background = tokens.color.primary[600]; copyBtn.style.transform = 'translateY(0)'; });
    copyBtn.addEventListener('mousedown', () => { copyBtn.style.transform = 'scale(0.98)'; });
    copyBtn.addEventListener('mouseup', () => { copyBtn.style.transform = 'translateY(-1px)'; });
    copyBtn.addEventListener('click', () => {
      onCopy();
      copyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Copied!
      `;
      copyBtn.style.background = tokens.color.success;
      setTimeout(() => {
        if (copyBtn.isConnected) {
          copyBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy to Clipboard
          `;
          copyBtn.style.background = tokens.color.primary[600];
        }
      }, 2000);
    });
  }

  // Card interactions
  panel.querySelectorAll('.da-review-card').forEach(card => {
    const cardEl = card as HTMLElement;
    cardEl.addEventListener('mouseenter', () => {
      cardEl.style.borderColor = tokens.color.primary[600] + '66';
      cardEl.style.boxShadow = `0 0 0 1px ${tokens.color.primary[600]}33`;
    });
    cardEl.addEventListener('mouseleave', () => {
      cardEl.style.borderColor = tokens.color.surface.border;
      cardEl.style.boxShadow = 'none';
    });
    cardEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.da-edit-btn') || target.closest('.da-delete-btn')) return;
      const id = cardEl.dataset.id!;
      const annotation = annotations.find(a => a.id === id);
      if (annotation?.element?.isConnected) {
        annotation.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        pulseHighlight(annotation.element);
      }
    });
  });

  // Edit buttons
  panel.querySelectorAll('.da-edit-btn').forEach(btn => {
    const el = btn as HTMLElement;
    el.addEventListener('mouseenter', () => { el.style.background = tokens.color.surface.overlay; el.style.borderColor = tokens.color.text.tertiary; });
    el.addEventListener('mouseleave', () => { el.style.background = tokens.color.surface.elevated; el.style.borderColor = tokens.color.surface.border; });
    el.addEventListener('click', (e) => { e.stopPropagation(); onEdit(el.dataset.id!); });
  });

  // Delete buttons
  panel.querySelectorAll('.da-delete-btn').forEach(btn => {
    const el = btn as HTMLElement;
    el.addEventListener('mouseenter', () => { el.style.background = tokens.color.surface.elevated; el.style.color = tokens.color.error; });
    el.addEventListener('mouseleave', () => { el.style.background = 'transparent'; el.style.color = tokens.color.text.tertiary; });
    el.addEventListener('click', (e) => { e.stopPropagation(); onDelete(el.dataset.id!); });
  });
}

export function hideReviewPanel(): void {
  panel?.remove();
  panel = null;
}

export function isReviewOpen(): boolean {
  return panel !== null;
}
