# Promptotype

## What This Is

A browser overlay tool that lets anyone select UI elements in a locally running app, see their computed design properties, write prompts, batch multiple annotations, review them, and send structured feedback to AI coding agents.

**Inspirations:** React Grab (element selection), plannotator (annotation UI + CLI integration)
**Repo:** https://github.com/niforiskollaros/promptotype
**npm:** [promptotype](https://www.npmjs.com/package/promptotype)
**Landing page:** https://locusai.design

## Architecture

**Vanilla TypeScript** — single IIFE bundle (~66KB, ~14KB gzip), zero framework dependencies. Works in any browser, on any app.

Built with **Vite** (IIFE library mode). No React, no framework. CLI is a **Bun-compiled binary** that proxies your app and injects the overlay.

```
src/
├── index.ts                 # Main orchestrator — mode management, event handling, toggle
├── types.ts                 # TypeScript interfaces (Annotation, ExtractedStyles, Mode)
├── styles.ts                # Design token system (colors, spacing, typography, shadows, transitions)
├── extract-styles.ts        # getComputedStyle extraction + CSS selector generation
├── highlight-overlay.ts     # Element highlight with box model visualization (margin/padding)
├── breadcrumb-bar.ts        # DOM path breadcrumb bar (top of viewport)
├── annotation-popover.ts    # Properties display + prompt textarea + color suggestion
├── pin-markers.ts           # Numbered pin markers on annotated elements
├── status-bar.ts            # Bottom bar with annotation count + Review & Submit button
├── review-panel.ts          # Right side panel listing all annotations + copy to clipboard
└── output.ts                # Markdown generation + clipboard API + proxy submission

cli/
├── index.ts                 # CLI entry — arg parsing, auto-detect dev servers, open browser
├── server.ts                # Proxy server — inject overlay, session token auth, annotation API
└── promptotype.md           # Slash command definition for AI coding agents

npm/
├── postinstall.js           # Downloads platform binary from GitHub release
└── cli.js                   # Thin Node.js wrapper that execs the binary

site/
├── index.html               # Landing page (locusai.design)
└── vercel.json              # Rewrite /install.sh to raw GitHub
```

## Distribution

```bash
# Install via curl
curl -fsSL https://locusai.design/install.sh | bash

# Install via npm
npm install -g promptotype

# Run
promptotype http://localhost:3000

# From Claude Code / Codex / Gemini CLI
/promptotype http://localhost:3000
```

## Releasing

Push a tag — CI builds all 4 platform binaries and creates a GitHub release automatically:

```bash
git tag v0.x.x && git push origin v0.x.x
```

For npm, bump version in package.json and run `npm publish`.

## User Flow

```
Activate (Cmd+Shift+D or floating button)
  → INSPECT: hover highlights elements with box model (margin/padding), Alt+Scroll for depth
  → Click element → ANNOTATE: popover shows properties + optional prompt textarea
  → Save → pin marker appears, continue selecting more
  → "Review & Submit" → REVIEW: side panel with all annotations
  → Submit to Agent (proxy mode) or Copy to Clipboard (standalone)
```

## Key Design Decisions

- **Inline popover** for annotations (not side panel) — keep context near the element
- **Numbered pin markers** on annotated elements — scannable, shows order
- **Bottom status bar** for batch management — always visible, persistent CTA
- **Right side panel** for review — see page + annotations together
- **Alt+Scroll** for depth traversal — zero UI footprint, no DOM tree panel
- **Structured markdown** as output format — AI agents parse it naturally
- **Prompt is optional** — can annotate with just color suggestion or properties only
- **Purple accent** (#7C3AED primary, full 50-900 ramp) — unlikely to clash with inspected apps
- **Dark warm surfaces** (#161618 base, not pure black) — distinguishes tool from inspected app
- **Respects prefers-reduced-motion** — all animations disabled

## Proxy Security

- **Session token**: Each proxy session generates `crypto.randomUUID()`, injected via `/__pt__/bootstrap.js`, required on annotation POST (403 without it)
- **CSP handling**: Proxy strips CSP headers from target app responses to allow overlay injection
- **Bootstrap**: Served as external JS file (not inline) for CSP compatibility
- **Honest UI**: Submit button awaits async result before showing success or error state

## Design Token System

All UI references `src/styles.ts` — never hardcode values in components.

- **Colors:** Purple primary ramp, warm dark surfaces, semantic colors (success/warning/error)
- **Spacing:** 4px base, 8px rhythm
- **Typography:** System font stack + monospace for code, 5 size steps, 4 weight steps
- **Shadows:** 5 elevation levels + glow
- **Transitions:** fast (100ms), normal (150ms), slow (200ms), spring (300ms)
- **Z-index scale:** highlight → pins → breadcrumb → statusBar → popover → reviewPanel → toast

## Extracted Properties (POC)

- Font: family, size, weight, line-height
- Color: text, background (as hex, with clickable color chips)
- Spacing: padding, margin (with box model visualization on highlight)
- Alignment: text-align, display, align-items

## Commands

```bash
npm run dev          # Start dev server with sample app (index.html) on port 3333
npm run build        # Build dist/promptotype.iife.js
npm run build:cli    # Build CLI binary for current platform
npm run build:cli:all  # Build for all 4 platforms (darwin/linux × arm64/x64)
npm run preview      # Preview production build
```

## Future Roadmap

| Feature | Status |
|---------|--------|
| MCP server + browser extension | Future — extension captures, MCP delivers to any agent |
| Screenshot capture per annotation | Future |
| Design token mapping (Tailwind detection) | Future |
| Component detection (React/Vue) | Future |
| Figma comparison mode | Future |

## Session History

Session summaries are in `sessions/`:
- `sessions/INDEX.md` — Running index of all sessions
- `sessions/DECISIONS.md` — Architectural decisions with rationale

## Code Conventions

- All UI elements use `pt-` prefix for IDs and classes to avoid conflicts
- `isOwnElement()` check prevents the tool from inspecting its own UI
- Events use capture phase (`true`) to intercept before the app's handlers
- All overlay z-indices use the scale from `tokens.z` (near max int)
- All colors, spacing, typography reference `tokens` from `styles.ts` — no hardcoded values
- Thin transparent scrollbars on all overlay elements (visible only on hover)
- System font stack for UI, monospace for code/selectors/hex values
- SVG icons inline (no icon library dependency)
- Animations use CSS keyframes defined in `injectGlobalStyles()`
- Proxy routes use `/__pt__/` prefix, window globals use `__PT_*`
