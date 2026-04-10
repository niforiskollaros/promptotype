import { ExtractedStyles, Annotation, SourceLocation, DesignChanges } from './types';
import { tokens } from './styles';
import { getUIRoot } from './context';
import { categorizeTailwindClasses } from './tailwind';

/** Ensure a color value is hex format for <input type="color">. */
function toHexForPicker(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  // Paint a pixel and read back as RGB
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    }
  } catch {}
  return '#000000';
}

const POPOVER_ID = 'pt-annotation-popover';

let popover: HTMLDivElement | null = null;

function inputStyle(extra = ''): string {
  return `
    width:100%;box-sizing:border-box;
    background:${tokens.color.surface.base};
    border:1px solid ${tokens.color.surface.border};
    border-radius:${tokens.radius.md};
    color:${tokens.color.text.primary};
    font:${tokens.font.weight.regular} ${tokens.font.size.sm}/${tokens.font.lineHeight.normal} ${tokens.font.family};
    padding:${tokens.space[2]} ${tokens.space[3]};
    outline:none;
    transition:border-color ${tokens.transition.fast};
    ${extra}
  `;
}

function sectionLabel(text: string): string {
  return `<div style="
    color:${tokens.color.text.tertiary};
    font-size:${tokens.font.size.xs};
    font-weight:${tokens.font.weight.medium};
    text-transform:uppercase;
    letter-spacing:0.8px;
    margin-bottom:${tokens.space[1]};
  ">${text}</div>`;
}

// --- Live preview ---
let previewOriginals: Map<string, string> | null = null;
let previewElement: HTMLElement | null = null;

function applyPreview(el: HTMLElement, prop: string, value: string): void {
  if (!previewOriginals) previewOriginals = new Map();
  if (!previewOriginals.has(prop)) {
    previewOriginals.set(prop, (el.style as any)[prop] || '');
  }
  (el.style as any)[prop] = value;
  previewElement = el;
}

function revertPreview(): void {
  if (previewOriginals && previewElement) {
    for (const [prop, original] of previewOriginals) {
      if (prop === '__textContent') {
        previewElement.textContent = original;
      } else {
        (previewElement.style as any)[prop] = original;
      }
    }
  }
  previewOriginals = null;
  previewElement = null;
}

