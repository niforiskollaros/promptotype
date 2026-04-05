# DesignAnnotator

## What This Is

A browser overlay tool that lets anyone select UI elements in a locally running app, see their computed design properties, write prompts, batch multiple annotations, review them, and send structured feedback to AI coding agents.

**Inspirations:** React Grab (element selection), plannotator (annotation UI + CLI integration)

## Architecture

**Vanilla TypeScript** — single IIFE bundle (~35KB), zero framework dependencies. Works in any browser, on any app.

Built with **Vite** (IIFE library mode). No React, no framework.

```
src/
├── index.ts                 # Main orchestrator — mode management, event handling, toggle
├── types.ts                 # TypeScript interfaces (Annotation, ExtractedStyles, Mode)
├── extract-styles.ts        # getComputedStyle extraction + CSS selector generation
├── highlight-overlay.ts     # Element highlight overlay (purple border + dimensions label)
├── breadcrumb-bar.ts        # DOM path breadcrumb bar (top of viewport)
├── annotation-popover.ts    # Properties display + prompt textarea + color suggestion
├── pin-markers.ts           # Numbered pin markers on annotated elements
├── status-bar.ts            # Bottom bar with annotation count + Review & Submit button
├── review-panel.ts          # Right side panel listing all annotations + copy to clipboard
└── output.ts                # Markdown generation + clipboard API
```

## User Flow

```
Activate (Cmd+Shift+D or DA button)
  → INSPECT: hover highlights elements, Alt+Scroll for depth traversal
  → Click element → ANNOTATE: popover shows properties + prompt textarea
  → Save → pin marker appears, continue selecting more
  → "Review & Submit" → REVIEW: side panel with all annotations
  → "Copy to Clipboard" → structured markdown for AI agents
```

## Key Design Decisions

- **Inline popover** for annotations (not side panel) — keep context near the element
- **Numbered pin markers** on annotated elements — scannable, shows order
- **Bottom status bar** for batch management — always visible, persistent CTA
- **Right side panel** for review — see page + annotations together
- **Alt+Scroll** for depth traversal — zero UI footprint, no DOM tree panel
- **Structured markdown** as output format — AI agents parse it naturally
- **Purple (#7C3AED) accent** — unlikely to clash with inspected app colors
- **Dark theme** for overlay UI — distinguishes tool from inspected app

## Extracted Properties (POC)

- Font: family, size, weight, line-height
- Color: text, background (as hex)
- Spacing: padding, margin
- Alignment: text-align, display, align-items

## CLI Integration Roadmap

| Phase | Approach | Status |
|-------|----------|--------|
| 1. Clipboard | Copy markdown, paste into CLI | Done |
| 2. Local API + bookmarklet | CLI starts API server, overlay POSTs annotations | Next |
| 3. Proxy plugin (plannotator-style) | `/design-annotate localhost:3000` — proxy + inject overlay | Planned |
| 4. MCP server + browser extension | Extension captures, MCP delivers to any agent | Future |

### How plannotator works (reference for our integration)

- Slash command `.md` file in `~/.claude/commands/` with `!` backtick to execute binary
- Binary starts local HTTP server, opens browser, blocks on Promise
- Browser SPA POSTs annotations to local server
- POST resolves the Promise, CLI prints to stdout, Claude captures it
- Single binary with embedded UI (vite-plugin-singlefile + Bun import)
- Stdout is the contract — stays silent until user submits

## Commands

```bash
npm run dev      # Start dev server with sample app (index.html)
npm run build    # Build dist/design-annotator.iife.js
npm run preview  # Preview production build
```

## Design Workflow

The `.design/` directory contains the DSP workflow:
- `.design/phases/DISCOVERY.md` — Design brief with requirements
- `.design/phases/UX-DECISIONS.md` — Full UX spec with 7 components + states
- `.design/STATE.md` — Current workflow position
- `.design/config.json` — Workflow settings

## Code Conventions

- All UI elements use `da-` prefix for IDs and classes to avoid conflicts
- `isOwnElement()` check prevents the tool from inspecting its own UI
- Events use capture phase (`true`) to intercept before the app's handlers
- All overlay z-indices are near `2147483647` (max) to stay on top
- Dark theme (#1E1E1E backgrounds) for all overlay components
- System font stack (`-apple-system, BlinkMacSystemFont, sans-serif`) for native feel
