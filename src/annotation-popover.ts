import { ExtractedStyles, Annotation } from './types';

const POPOVER_ID = 'da-annotation-popover';

let popover: HTMLDivElement | null = null;

function formatSpacing(val: string): string {
  return val.replace(/px/g, '').split(' ').map(v => v + 'px').join(' ');
}

function colorSwatch(hex: string): string {
  return `<span style="
    display:inline-block;
    width:12px;
    height:12px;
    background:${hex};
    border:1px solid rgba(0,0,0,0.2);
    border-radius:2px;
    vertical-align:middle;
    margin-right:4px;
  "></span>`;
}

export function showPopover(
  el: HTMLElement,
  styles: ExtractedStyles,
  existing: Annotation | null,
  onSave: (prompt: string, colorSuggestion: string) => void,
  onCancel: () => void,
): void {
  hidePopover();

  const rect = el.getBoundingClientRect();
  popover = document.createElement('div');
  popover.id = POPOVER_ID;

  // Position: prefer right side, fall back to left, then below
  let left = rect.right + 12;
  let top = rect.top;
  if (left + 340 > window.innerWidth) {
    left = rect.left - 340 - 12;
  }
  if (left < 8) {
    left = Math.max(8, rect.left);
    top = rect.bottom + 12;
  }
  if (top + 400 > window.innerHeight) {
    top = Math.max(8, window.innerHeight - 420);
  }

  popover.style.cssText = `
    position: fixed;
    left: ${left}px;
    top: ${top}px;
    width: 320px;
    z-index: 2147483645;
    background: #1E1E1E;
    color: #E0E0E0;
    border: 1px solid #333;
    border-radius: 8px;
    font: 13px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    overflow: hidden;
  `;

  const selector = el.tagName.toLowerCase() +
    (el.id ? `#${el.id}` : '') +
    (el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).filter(c => !c.startsWith('da-')).slice(0, 2).join('.')
      : '');

  popover.innerHTML = `
    <div style="padding:12px 14px;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:600;color:#A78BFA;font-size:12px;">${selector}</span>
      <button id="da-popover-close" style="background:none;border:none;color:#666;cursor:pointer;font-size:16px;padding:0;line-height:1;">&times;</button>
    </div>

    <div style="padding:12px 14px;border-bottom:1px solid #333;max-height:200px;overflow-y:auto;">
      <div style="margin-bottom:8px;">
        <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Font</div>
        <div style="color:#E0E0E0;font-size:12px;">${styles.font.family} &middot; ${styles.font.size} &middot; ${styles.font.weight} &middot; ${styles.font.lineHeight}</div>
      </div>

      <div style="margin-bottom:8px;">
        <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Color</div>
        <div style="color:#E0E0E0;font-size:12px;">
          Text: ${colorSwatch(styles.color.text)}${styles.color.text}
          &nbsp;&nbsp;Bg: ${colorSwatch(styles.color.background)}${styles.color.background}
        </div>
      </div>

      <div style="margin-bottom:8px;">
        <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Spacing</div>
        <div style="color:#E0E0E0;font-size:12px;">
          Margin: ${formatSpacing(styles.spacing.margin)}<br>
          Padding: ${formatSpacing(styles.spacing.padding)}
        </div>
      </div>

      <div>
        <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Alignment</div>
        <div style="color:#E0E0E0;font-size:12px;">${styles.alignment.textAlign} &middot; ${styles.alignment.display} &middot; align: ${styles.alignment.alignItems}</div>
      </div>
    </div>

    <div style="padding:12px 14px;">
      <label for="da-prompt" style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Your prompt</label>
      <textarea
        id="da-prompt"
        rows="3"
        placeholder="What should change?"
        style="
          width:100%;
          box-sizing:border-box;
          background:#2A2A2A;
          border:1px solid #444;
          border-radius:4px;
          color:#E0E0E0;
          font:13px/1.5 -apple-system, BlinkMacSystemFont, sans-serif;
          padding:8px;
          resize:vertical;
          outline:none;
        "
      >${existing?.prompt ?? ''}</textarea>

      <div style="margin-top:8px;display:flex;align-items:center;gap:8px;">
        <label for="da-color" style="color:#888;font-size:11px;white-space:nowrap;">Color suggestion:</label>
        <input
          id="da-color"
          type="text"
          placeholder="#000000"
          value="${existing?.colorSuggestion ?? ''}"
          maxlength="7"
          style="
            flex:1;
            background:#2A2A2A;
            border:1px solid #444;
            border-radius:4px;
            color:#E0E0E0;
            font:12px monospace;
            padding:4px 8px;
            outline:none;
          "
        >
      </div>

      <div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px;">
        <button id="da-popover-cancel" style="
          background:none;
          border:1px solid #444;
          border-radius:4px;
          color:#999;
          padding:6px 14px;
          font-size:12px;
          cursor:pointer;
        ">Cancel</button>
        <button id="da-popover-save" style="
          background:#7C3AED;
          border:none;
          border-radius:4px;
          color:white;
          padding:6px 14px;
          font-size:12px;
          cursor:pointer;
          font-weight:500;
        ">${existing ? 'Update Annotation' : 'Save Annotation'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(popover);

  // Focus the textarea
  const textarea = popover.querySelector<HTMLTextAreaElement>('#da-prompt')!;
  setTimeout(() => textarea.focus(), 50);

  // Event handlers
  popover.querySelector('#da-popover-close')!.addEventListener('click', onCancel);
  popover.querySelector('#da-popover-cancel')!.addEventListener('click', onCancel);

  popover.querySelector('#da-popover-save')!.addEventListener('click', () => {
    const prompt = textarea.value.trim();
    const color = popover!.querySelector<HTMLInputElement>('#da-color')!.value.trim();
    if (!prompt) {
      textarea.style.borderColor = '#EF4444';
      textarea.placeholder = 'Add a prompt to describe what to change';
      textarea.focus();
      return;
    }
    onSave(prompt, color);
  });

  // Cmd+Enter to save
  textarea.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      popover!.querySelector<HTMLButtonElement>('#da-popover-save')!.click();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  });

  // Click color swatches to pre-fill color suggestion
  popover.querySelectorAll<HTMLSpanElement>('[style*="inline-block"][style*="width:12px"]').forEach(swatch => {
    swatch.style.cursor = 'pointer';
    swatch.addEventListener('click', () => {
      const parentText = swatch.parentElement?.textContent || '';
      const hexMatch = parentText.match(/#[A-Fa-f0-9]{6}/);
      if (hexMatch) {
        popover!.querySelector<HTMLInputElement>('#da-color')!.value = hexMatch[0];
      }
    });
  });
}

export function hidePopover(): void {
  popover?.remove();
  popover = null;
}

export function isPopoverOpen(): boolean {
  return popover !== null;
}