export function showPopover(
  el: HTMLElement,
  styles: ExtractedStyles,
  existing: Annotation | null,
  onSave: (prompt: string, colorSuggestion: string, changes: DesignChanges) => void,
  onCancel: () => void,
  source?: SourceLocation | null,
  cssClasses?: string[],
  textContent?: string,
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
  if (top < 12) top = 12;
  const maxHeight = window.innerHeight - top - 12;

  popover.style.cssText = `
    position: fixed;
    left: ${left}px;
    top: ${top}px;
    width: 360px;
    max-height: ${maxHeight}px;
    z-index: ${tokens.z.popover};
    background: ${tokens.color.surface.raised};
    color: ${tokens.color.text.primary};
    border: 1px solid ${tokens.color.surface.border};
    border-radius: ${tokens.radius.xl};
    font: ${tokens.font.weight.regular} ${tokens.font.size.base}/${tokens.font.lineHeight.normal} ${tokens.font.family};
    box-shadow: ${tokens.shadow.xl};
    overflow-y: auto;
    animation: pt-scale-in 0.15s ease-out;
  `;

  const selector = el.tagName.toLowerCase() +
    (el.id ? `#${el.id}` : '') +
    (el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).filter(c => !c.startsWith('pt-')).slice(0, 2).join('.')
      : '');

  const componentName = source?.componentName;
  const dims = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
  const classes = cssClasses || [];
  const tw = categorizeTailwindClasses(classes);
  const existingChanges = existing?.changes || {};

  // --- Header ---
  const headerHtml = `
    <div style="
      padding:${tokens.space[3]} ${tokens.space[4]};
      border-bottom:1px solid ${tokens.color.surface.border};
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
    ">
      <div style="min-width:0;flex:1;">
        ${componentName ? `<div style="
          font-weight:${tokens.font.weight.semibold};
          color:${tokens.color.primary[400]};
          font-size:${tokens.font.size.sm};
        ">&lt;${componentName}&gt;</div>` : ''}
        <div style="
          color:${componentName ? tokens.color.text.tertiary : tokens.color.primary[400]};
          font-size:${tokens.font.size.xs};
          font-family:${tokens.font.mono};
          ${componentName ? '' : 'font-weight:' + tokens.font.weight.semibold + ';'}
        ">${selector} · ${dims}</div>
        ${source ? `<div style="
          font-size:10px;
          font-family:${tokens.font.mono};
          color:${tokens.color.text.tertiary};
          margin-top:2px;
        ">${source.fileName}:${source.lineNumber}</div>` : ''}
      </div>
      <button id="pt-popover-close" style="
        background:${tokens.color.surface.elevated};
        border:none;
        color:${tokens.color.text.tertiary};
        cursor:pointer;
        width:24px;height:24px;
        border-radius:${tokens.radius.sm};
        display:flex;align-items:center;justify-content:center;
        font-size:14px;flex-shrink:0;
        transition:background ${tokens.transition.fast}, color ${tokens.transition.fast};
      ">×</button>
    </div>
  `;

  // --- Editable Text ---
  const currentText = textContent || '';
  const textHtml = currentText ? `
    <div style="padding:${tokens.space[3]} ${tokens.space[4]};border-bottom:1px solid ${tokens.color.surface.border};">
      ${sectionLabel('Text Content')}
      <input id="pt-edit-text" type="text" value="${currentText.replace(/"/g, '&quot;')}"
        style="${inputStyle('font-size:' + tokens.font.size.md + ';')}"
        placeholder="Element text"
      >
    </div>
  ` : '';

  // --- Editable Colors ---
  const textColorHexVal = toHexForPicker(styles.color.text);
  const bgColorHexVal = toHexForPicker(styles.color.background);
  const colorsHtml = `
    <div style="padding:${tokens.space[3]} ${tokens.space[4]};border-bottom:1px solid ${tokens.color.surface.border};">
      ${sectionLabel('Colors')}
      <div style="display:flex;gap:${tokens.space[3]};">
        <label style="flex:1;display:flex;align-items:center;gap:${tokens.space[2]};font-size:${tokens.font.size.xs};color:${tokens.color.text.secondary};">
          <input id="pt-edit-text-color" type="color" value="${textColorHexVal}"
            style="width:28px;height:28px;border:1px solid ${tokens.color.surface.border};border-radius:${tokens.radius.sm};background:none;cursor:pointer;padding:0;">
          <span>Text</span>
          <span id="pt-text-color-hex" style="font-family:${tokens.font.mono};color:${tokens.color.text.tertiary};font-size:10px;">${textColorHexVal}</span>
        </label>
        <label style="flex:1;display:flex;align-items:center;gap:${tokens.space[2]};font-size:${tokens.font.size.xs};color:${tokens.color.text.secondary};">
          <input id="pt-edit-bg-color" type="color" value="${bgColorHexVal}"
            style="width:28px;height:28px;border:1px solid ${tokens.color.surface.border};border-radius:${tokens.radius.sm};background:none;cursor:pointer;padding:0;">
          <span>Background</span>
          <span id="pt-bg-color-hex" style="font-family:${tokens.font.mono};color:${tokens.color.text.tertiary};font-size:10px;">${bgColorHexVal}</span>
        </label>
      </div>
    </div>
  `;

  // --- Tailwind Classes (editable chips) ---
  let classesHtml = '';
  if (tw.detected && classes.length > 0) {
    const allClasses = classes;
    const removedSet = new Set(existingChanges.removeClasses || []);
    const chips = allClasses.map(cls => {
      const removed = removedSet.has(cls);
      return `<span class="pt-class-chip" data-class="${cls}" style="
        display:inline-flex;align-items:center;gap:4px;
        padding:2px 8px;
        border-radius:${tokens.radius.full};
        font-size:${tokens.font.size.xs};
        font-family:${tokens.font.mono};
        background:${removed ? tokens.color.surface.base : tokens.color.surface.elevated};
        color:${removed ? tokens.color.text.tertiary : tokens.color.text.secondary};
        border:1px solid ${removed ? tokens.color.error + '44' : tokens.color.surface.border};
        cursor:pointer;
        text-decoration:${removed ? 'line-through' : 'none'};
        transition:all ${tokens.transition.fast};
      ">
        ${cls}
        <span class="pt-chip-x" style="color:${tokens.color.text.tertiary};font-size:10px;line-height:1;">×</span>
      </span>`;
    }).join('');

    classesHtml = `
      <details style="padding:${tokens.space[3]} ${tokens.space[4]};border-bottom:1px solid ${tokens.color.surface.border};">
        <summary style="
          color:${tokens.color.text.tertiary};
          font-size:${tokens.font.size.xs};
          font-weight:${tokens.font.weight.medium};
          text-transform:uppercase;
          letter-spacing:0.8px;
          cursor:pointer;
          user-select:none;
        ">Tailwind Classes <span style="color:${tokens.color.text.tertiary};font-weight:${tokens.font.weight.regular};text-transform:none;letter-spacing:0;">(${allClasses.length})</span></summary>
        <div id="pt-class-chips" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:${tokens.space[2]};margin-bottom:${tokens.space[2]};">
          ${chips}
        </div>
        <div style="display:flex;gap:${tokens.space[2]};">
          <input id="pt-add-class" type="text" placeholder="Add class..."
            style="${inputStyle('flex:1;font-family:' + tokens.font.mono + ';font-size:' + tokens.font.size.xs + ';padding:4px 8px;')}"
          >
        </div>
      </details>
    `;
  } else if (classes.length > 0) {
    classesHtml = `
      <details style="padding:${tokens.space[3]} ${tokens.space[4]};border-bottom:1px solid ${tokens.color.surface.border};">
        <summary style="
          color:${tokens.color.text.tertiary};
          font-size:${tokens.font.size.xs};
          font-weight:${tokens.font.weight.medium};
          cursor:pointer;
          user-select:none;
        ">Classes (${classes.length})</summary>
        <div style="margin-top:${tokens.space[2]};font-size:${tokens.font.size.xs};font-family:${tokens.font.mono};color:${tokens.color.text.secondary};word-break:break-all;">
          ${classes.join(' ')}
        </div>
      </details>
    `;
  }

  // --- Editable styles ---
  const miniInput = (id: string, value: string, width = '60px') => `
    <input id="${id}" type="text" value="${value}"
      style="width:${width};background:${tokens.color.surface.base};border:1px solid ${tokens.color.surface.border};
      border-radius:${tokens.radius.sm};color:${tokens.color.text.primary};
      font:${tokens.font.weight.regular} ${tokens.font.size.xs}/${tokens.font.lineHeight.tight} ${tokens.font.mono};
      padding:2px 6px;outline:none;text-align:center;
      transition:border-color ${tokens.transition.fast};">
  `;

  const styleRow = (label: string, content: string) => `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
      <span style="color:${tokens.color.text.tertiary};font-size:${tokens.font.size.xs};width:52px;flex-shrink:0;">${label}</span>
      <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">${content}</div>
    </div>
  `;

  const computedHtml = `
    <details style="padding:${tokens.space[3]} ${tokens.space[4]};border-bottom:1px solid ${tokens.color.surface.border};">
      <summary style="
        color:${tokens.color.text.tertiary};
        font-size:${tokens.font.size.xs};
        font-weight:${tokens.font.weight.medium};
        cursor:pointer;
        user-select:none;
      ">Styles</summary>
      <div style="margin-top:${tokens.space[2]};font-size:${tokens.font.size.xs};color:${tokens.color.text.secondary};">
        ${styleRow('Font', `
          <span style="color:${tokens.color.text.tertiary};">${styles.font.family}</span>
          ${miniInput('pt-edit-font-size', styles.font.size, '52px')}
          ${miniInput('pt-edit-font-weight', styles.font.weight, '44px')}
          <span style="color:${tokens.color.text.tertiary};">/</span>
          ${miniInput('pt-edit-line-height', styles.font.lineHeight, '52px')}
        `)}
        ${styleRow('Margin', miniInput('pt-edit-margin', styles.spacing.margin, '100%'))}
        ${styleRow('Padding', miniInput('pt-edit-padding', styles.spacing.padding, '100%'))}
        ${styleRow('Layout', `
          <span style="color:${tokens.color.text.secondary};font-family:${tokens.font.mono};">
            ${styles.alignment.display} · ${styles.alignment.textAlign} · align: ${styles.alignment.alignItems}
          </span>
        `)}
      </div>
    </details>
  `;

  // --- Prompt + Actions ---
  const promptHtml = `
    <div style="padding:${tokens.space[4]};">
      ${sectionLabel('Additional Instructions (optional)')}
      <textarea
        id="pt-prompt"
        rows="2"
        placeholder="Anything else the AI should know..."
        style="${inputStyle('resize:vertical;font-size:' + tokens.font.size.sm + ';')}"
      >${existing?.prompt ?? ''}</textarea>

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
          <button id="pt-popover-cancel" style="
            background:transparent;
            border:1px solid ${tokens.color.surface.border};
            border-radius:${tokens.radius.md};
            color:${tokens.color.text.secondary};
            padding:${tokens.space[2]} ${tokens.space[4]};
            font:${tokens.font.weight.regular} ${tokens.font.size.sm}/${tokens.font.lineHeight.tight} ${tokens.font.family};
            cursor:pointer;
            transition:background ${tokens.transition.fast}, border-color ${tokens.transition.fast};
          ">Cancel</button>
          <button id="pt-popover-save" style="
            background:${tokens.color.primary[600]};
            border:none;
            border-radius:${tokens.radius.md};
            color:white;
            padding:${tokens.space[2]} ${tokens.space[4]};
            font:${tokens.font.weight.medium} ${tokens.font.size.sm}/${tokens.font.lineHeight.tight} ${tokens.font.family};
            cursor:pointer;
            transition:background ${tokens.transition.fast}, transform ${tokens.transition.fast};
          ">${existing ? 'Update' : 'Save'}</button>
        </div>
      </div>
    </div>
  `;

  popover.innerHTML = headerHtml + textHtml + colorsHtml + classesHtml + computedHtml + promptHtml;
  getUIRoot().appendChild(popover);

  // --- Wire up events ---
  const textarea = popover.querySelector<HTMLTextAreaElement>('#pt-prompt')!;
  const closeBtn = popover.querySelector<HTMLButtonElement>('#pt-popover-close')!;
  const cancelBtn = popover.querySelector<HTMLButtonElement>('#pt-popover-cancel')!;
  const saveBtn = popover.querySelector<HTMLButtonElement>('#pt-popover-save')!;
  const textInput = popover.querySelector<HTMLInputElement>('#pt-edit-text');
  const textColorInput = popover.querySelector<HTMLInputElement>('#pt-edit-text-color')!;
  const bgColorInput = popover.querySelector<HTMLInputElement>('#pt-edit-bg-color')!;
  const textColorHex = popover.querySelector<HTMLSpanElement>('#pt-text-color-hex')!;
  const bgColorHex = popover.querySelector<HTMLSpanElement>('#pt-bg-color-hex')!;
  const addClassInput = popover.querySelector<HTMLInputElement>('#pt-add-class');

  // Track removed classes
  const removedClasses = new Set<string>(existingChanges.removeClasses || []);
  const addedClasses: string[] = [...(existingChanges.addClasses || [])];

  setTimeout(() => (textInput || textarea).focus(), 50);

  // Color picker updates + live preview
  textColorInput?.addEventListener('input', () => {
    textColorHex.textContent = textColorInput.value.toUpperCase();
    applyPreview(el, 'color', textColorInput.value);
  });
  bgColorInput?.addEventListener('input', () => {
    bgColorHex.textContent = bgColorInput.value.toUpperCase();
    applyPreview(el, 'backgroundColor', bgColorInput.value);
  });

  // Text input live preview
  const originalTextContent = el.textContent || '';
  textInput?.addEventListener('input', () => {
    // Only preview if element has direct text (not complex children)
    if (el.childNodes.length <= 1 || (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE)) {
      if (!previewOriginals) previewOriginals = new Map();
      if (!previewOriginals.has('__textContent')) {
        previewOriginals.set('__textContent', originalTextContent);
        previewElement = el;
      }
      el.textContent = textInput.value;
    }
  });

  // Style input live preview
  const stylePreviewMap: Record<string, string> = {
    'pt-edit-font-size': 'fontSize',
    'pt-edit-font-weight': 'fontWeight',
    'pt-edit-line-height': 'lineHeight',
  };
  for (const [inputId, cssProp] of Object.entries(stylePreviewMap)) {
    const input = popover.querySelector<HTMLInputElement>(`#${inputId}`);
    input?.addEventListener('input', () => {
      if (input.value.trim()) applyPreview(el, cssProp, input.value.trim());
    });
  }
  const marginInput = popover.querySelector<HTMLInputElement>('#pt-edit-margin');
  marginInput?.addEventListener('input', () => {
    if (marginInput.value.trim()) applyPreview(el, 'margin', marginInput.value.trim());
  });
  const paddingInput = popover.querySelector<HTMLInputElement>('#pt-edit-padding');
  paddingInput?.addEventListener('input', () => {
    if (paddingInput.value.trim()) applyPreview(el, 'padding', paddingInput.value.trim());
  });

  // Class chip toggle (click to mark for removal)
  popover.querySelectorAll('.pt-class-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cls = (chip as HTMLElement).dataset.class!;
      if (removedClasses.has(cls)) {
        removedClasses.delete(cls);
        (chip as HTMLElement).style.textDecoration = 'none';
        (chip as HTMLElement).style.background = tokens.color.surface.elevated;
        (chip as HTMLElement).style.color = tokens.color.text.secondary;
        (chip as HTMLElement).style.borderColor = tokens.color.surface.border;
      } else {
        removedClasses.add(cls);
        (chip as HTMLElement).style.textDecoration = 'line-through';
        (chip as HTMLElement).style.background = tokens.color.surface.base;
        (chip as HTMLElement).style.color = tokens.color.text.tertiary;
        (chip as HTMLElement).style.borderColor = tokens.color.error + '44';
      }
    });
  });

  // Add class on Enter
  addClassInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const cls = addClassInput.value.trim();
      if (cls && !addedClasses.includes(cls)) {
        addedClasses.push(cls);
        const chip = document.createElement('span');
        chip.className = 'pt-class-chip';
        chip.style.cssText = `
          display:inline-flex;align-items:center;gap:4px;
          padding:2px 8px;border-radius:${tokens.radius.full};
          font-size:${tokens.font.size.xs};font-family:${tokens.font.mono};
          background:${tokens.color.primary[600]}22;
          color:${tokens.color.primary[400]};
          border:1px solid ${tokens.color.primary[600]}44;
        `;
        chip.innerHTML = `+ ${cls} <span class="pt-chip-x" style="color:${tokens.color.text.tertiary};font-size:10px;cursor:pointer;">×</span>`;
        chip.querySelector('.pt-chip-x')!.addEventListener('click', () => {
          const idx = addedClasses.indexOf(cls);
          if (idx !== -1) addedClasses.splice(idx, 1);
          chip.remove();
        });
        popover!.querySelector('#pt-class-chips')?.appendChild(chip);
        addClassInput.value = '';
      }
    }
  });

  // Style inputs (wired after DOM insert)
  const getVal = (id: string) => popover!.querySelector<HTMLInputElement>(id)?.value?.trim() || '';

  // Collect changes on save
  function collectChanges(): DesignChanges {
    const changes: DesignChanges = {};

    // Text change
    if (textInput && textInput.value !== currentText) {
      changes.text = textInput.value;
    }

    // Color changes
    if (textColorInput.value.toUpperCase() !== textColorHexVal.toUpperCase()) {
      changes.textColor = textColorInput.value.toUpperCase();
    }
    if (bgColorInput.value.toUpperCase() !== bgColorHexVal.toUpperCase()) {
      changes.bgColor = bgColorInput.value.toUpperCase();
    }

    // Style changes
    const newFontSize = getVal('#pt-edit-font-size');
    if (newFontSize && newFontSize !== styles.font.size) changes.fontSize = newFontSize;

    const newFontWeight = getVal('#pt-edit-font-weight');
    if (newFontWeight && newFontWeight !== styles.font.weight) changes.fontWeight = newFontWeight;

    const newLineHeight = getVal('#pt-edit-line-height');
    if (newLineHeight && newLineHeight !== styles.font.lineHeight) changes.lineHeight = newLineHeight;

    const newMargin = getVal('#pt-edit-margin');
    if (newMargin && newMargin !== styles.spacing.margin) changes.margin = newMargin;

    const newPadding = getVal('#pt-edit-padding');
    if (newPadding && newPadding !== styles.spacing.padding) changes.padding = newPadding;

    // Class changes
    if (removedClasses.size > 0) {
      changes.removeClasses = [...removedClasses];
    }
    if (addedClasses.length > 0) {
      changes.addClasses = [...addedClasses];
    }

    return changes;
  }

  // Close / Cancel
  closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = tokens.color.surface.overlay; closeBtn.style.color = tokens.color.text.primary; });
  closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = tokens.color.surface.elevated; closeBtn.style.color = tokens.color.text.tertiary; });
  closeBtn.addEventListener('click', () => { revertPreview(); onCancel(); });

  cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.background = tokens.color.surface.elevated; cancelBtn.style.borderColor = tokens.color.text.tertiary; });
  cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.background = 'transparent'; cancelBtn.style.borderColor = tokens.color.surface.border; });
  cancelBtn.addEventListener('click', () => { revertPreview(); onCancel(); });

  // Save
  saveBtn.addEventListener('mouseenter', () => { saveBtn.style.background = tokens.color.primary[700]; saveBtn.style.transform = 'translateY(-1px)'; });
  saveBtn.addEventListener('mouseleave', () => { saveBtn.style.background = tokens.color.primary[600]; saveBtn.style.transform = 'translateY(0)'; });
  saveBtn.addEventListener('mousedown', () => { saveBtn.style.transform = 'scale(0.98)'; });
  saveBtn.addEventListener('mouseup', () => { saveBtn.style.transform = 'translateY(-1px)'; });
  saveBtn.addEventListener('click', () => {
    const prompt = textarea.value.trim();
    const changes = collectChanges();
    // Revert preview — the agent will make the real change in code
    revertPreview();
    const colorSuggestion = changes.bgColor || changes.textColor || existing?.colorSuggestion || '';
    onSave(prompt, colorSuggestion, changes);
  });

  // Cmd+Enter to save
  popover.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveBtn.click(); }
    if (e.key === 'Escape') { e.preventDefault(); revertPreview(); onCancel(); }
  });
}

export function hidePopover(): void {
  revertPreview();
  popover?.remove();
  popover = null;
}

export function isPopoverOpen(): boolean {
  return popover !== null;
}
