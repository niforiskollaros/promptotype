# Promptotype

## What This Is

A browser overlay tool that lets anyone select UI elements in a locally running app, see their computed design properties, directly edit text/colors/spacing/classes, batch multiple annotations with live preview, review changes as before→after diffs, and send structured feedback to AI coding agents in a continuous loop.

**Inspirations:** React Grab (element selection), plannotator (annotation UI + CLI integration)
**Repo:** https://github.com/niforiskollaros/promptotype
**npm:** [promptotype](https://www.npmjs.com/package/promptotype)
**Landing page:** https://locusai.design
**Current version:** 0.3.2

## Architecture

**Vanilla TypeScript** — single IIFE bundle (~89KB, ~20KB gzip), zero framework dependencies. Works in any browser, on any app.

Built with **Vite** (IIFE library mode) for the overlay and **esbuild** (single ESM bundle) for the CLI. No React, no framework. Two distribution modes:
1. **Chrome Extension** (primary) — injects overlay via Shadow DOM, sends annotations to MCP server
2. **CLI Proxy** (fallback) — pre-bundled Node.js ESM script that proxies your app and injects the overlay. Requires Node ≥22 (for built-in WebSocket client + modern fetch).

```
src/
├── index.ts                 # Main orchestrator — mode management, event handling, toggle
├── context.ts               # Shadow DOM context — threads UI root through all modules
├── types.ts                 # TypeScript interfaces (Annotation, ExtractedStyles, Mode)
├── styles.ts                # Design token system (colors, spacing, typography, shadows, transitions)
├── extract-styles.ts        # getComputedStyle extraction + CSS selector + Color Level 4 + React Fiber source
├── tailwind.ts              # Tailwind CSS detection + class categorization
├── highlight-overlay.ts     # Element highlight with box model visualization (margin/padding)
├── breadcrumb-bar.ts        # DOM path breadcrumb bar (above status bar)
├── annotation-popover.ts    # Editable popover: text, colors, font, spacing, class chips, live preview
├── pin-markers.ts           # Numbered pin markers on annotated elements
├── status-bar.ts            # Bottom bar with annotation count + Review & Submit button
├── review-panel.ts          # Right side panel with change diffs + copy to clipboard
└── output.ts                # Markdown generation + Tailwind output + clipboard/proxy/MCP submission

cli/
├── index.ts                 # CLI entry — arg parsing, auto-detect, `serve` subcommand
├── server.ts                # Proxy server — inject overlay, session token auth, annotation API
├── mcp-server.ts            # MCP server — HTTP for extension + stdio for AI agents
├── node-adapter.ts          # Fetch-style HTTP server on node:http (port-retry + upgrade hook)
└── promptotype.md           # Slash command definition for AI coding agents

scripts/
└── build-cli.mjs            # Bundles cli/ into dist/cli.mjs via esbuild (shebang + createRequire banner)

extension/
├── manifest.json            # Chrome Manifest V3
├── background.js            # Service worker — injection, MCP health, screenshot capture
├── content-bridge.js        # Content script (ISOLATED) — relays screenshot requests
├── popup.html               # Extension popup — MCP status, overlay status, page URL
├── popup.js                 # Popup logic — health check, inject/remove toggle
├── overlay.js               # Built overlay IIFE (copied from dist/ during build)
└── icons/                   # Extension icons (16, 48, 128px)

npm/
└── postinstall.js           # Installs slash command, registers MCP, auto-allows tools

site/
├── index.html               # Landing page (locusai.design)
└── vercel.json              # Rewrite /install.sh to raw GitHub
```

## npm Package

The npm package ships a single ~190KB tarball (~980KB unpacked) — no platform binaries, no postinstall downloads. The CLI is a self-contained ESM bundle that runs on any Node ≥22.

**What ships in the tarball:**
- `dist/cli.mjs` — pre-bundled CLI (~850KB, includes MCP SDK + zod + ws + app code)
- `dist/promptotype.iife.js` — overlay bundle (91KB, loaded at runtime by the proxy)
- `npm/postinstall.js` — Claude Code setup
- `cli/promptotype.md` — slash command definition
- `package.json`, `LICENSE`, `README.md`

**What postinstall does:**
1. Installs `/promptotype` slash command to `~/.claude/commands/`
2. Registers MCP server in Claude Code (`claude mcp add`)
3. Auto-allows `wait_for_annotations` and `get_annotations` MCP tools in `~/.claude/settings.json`

Zero network calls — everything ships in the tarball. No per-platform builds, no code signing, no Gatekeeper issues on macOS.

**Dependencies at build time:** `@modelcontextprotocol/sdk`, `zod`, `ws`, `update-notifier`, `esbuild`, `tsx`, `vite`. All bundled into `dist/cli.mjs` at build time via esbuild — zero runtime dependencies.

**Update notifications:** The CLI uses `update-notifier` to check npm for newer versions once per 24 hours (cached in `~/Library/Preferences/update-notifier-promptotype` on macOS, `~/.config/` on Linux). The check runs in the background, writes to stderr only (never stdout — that would break MCP stdio JSON-RPC), and only shows the box to interactive TTYs. Users can suppress with `NO_UPDATE_NOTIFIER=1`.

Because the notifier lives inside the CLI, the first release that ships it (0.3.1) can't announce itself — existing 0.2.x users have to upgrade once manually. The notifier is also run only on interactive TTYs, and the first run after a new release may not show the box (the registry check is a detached background fetch whose result lands in the cache for the *next* invocation).

**Postinstall self-heal:** Since 0.3.2 the postinstall calls `claude mcp remove promptotype -s user` (ignored on failure) before `claude mcp add`. This ensures upgrades from older installs — which may have had stale registrations pointing at a Bun binary path or a local source file — end up with a correct `promptotype serve` entry.

## Distribution

### Chrome Extension (primary)
```bash
# Load unpacked in chrome://extensions/ (dev mode)
# Point to the extension/ directory

# Build the extension
npm run build:ext
```

### MCP Server (for AI agents)
```bash
# Install globally (postinstall handles everything)
npm install -g promptotype

# Or start MCP server manually
promptotype serve              # HTTP on port 4100, MCP on stdio

# Register in Claude Code manually (if postinstall didn't run)
claude mcp add promptotype -s user -- promptotype serve
```

### CLI Proxy (fallback)
```bash
# Install via npm (same command, works on any platform with Node ≥22)
npm install -g promptotype

# Run proxy
promptotype http://localhost:3000
```

## Releasing

No more binary CI choreography. `prepublishOnly` builds both the overlay and the CLI bundle before publish, and the tarball is fully self-contained.

### Full release checklist

```bash
# 1. Bump version in BOTH files
#    - package.json → "version"
#    - cli/mcp-server.ts → version in MCP server constructor

# 2. Commit and push
git add package.json cli/mcp-server.ts
git commit -m "Bump to v0.x.x"
git push

# 3. Tag (CI creates GitHub release, no binaries needed)
git tag v0.x.x && git push origin v0.x.x

# 4. Publish to npm (prepublishOnly runs build:all automatically)
npm publish
```

### If you publish a bad version to npm

```bash
# Deprecate (users see warning, can still install)
npm deprecate promptotype@0.x.x "Reason. Use 0.x.y+"

# Or unpublish (only within 72h, removes entirely)
npm unpublish promptotype@0.x.x
```

## User Flow

### Extension + MCP (primary — continuous mode)
```
/promptotype in Claude Code
  → Agent calls wait_for_annotations() — blocks, listening
  → User clicks extension icon → "Activate on Page"
  → INSPECT: hover highlights elements, Alt+Scroll for depth
  → Click element → ANNOTATE: editable popover with live preview
    → Edit text, pick colors, change font/spacing, toggle Tailwind classes
    → Save → pin marker appears, continue selecting more
  → "Review & Submit" → REVIEW: side panel with before→after diffs
  → Submit to Agent → annotations flow to agent → agent applies changes
  → Overlay clears, returns to INSPECT for next round
  → Agent calls wait_for_annotations() again — loop continues
  → Deactivate overlay (Cmd+Shift+D) → close signal → agent stops looping
```

### Standalone (clipboard fallback)
```
Activate (Cmd+Shift+D or floating button)
  → Same annotation flow
  → Copy to Clipboard → paste into any AI agent
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

## Annotation Data

Each annotation captures:
- **Source location**: file:line from React Fiber `_debugSource` or `data-inspector-*` attributes
- **Text content**: direct text from the element (first 100 chars)
- **CSS classes**: full class list, with Tailwind categorization when detected
- **Computed styles**: font, color, spacing, alignment (as hex via canvas getImageData)
- **Direct edits**: text, colors (native picker), font size/weight/line-height, margin, padding, class add/remove
- **Live preview**: edits apply to the actual element temporarily, revert on cancel
- **Screenshot**: captured via `chrome.tabs.captureVisibleTab` + canvas crop (extension only)
- **Prompt**: optional freeform instructions for complex changes

Markdown output includes explicit before→after diffs for all edits.

## Commands

```bash
npm run dev            # Start dev server with sample app (index.html) on port 3333
npm run build          # Build dist/promptotype.iife.js
npm run build:ext      # Build overlay + copy to extension/overlay.js
npm run build:cli      # Bundle CLI into dist/cli.mjs via esbuild
npm run build:all      # Build overlay + CLI bundle (runs before npm publish)
npm run test:app       # Start mock app (static mode) on port 3000
npm run test:app:nextjs # Start mock app (Next.js mode with basePath)
npm run test:proxy     # Run proxy against localhost:3000 (via tsx)
npm run preview        # Preview production build
```

## Future Roadmap

| Feature | Status |
|---------|--------|
| Chrome extension + Shadow DOM injection | Done (v0.2.0) |
| MCP server (get_annotations, wait_for_annotations) | Done (v0.2.0) |
| Continuous annotation mode (/promptotype loop) | Done (v0.2.0) |
| Editable popover with live preview | Done (v0.2.0) |
| React Fiber source location extraction | Done (v0.2.0) |
| Tailwind class detection + categorization | Done (v0.2.0) |
| Before→after change diffs in output | Done (v0.2.0) |
| Screenshot capture per annotation | Done (v0.2.0, extension only) |
| npm package hygiene (postinstall fix, devDeps, no binary in tarball) | Done (v0.2.5) |
| Node.js distribution (drops Bun binary, fixes macOS 26 SIGKILL) | Done (v0.3.0) |
| Update notifications (update-notifier on CLI startup) | Done (v0.3.1) |
| Postinstall self-heals stale MCP registrations | Done (v0.3.2) |
| Chrome Web Store submission | Next |
| Remote MCP server (Railway) | Planned — always-on, no local process |
| Companion Vite plugin for source location (React 19+) | Planned |
| Component detection (React/Vue) | Future |
| Figma comparison mode | Future |
| Firefox / Safari extensions | Future |

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
- Shadow DOM context: all modules use `getUIRoot()` from `context.ts`, never `document.body`
- Extension auto-init suppressed via `__PT_MCP__` flag; only `initWithShadowDOM` runs
- MCP server port 4100 with auto-retry (4100-4109)
- `/__pt__/api/wait` blocks until annotations arrive (slash command uses this)
- `/__pt__/api/close` stops continuous mode (sent on overlay deactivate)
- Color conversion via canvas `getImageData` — handles CSS Color Level 4 (lab, oklch, oklab)
- Tailwind detected via `--tw-*` CSS variables on `:root`
- React Fiber source via `__reactFiber$*` → `_debugSource` (React < 19)
- Live preview stores originals in a Map, reverts on cancel/save/hidePopover
