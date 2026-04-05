// Design tokens for Promptotype
// All overlay UI references these tokens — never hardcode values in components

export const tokens = {
  // Colors — Purple accent with warm dark surfaces
  color: {
    // Primary accent
    primary: {
      50: '#FAF5FF',
      100: '#F3E8FF',
      200: '#E9D5FF',
      300: '#D8B4FE',
      400: '#C084FC',
      500: '#A855F7',
      600: '#7C3AED',
      700: '#6D28D9',
      800: '#5B21B6',
      900: '#4C1D95',
    },
    // Surfaces — warm dark (not pure black)
    surface: {
      base: '#161618',
      raised: '#1C1C1F',
      overlay: '#222225',
      elevated: '#2A2A2E',
      border: '#333338',
      borderSubtle: '#2A2A2E',
    },
    // Text
    text: {
      primary: '#F0F0F2',
      secondary: '#A0A0A8',
      tertiary: '#6B6B74',
      inverse: '#161618',
    },
    // Semantic
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#60A5FA',
    // Highlight overlay
    highlight: {
      border: '#A855F7',
      fill: 'rgba(168, 85, 247, 0.08)',
      fillAnnotated: 'rgba(168, 85, 247, 0.15)',
      margin: 'rgba(249, 168, 37, 0.25)',
      padding: 'rgba(52, 211, 153, 0.25)',
    },
  },

  // Spacing — 4px base, 8px rhythm
  space: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
  },

  // Typography
  font: {
    family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
    mono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
    size: {
      xs: '11px',
      sm: '12px',
      base: '13px',
      md: '14px',
      lg: '16px',
    },
    weight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeight: {
      tight: '1.2',
      normal: '1.5',
      relaxed: '1.6',
    },
  },

  // Radii
  radius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    full: '9999px',
  },

  // Shadows
  shadow: {
    sm: '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
    md: '0 4px 12px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.2)',
    lg: '0 8px 32px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.2)',
    xl: '0 16px 48px rgba(0,0,0,0.5)',
    glow: '0 0 20px rgba(168, 85, 247, 0.3)',
  },

  // Transitions
  transition: {
    fast: '100ms ease-out',
    normal: '150ms ease-in-out',
    slow: '200ms ease-out',
    spring: '300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  // Z-index scale
  z: {
    highlight: 2147483638,
    highlightLabel: 2147483639,
    pins: 2147483640,
    breadcrumb: 2147483641,
    statusBar: 2147483642,
    popover: 2147483643,
    reviewPanel: 2147483644,
    toast: 2147483646,
  },
} as const;

// Inject global styles (animations, resets for DA elements)
export function injectGlobalStyles(): void {
  if (document.getElementById('pt-global-styles')) return;
  const style = document.createElement('style');
  style.id = 'pt-global-styles';
  style.textContent = `
    @keyframes pt-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes pt-fade-out {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    @keyframes pt-slide-up {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pt-slide-in-right {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
    @keyframes pt-slide-out-right {
      from { transform: translateX(0); }
      to { transform: translateX(100%); }
    }
    @keyframes pt-scale-in {
      from { opacity: 0; transform: scale(0.8); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes pt-pulse-ring {
      0% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4); }
      70% { box-shadow: 0 0 0 8px rgba(168, 85, 247, 0); }
      100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0); }
    }
    @keyframes pt-pulse-highlight {
      0% { opacity: 1; }
      100% { opacity: 0; transform: scale(1.02); }
    }
    @keyframes pt-shimmer {
      from { background-position: -200% 0; }
      to { background-position: 200% 0; }
    }
    @keyframes pt-toast-progress {
      from { width: 100%; }
      to { width: 0%; }
    }

    .pt-inspect-cursor, .pt-inspect-cursor * {
      cursor: crosshair !important;
    }

    /* Thin, transparent scrollbar — visible only on hover/scroll */
    [id^="pt-"] {
      scrollbar-width: thin;
      scrollbar-color: transparent transparent;
    }
    [id^="pt-"]:hover {
      scrollbar-color: rgba(255,255,255,0.15) transparent;
    }
    [id^="pt-"]::-webkit-scrollbar {
      width: 5px;
    }
    [id^="pt-"]::-webkit-scrollbar-track {
      background: transparent;
    }
    [id^="pt-"]::-webkit-scrollbar-thumb {
      background-color: transparent;
      border-radius: 3px;
    }
    [id^="pt-"]:hover::-webkit-scrollbar-thumb {
      background-color: rgba(255,255,255,0.15);
    }
    [id^="pt-"]::-webkit-scrollbar-thumb:hover {
      background-color: rgba(255,255,255,0.3);
    }

    @media (prefers-reduced-motion: reduce) {
      [id^="pt-"], [class^="pt-"] {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;
  document.head.appendChild(style);
}
