# Session: Initial Build & UI Design

**Date**: 2026-04-05
**Duration**: Full session
**Phase**: Project initialization through polished wireframe

---

## Accomplished

- **Researched inspirations**: Analyzed React Grab (element selection model) and plannotator (annotation UI + CLI integration architecture)
- **Ran full DSP workflow**: Discovery → UX → Execute → UI phases completed
- **Built working POC**: Vanilla TypeScript browser overlay with 10 source modules, builds to single 64KB IIFE
- **All 7 components functional**: ActivationToggle, ElementHighlightOverlay, DepthBreadcrumbBar, AnnotationPopover, PinMarkers, BottomStatusBar, ReviewSidePanel
- **Polished UI**: Full design token system, box model visualization, spring animations, thin scrollbars, reduced-motion support
- **Tested end-to-end**: Successfully annotated elements and applied changes from structured markdown output
- **Pushed to GitHub**: 2 commits on `main` at https://github.com/SignalOrg/designottaror
- **Researched plannotator internals**: Understood full architecture — HTTP server, embedded SPA, stdout contract, slash command registration

## Decisions

See `sessions/DECISIONS.md` for detailed rationale.

- Vanilla TypeScript (no framework) for universal browser compatibility
- Inline popover for annotations (not side panel)
- Batch annotations with numbered pin markers as core differentiator
- Structured markdown as AI agent output format
- Alt+Scroll for DOM depth traversal (no tree panel)
- Purple (#7C3AED/A855F7) accent system — unlikely to clash with inspected apps
- Prompt field is optional — can annotate with just color suggestion or properties only
- Dark warm surfaces (not pure black) for overlay UI

## Files Created/Modified

### Created
- `.design/` — Full DSP workflow (config, PROJECT, ROADMAP, REQUIREMENTS, STATE)
- `.design/phases/DISCOVERY.md` — Design brief with 14 requirements
- `.design/phases/UX-DECISIONS.md` — Full UX spec with 7 components + states
- `src/styles.ts` — Design token system (colors, spacing, typography, shadows, transitions)
- `src/index.ts` — Main orchestrator (mode management, events, toggle)
- `src/types.ts` — TypeScript interfaces
- `src/extract-styles.ts` — getComputedStyle extraction
- `src/highlight-overlay.ts` — Element highlight with box model visualization
- `src/breadcrumb-bar.ts` — DOM path breadcrumb
- `src/annotation-popover.ts` — Properties display + prompt input
- `src/pin-markers.ts` — Numbered pin markers
- `src/status-bar.ts` — Bottom status bar
- `src/review-panel.ts` — Review side panel
- `src/output.ts` — Markdown generation + clipboard
- `index.html` — Sample dashboard app for testing
- `CLAUDE.md` — Project context for Claude Code
- `vite.config.ts`, `tsconfig.json`, `package.json`, `.gitignore`

## Next Steps

1. **Build CLI integration (Option 3)**: Local API server + bookmarklet approach — overlay POSTs annotations to CLI server, CLI prints to stdout
2. **Then Option 2**: Full proxy plugin (plannotator-style) with `/promptotype localhost:3000` slash command
3. **Future**: MCP server + browser extension (Option 4+6) for seamless multi-agent support
4. **UX improvements to explore**: Undo/redo annotations, drag-to-reorder in review, screenshot capture per annotation

## Notes

- Plannotator architecture is well-understood — key insight: stdout is the contract, HTTP server with Promise-based blocking, embedded SPA via vite-plugin-singlefile
- The user prefers discussing options before building, incremental POC approach
- The sample dashboard (index.html) was used to test annotations — some test values are still in there (red button, name changes)
- Dev server runs on port 3333 (or 3334 if 3333 is occupied)
