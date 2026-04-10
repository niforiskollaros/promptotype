/**
 * Tailwind CSS class detection and categorization.
 * Identifies Tailwind utility classes on elements and groups them
 * so agents know exactly which class to modify.
 */

export interface TailwindInfo {
  detected: boolean;
  categories: Record<string, string[]>;
  other: string[]; // Non-Tailwind or unrecognized classes
}

// Tailwind prefix patterns grouped by category
const TAILWIND_PATTERNS: Record<string, RegExp[]> = {
  typography: [
    /^(text-(xs|sm|base|lg|xl|[2-9]xl)|font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|sans|serif|mono)|leading-|tracking-|line-clamp-|truncate|uppercase|lowercase|capitalize|normal-case|italic|not-italic|underline|overline|line-through|no-underline|antialiased|subpixel-antialiased)/,
  ],
  color: [
    /^(text|bg|border|ring|outline|accent|caret|fill|stroke|decoration|shadow)-(transparent|current|black|white|inherit|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|primary|secondary|muted|accent|foreground|background|destructive|popover|card|input)/,
    /^(bg|text|border|ring)-\[#[0-9a-fA-F]+\]/,
    /^(bg|text|border|ring)-\[rgb/,
    /^(bg|text|border|ring)-\[hsl/,
    /^(bg|text|border|ring)-\[oklch/,
  ],
  spacing: [
    /^(p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y|indent)-(0|px|[0-9]|auto|\[)/,
  ],
  sizing: [
    /^(w|h|min-w|min-h|max-w|max-h|size)-(0|px|full|screen|auto|min|max|fit|[0-9]|\[)/,
  ],
  layout: [
    /^(flex|grid|block|inline|hidden|contents|table|flow-root|inline-flex|inline-block|inline-grid)/,
    /^(flex-(row|col|wrap|nowrap|1|auto|initial|none)|grow|shrink|basis-|order-)/,
    /^(grid-cols-|grid-rows-|col-span-|row-span-|auto-cols-|auto-rows-)/,
    /^(justify-|items-|self-|content-|place-)/,
  ],
  position: [
    /^(relative|absolute|fixed|sticky|static|inset|top|right|bottom|left|z)-?/,
  ],
  border: [
    /^(border|rounded|divide|ring|outline)(-|$)/,
  ],
  effects: [
    /^(shadow|opacity|mix-blend|bg-blend|blur|brightness|contrast|grayscale|hue-rotate|invert|saturate|sepia|backdrop-|drop-shadow)/,
  ],
  transitions: [
    /^(transition|duration|ease|delay|animate)-?/,
  ],
  overflow: [
    /^(overflow|overscroll)-/,
  ],
};

/** Check if a class looks like a Tailwind utility. */
function matchCategory(cls: string): string | null {
  // Strip responsive/state prefixes: sm:, md:, lg:, hover:, focus:, dark:, etc.
  const stripped = cls.replace(/^(sm|md|lg|xl|2xl|hover|focus|active|disabled|group-hover|dark|first|last|odd|even|placeholder|before|after|peer-|data-\[.*?\]):/, '');

  for (const [category, patterns] of Object.entries(TAILWIND_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(stripped)) return category;
    }
  }

  // Arbitrary value classes like bg-[#fff] or w-[200px]
  if (/^[a-z]+-\[.+\]$/.test(stripped)) return 'other-tailwind';

  // Negative values like -mt-4
  if (/^-[a-z]+-/.test(stripped)) {
    const positive = stripped.slice(1);
    return matchCategory(positive);
  }

  return null;
}

/** Detect if the page uses Tailwind (check for common markers). */
function detectTailwind(): boolean {
  // Check for Tailwind's CSS custom properties or style elements
  const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
  for (const el of styles) {
    if (el instanceof HTMLStyleElement && el.textContent) {
      // Tailwind v3+ injects base styles with these markers
      if (el.textContent.includes('--tw-') || el.textContent.includes('tailwindcss')) return true;
    }
  }
  // Check computed styles for Tailwind CSS variables
  const root = getComputedStyle(document.documentElement);
  if (root.getPropertyValue('--tw-ring-offset-width') || root.getPropertyValue('--tw-shadow')) return true;

  return false;
}

let _isTailwind: boolean | null = null;

/** Categorize an element's CSS classes into Tailwind groups. */
export function categorizeTailwindClasses(classes: string[]): TailwindInfo {
  if (_isTailwind === null) _isTailwind = detectTailwind();

  if (!_isTailwind || classes.length === 0) {
    return { detected: false, categories: {}, other: classes };
  }

  const categories: Record<string, string[]> = {};
  const other: string[] = [];

  for (const cls of classes) {
    const cat = matchCategory(cls);
    if (cat) {
      const key = cat === 'other-tailwind' ? 'other' : cat;
      if (!categories[key]) categories[key] = [];
      categories[key].push(cls);
    } else {
      other.push(cls);
    }
  }

  return { detected: true, categories, other };
}
