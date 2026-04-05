import { ExtractedStyles, Annotation } from './types';
import { tokens } from './styles';

const POPOVER_ID = 'da-annotation-popover';

let popover: HTMLDivElement | null = null;

function colorChip(hex: string, label: string): string {
  return `
    <div class="da-color-chip" data-hex="${hex}" style="
      display:inline-flex;
      align-items:center;
      gap:${tokens.space[1]};
      background:${tokens.color.surface.elevated};
      border:1px solid ${tokens.color.surface.border};
      border-radius:${tokens.radius.full};
      padding:2px 8px 2px 4px;
      cursor:pointer;
      transition:border-color ${tokens.transition.fast};
      font-size:${tokens.font.size.xs};
    ">
      <span style="
        width:14px;
        height:14px;
        background:${hex};
        border-radius:${tokens.radius.full};
        border:1px solid rgba(255,255,255,0.1);
        flex-shrink:0;
      "></span>
      <span style="color:${tokens.color.text.secondary};font-family:${tokens.font.mono};font-size:${tokens.font.size.xs};">${label}: ${hex}</span>
    </div>
  `;
}

function propertySection(title: string, content: string): string {
  return `
    <div style="margin-bottom:${tokens.space[3]};">
      <div style="
        color:${tokens.color.text.tertiary};
        font-size:${tokens.font.size.xs};
        font-weight:${tokens.font.weight.medium};
        text-transform:uppercase;
        letter-spacing:0.8px;
        margin-bottom:${tokens.space[1]};
      ">${title}</div>
      <div style="color:${tokens.color.text.primary};font-size:${tokens.font.size.sm};line-height:${tokens.font.lineHeight.relaxed};">
        ${content}
      </div>
    </div>
  `;
}

