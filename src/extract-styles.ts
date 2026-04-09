import { ExtractedStyles } from './types';

function rgbToHex(color: string): string {
  // Handle rgb/rgba directly
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  // For modern color formats (lab, oklch, oklab, lch, etc.),
  // use canvas to force conversion to hex
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx) {
      ctx.fillStyle = color;
      const result = ctx.fillStyle; // Canvas normalizes to #rrggbb or rgb()
      if (result.startsWith('#')) return result.toUpperCase();
      // Canvas might return rgb() — recurse once
      const rgbMatch = result.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (rgbMatch) {
        return '#' + [rgbMatch[1], rgbMatch[2], rgbMatch[3]]
          .map(v => parseInt(v).toString(16).padStart(2, '0'))
          .join('').toUpperCase();
      }
    }
  } catch {}

  return color; // Return as-is if conversion fails
}

export function extractStyles(el: HTMLElement): ExtractedStyles {
  const computed = window.getComputedStyle(el);

  return {
    font: {
      family: computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
      size: computed.fontSize,
      weight: computed.fontWeight,
      lineHeight: computed.lineHeight,
    },
    color: {
      text: rgbToHex(computed.color),
      background: rgbToHex(computed.backgroundColor),
    },
    spacing: {
      margin: `${computed.marginTop} ${computed.marginRight} ${computed.marginBottom} ${computed.marginLeft}`,
      padding: `${computed.paddingTop} ${computed.paddingRight} ${computed.paddingBottom} ${computed.paddingLeft}`,
    },
    alignment: {
      textAlign: computed.textAlign,
      display: computed.display,
      alignItems: computed.alignItems,
      justifyContent: computed.justifyContent,
    },
  };
}

export function generateSelector(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const classes = el.className && typeof el.className === 'string'
    ? '.' + el.className.trim().split(/\s+/).filter(c => !c.startsWith('pt-')).slice(0, 2).join('.')
    : '';

  if (id) return `${tag}${id}`;
  if (classes && classes !== '.') return `${tag}${classes}`;
  return tag;
}
