import { ExtractedStyles } from './types';

function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return rgb;
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
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
    ? '.' + el.className.trim().split(/\s+/).filter(c => !c.startsWith('da-')).slice(0, 2).join('.')
    : '';

  if (id) return `${tag}${id}`;
  if (classes && classes !== '.') return `${tag}${classes}`;
  return tag;
}
