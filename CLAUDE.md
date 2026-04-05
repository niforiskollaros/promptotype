# DesignAnnotator

## What This Is

A browser overlay tool that lets anyone select UI elements in a locally running app, see their computed design properties, write prompts, batch multiple annotations, review them, and send structured feedback to AI coding agents.

**Inspirations:** React Grab (element selection), plannotator (annotation UI + CLI integration)
**Repo:** https://github.com/SignalOrg/designottaror

## Architecture

**Vanilla TypeScript** — single IIFE bundle (~64KB, ~13KB gzip), zero framework dependencies. Works in any browser, on any app.

Built with **Vite** (IIFE library mode). No React, no framework.

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
└── output.ts                # Markdown generation + clipboard API
```

## User Flow

```
Activate (Cmd+Shift+D or DA button)
  → INSPECT: hover highlights elements with box model (margin/padding), Alt+Scroll for depth
  → Click element → ANNOTATE: popover shows properties + optional prompt textarea
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
- **Prompt is optional** — can annotate with just color suggestion or properties only
- **Purple accent** (#7C3AED primary, full 50-900 ramp) — unlikely to clash with inspected apps
- **Dark warm surfaces** (#161618 base, not pure black) — distinguishes tool from inspected app
- **Respects prefers-reduced-motion** — all animations disabled

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

## CLI Integration Roadmap

| Phase | Approach | Status |
|-------|----------|--------|
| 1. Clipboard | Copy markdown, paste into CLI | Done |
| 2. Local API + bookmarklet | CLI starts API server, overlay POSTs annotations | Next |
| 3. Proxy plugin (plannotator-style) | `/design-annotate localhost:3000` — proxy + inject overlay | Planned |
| 4. MCP server + browser extension | Extension captures, MCP delivers to any agent | Future |

### How plannotator works (reference for our integration)

- Slash command `.md` file in `~/.claude/commands/` with `!` backtick to execute binary
- Binary starts local HTTP server (Bun.serve), opens browser, blocks on Promise
- Browser SPA makes fetch() calls to same origin (GET /api/plan, POST /api/feedback)
- POST resolves the Promise (resolveDecision()), CLI prints to stdout, Claude captures it
- Single binary with embedded UI (vite-plugin-singlefile + Bun import with { type: "text" })
- Stdout is the contract — stays silent until user submits, stderr for diagnostics
- Install script drops binary to ~/.local/bin/ and slash command .md to ~/.claude/commands/
- Supports Claude Code, Codex, Copilot CLI, Gemini CLI, OpenCode, Pi

### Option 4+6 detail (MCP + browser extension)

These work together: extension is the capture layer (element selection, annotations in browser), MCP server is the delivery layer (exposes get_annotations() tool to any MCP-compatible agent). Connected via native messaging. Extension can be loaded unpacked for local dev — no store review needed.

## Commands

```bash
npm run dev      # Start dev server with sample app (index.html) on port 3333
npm run build    # Build dist/design-annotator.iife.js
npm run preview  # Preview production build
```

## Design Workflow

The `.design/` directory contains the DSP workflow:
- `.design/phases/DISCOVERY.md` — Design brief with 14 must-have requirements
- `.design/phases/UX-DECISIONS.md` — Full UX spec with 7 components + all states
- `.design/STATE.md` — Current workflow position (UX + wireframe execution complete)
- `.design/config.json` — Workflow settings

## Session History

Session summaries are in `sessions/`:
- `sessions/INDEX.md` — Running index of all sessions
- `sessions/DECISIONS.md` — Architectural decisions with rationale

## Code Conventions

- All UI elements use `da-` prefix for IDs and classes to avoid conflicts
- `isOwnElement()` check prevents the tool from inspecting its own UI
- Events use capture phase (`true`) to intercept before the app's handlers
- All overlay z-indices use the scale from `tokens.z` (near max int)
- All colors, spacing, typography reference `tokens` from `styles.ts` — no hardcoded values
- Thin transparent scrollbars on all overlay elements (visible only on hover)
- System font stack for UI, monospace for code/selectors/hex values
- SVG icons inline (no icon library dependency)
- Animations use CSS keyframes defined in `injectGlobalStyles()`