function formatSpacing(val: string): string {
  return val.replace(/px/g, '').split(' ').map(v => {
    const num = parseFloat(v);
    return `<span style="
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-width:28px;
      height:20px;
      background:${num === 0 ? tokens.color.surface.elevated : tokens.color.surface.overlay};
      border-radius:${tokens.radius.sm};
      font-family:${tokens.font.mono};
      font-size:${tokens.font.size.xs};
      color:${num === 0 ? tokens.color.text.tertiary : tokens.color.text.primary};
      padding:0 4px;
    ">${v}</span>`;
  }).join(' ');
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

  // Smart positioning
  let left = rect.right + 16;
  let top = rect.top;
  if (left + 360 > window.innerWidth) left = rect.left - 360 - 16;
  if (left < 12) { left = Math.max(12, rect.left); top = rect.bottom + 16; }
  if (top + 460 > window.innerHeight) top = Math.max(12, window.innerHeight - 480);

  popover.style.cssText = `
    position: fixed;
    left: ${left}px;
    top: ${top}px;
    width: 340px;
    z-index: ${tokens.z.popover};
    background: ${tokens.color.surface.raised};
    color: ${tokens.color.text.primary};
    border: 1px solid ${tokens.color.surface.border};
    border-radius: ${tokens.radius.xl};
    font: ${tokens.font.weight.regular} ${tokens.font.size.base}/${tokens.font.lineHeight.normal} ${tokens.font.family};
    box-shadow: ${tokens.shadow.xl};
    overflow: hidden;
    animation: da-scale-in 0.15s ease-out;
  `;

  const selector = el.tagName.toLowerCase() +
    (el.id ? `#${el.id}` : '') +
    (el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).filter(c => !c.startsWith('da-')).slice(0, 2).join('.')
      : '');

  const fontInfo = `
    <span style="font-weight:${tokens.font.weight.medium};color:${tokens.color.text.primary};">${styles.font.family}</span>
    <span style="color:${tokens.color.text.tertiary};">·</span>
    ${styles.font.size}
    <span style="color:${tokens.color.text.tertiary};">·</span>
    <span style="font-weight:${styles.font.weight};">${styles.font.weight}</span>
    <span style="color:${tokens.color.text.tertiary};">·</span>
    <span style="color:${tokens.color.text.secondary};">/${styles.font.lineHeight}</span>
  `;

  const colorInfo = `
    <div style="display:flex;flex-wrap:wrap;gap:${tokens.space[2]};">
      ${colorChip(styles.color.text, 'Text')}
      ${colorChip(styles.color.background, 'Bg')}
    </div>
  `;

  const spacingInfo = `
    <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center;">
      <span style="color:${tokens.color.text.tertiary};font-size:${tokens.font.size.xs};">Margin</span>
      <div style="display:flex;gap:2px;">${formatSpacing(styles.spacing.margin)}</div>
      <span style="color:${tokens.color.text.tertiary};font-size:${tokens.font.size.xs};">Padding</span>
      <div style="display:flex;gap:2px;">${formatSpacing(styles.spacing.padding)}</div>
    </div>
  `;

  const alignInfo = `
    <div style="display:flex;flex-wrap:wrap;gap:${tokens.space[1]};">
      ${[styles.alignment.textAlign, styles.alignment.display, `align: ${styles.alignment.alignItems}`]
        .filter(v => v && !v.includes('normal'))
        .map(v => `<span style="
          background:${tokens.color.surface.elevated};
          border-radius:${tokens.radius.sm};
          padding:2px 6px;
          font-size:${tokens.font.size.xs};
          font-family:${tokens.font.mono};
          color:${tokens.color.text.secondary};
        ">${v}</span>`).join('')}
    </div>
  `;

  popover.innerHTML = `
    <div style="
      padding:${tokens.space[3]} ${tokens.space[4]};
      border-bottom:1px solid ${tokens.color.surface.border};
      display:flex;
      justify-content:space-between;
      align-items:center;
    ">
      <span style="
        font-weight:${tokens.font.weight.semibold};
        color:${tokens.color.primary[400]};
        font-size:${tokens.font.size.sm};
        font-family:${tokens.font.mono};
      ">${selector}</span>
      <button id="da-popover-close" style="
        background:${tokens.color.surface.elevated};
        border:none;
        color:${tokens.color.text.tertiary};
        cursor:pointer;
        width:24px;
        height:24px;
        border-radius:${tokens.radius.sm};
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:14px;
        transition:background ${tokens.transition.fast}, color ${tokens.transition.fast};
      ">×</button>
    </div>

    <div style="
      padding:${tokens.space[4]};
      border-bottom:1px solid ${tokens.color.surface.border};
      max-height:220px;
      overflow-y:auto;
    ">
      ${propertySection('Typography', fontInfo)}
      ${propertySection('Color', colorInfo)}
      ${propertySection('Spacing', spacingInfo)}
      ${propertySection('Layout', alignInfo)}
    </div>

    <div style="padding:${tokens.space[4]};">
      <label for="da-prompt" style="
        display:block;
        color:${tokens.color.text.secondary};
        font-size:${tokens.font.size.xs};
        font-weight:${tokens.font.weight.medium};
        text-transform:uppercase;
        letter-spacing:0.8px;
        margin-bottom:${tokens.space[2]};
      ">Your prompt</label>
      <textarea
        id="da-prompt"
        rows="3"
        placeholder="What should change?"
        style="
          width:100%;
          box-sizing:border-box;
          background:${tokens.color.surface.base};
          border:1px solid ${tokens.color.surface.border};
          border-radius:${tokens.radius.md};
          color:${tokens.color.text.primary};
          font:${tokens.font.weight.regular} ${tokens.font.size.base}/${tokens.font.lineHeight.normal} ${tokens.font.family};
          padding:${tokens.space[3]};
          resize:vertical;
          outline:none;
          transition:border-color ${tokens.transition.fast}, box-shadow ${tokens.transition.fast};
        "
      >${existing?.prompt ?? ''}</textarea>

      <div style="margin-top:${tokens.space[3]};display:flex;align-items:center;gap:${tokens.space[2]};">
        <label for="da-color" style="color:${tokens.color.text.tertiary};font-size:${tokens.font.size.xs};white-space:nowrap;">Suggest color:</label>
        <div style="
          position:relative;
          flex:1;
          display:flex;
          align-items:center;
        ">
          <span id="da-color-preview" style="
            position:absolute;
            left:8px;
            width:16px;
            height:16px;
            border-radius:${tokens.radius.sm};
            border:1px solid ${tokens.color.surface.border};
            background:transparent;
          "></span>
          <input
            id="da-color"
            type="text"
            placeholder="#000000"
            value="${existing?.colorSuggestion ?? ''}"
            maxlength="7"
            style="
              width:100%;
              background:${tokens.color.surface.base};
              border:1px solid ${tokens.color.surface.border};
              border-radius:${tokens.radius.md};
              color:${tokens.color.text.primary};
              font:${tokens.font.weight.regular} ${tokens.font.size.sm}/${tokens.font.lineHeight.tight} ${tokens.font.mono};
              padding:${tokens.space[2]} ${tokens.space[2]} ${tokens.space[2]} 32px;
              outline:none;
              transition:border-color ${tokens.transition.fast};
            "
          >
        </div>
      </div>

      <div style="
        margin-top:${tokens.space[4]};
        display:flex;
        justify-content:space-between;
        align-items:center;
      ">
        <span style="color:${tokens.color.text.tertiary};font-size:${tokens.font.size.xs};">
          <kbd style="
            background:${tokens.color.surface.elevated};
            border:1px solid ${tokens.color.surface.border};
            border-radius:${tokens.radius.sm};
            padding:1px 4px;
            font-size:10px;
          ">⌘↵</kbd> to save
        </span>
        <div style="display:flex;gap:${tokens.space[2]};">
          <button id="da-popover-cancel" style="
            background:transparent;
            border:1px solid ${tokens.color.surface.border};
            border-radius:${tokens.radius.md};
            color:${tokens.color.text.secondary};
            padding:${tokens.space[2]} ${tokens.space[4]};
            font:${tokens.font.weight.regular} ${tokens.font.size.sm}/${tokens.font.lineHeight.tight} ${tokens.font.family};
            cursor:pointer;
            transition:background ${tokens.transition.fast}, border-color ${tokens.transition.fast};
          ">Cancel</button>
          <button id="da-popover-save" style="
            background:${tokens.color.primary[600]};
            border:none;
            border-radius:${tokens.radius.md};
            color:white;
            padding:${tokens.space[2]} ${tokens.space[4]};
            font:${tokens.font.weight.medium} ${tokens.font.size.sm}/${tokens.font.lineHeight.tight} ${tokens.font.family};
            cursor:pointer;
            transition:background ${tokens.transition.fast}, transform ${tokens.transition.fast};
          ">${existing ? 'Update' : 'Save Annotation'}</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(popover);

  // Focus textarea
  const textarea = popover.querySelector<HTMLTextAreaElement>('#da-prompt')!;
  const colorInput = popover.querySelector<HTMLInputElement>('#da-color')!;
  const colorPreview = popover.querySelector<HTMLSpanElement>('#da-color-preview')!;
  const closeBtn = popover.querySelector<HTMLButtonElement>('#da-popover-close')!;
  const cancelBtn = popover.querySelector<HTMLButtonElement>('#da-popover-cancel')!;
  const saveBtn = popover.querySelector<HTMLButtonElement>('#da-popover-save')!;

  setTimeout(() => textarea.focus(), 50);

  // Focus styles for textarea
  textarea.addEventListener('focus', () => {
    textarea.style.borderColor = tokens.color.primary[600];
    textarea.style.boxShadow = `0 0 0 2px ${tokens.color.primary[600]}33`;
  });
  textarea.addEventListener('blur', () => {
    textarea.style.borderColor = tokens.color.surface.border;
    textarea.style.boxShadow = 'none';
  });

  // Color preview
  const updateColorPreview = () => {
    const val = colorInput.value.trim();
    if (/^#[A-Fa-f0-9]{6}$/.test(val)) {
      colorPreview.style.background = val;
    } else {
      colorPreview.style.background = 'transparent';
    }
  };
  colorInput.addEventListener('input', updateColorPreview);
  updateColorPreview();

  // Close button hover
  closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = tokens.color.surface.overlay; closeBtn.style.color = tokens.color.text.primary; });
  closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = tokens.color.surface.elevated; closeBtn.style.color = tokens.color.text.tertiary; });
  closeBtn.addEventListener('click', onCancel);

  // Cancel hover
  cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.background = tokens.color.surface.elevated; cancelBtn.style.borderColor = tokens.color.text.tertiary; });
  cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.background = 'transparent'; cancelBtn.style.borderColor = tokens.color.surface.border; });
  cancelBtn.addEventListener('click', onCancel);

  // Save hover + press
  saveBtn.addEventListener('mouseenter', () => { saveBtn.style.background = tokens.color.primary[700]; saveBtn.style.transform = 'translateY(-1px)'; });
  saveBtn.addEventListener('mouseleave', () => { saveBtn.style.background = tokens.color.primary[600]; saveBtn.style.transform = 'translateY(0)'; });
  saveBtn.addEventListener('mousedown', () => { saveBtn.style.transform = 'scale(0.98)'; });
  saveBtn.addEventListener('mouseup', () => { saveBtn.style.transform = 'translateY(-1px)'; });
  saveBtn.addEventListener('click', () => {
    const prompt = textarea.value.trim();
    const color = colorInput.value.trim();
    onSave(prompt, color);
  });

  // Cmd+Enter to save, Escape to cancel
  textarea.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveBtn.click(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  });

  // Clickable color chips → pre-fill color suggestion
  popover.querySelectorAll<HTMLDivElement>('.da-color-chip').forEach(chip => {
    chip.addEventListener('mouseenter', () => { chip.style.borderColor = tokens.color.primary[500]; });
    chip.addEventListener('mouseleave', () => { chip.style.borderColor = tokens.color.surface.border; });
    chip.addEventListener('click', () => {
      const hex = chip.dataset.hex;
      if (hex) {
        colorInput.value = hex;
        updateColorPreview();
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
