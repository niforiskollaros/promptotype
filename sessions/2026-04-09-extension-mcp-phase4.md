# Session: Chrome Extension + MCP Server (Phase 4)

**Date**: 2026-04-09
**Branch**: `feature/mcp_and_extention`
**Duration**: Full session

## Accomplished

- **Fixed proxy hop-by-hop header bug** — non-HTML responses forwarded `transfer-encoding`/`content-encoding` headers from the target, causing browsers to double-decode CSS/JS. Stripped these for all proxied responses.
- **Fixed redirect Location header rewriting** — absolute redirect URLs pointing to the target are now rewritten to relative paths so the browser stays on the proxy.
- **Tested proxy against AiBi (Next.js 16 + basePath `/aibi`)** — worked after fix, received 3 annotations successfully.
- **Discovered proxy is fundamentally fragile** — Shiplex CSS still broken after fix. Different frameworks break in different ways. Proxy is a game of whack-a-mole.
- **Ran DSP Discovery for Phase 4** — full design brief for Chrome extension + MCP server architecture.
- **Built Chrome Extension (Manifest V3)**:
  - Content script injects overlay via Shadow DOM (closed)
  - Background service worker handles injection/removal and MCP health checks
  - Popup shows MCP server connection status
  - Auto-suppresses overlay auto-init when loaded by extension
- **Refactored overlay for Shadow DOM**:
  - New `src/context.ts` — threads UI root container through all 9 modules
  - Replaced all 14 `document.body.appendChild` calls with `getUIRoot()`
  - Styles inject into shadow root or document.head depending on mode
  - `isOwnElement()` detects shadow host
  - Popover max-height respects viewport position (no more clipped buttons)
  - Color extraction handles CSS Color Level 4 formats (lab, oklch, oklab)
- **Built MCP Server** (`cli/mcp-server.ts`):
  - HTTP endpoint for extension to POST annotations
  - MCP stdio interface with `get_annotations()` and `wait_for_annotations()` tools
  - Port retry (4100+) if default port is in use
  - Logs annotation receipt to stderr
  - CORS headers for extension cross-origin requests
- **Added `serve` subcommand to CLI** — `promptotype serve` starts MCP server
- **Registered MCP server globally** in Claude Code (`claude mcp add promptotype -s user`)
- **Successfully tested end-to-end**: Extension → annotate Shiplex (fully styled!) → Submit to Agent → MCP server receives → Claude Code retrieves via `get_annotations()`
- **Created mock test app** (`test/mock-app/`) with static and Next.js-like modes

## Decisions

- **Chrome extension replaces proxy as primary injection** — proxy is inherently fragile (breaks on Next.js, Shiplex, etc.). Extension injects directly via Shadow DOM, bypassing all proxy issues.
- **Shadow DOM (open) for overlay isolation** — prevents CSS leaks between overlay and host page.
- **MCP over simpler WebSocket/HTTP** — every major AI agent supports MCP (Codex, Cursor, Gemini, Claude Code, Copilot). It's the universal standard.
- **Chrome only for v1** — focus on one platform, expand Firefox/Safari later.
- **Ship extension + MCP together** — both needed for the full workflow.
- **Proxy stays as fallback** — for users who prefer CLI-only or can't install extensions.
- **No Railway deployment yet** — validate with more users before building cloud infrastructure.

## Files Changed/Created

**New files:**
- `src/context.ts` — Shadow DOM context module
- `cli/mcp-server.ts` — MCP server (HTTP + stdio)
- `extension/manifest.json` — Chrome Manifest V3
- `extension/background.js` — Service worker
- `extension/popup.html` — Extension popup UI
- `extension/popup.js` — Popup logic
- `extension/overlay.js` — Built overlay IIFE (copied from dist)
- `extension/icons/` — Placeholder purple icons (16, 48, 128px)
- `test/mock-app/` — Mock app with static and Next.js modes
- `.design/phases/DISCOVERY-phase4.md` — Phase 4 design brief

**Modified files:**
- `cli/index.ts` — Added `serve` subcommand, MCP server import
- `cli/server.ts` — Fixed hop-by-hop headers, redirect Location rewriting
- `src/index.ts` — Shadow DOM init, MCP mode, auto-init suppression
- `src/styles.ts` — Style injection into shadow root
- `src/highlight-overlay.ts` — Context-aware root
- `src/breadcrumb-bar.ts` — Context-aware root
- `src/annotation-popover.ts` — Context-aware root, viewport-clamped max-height
- `src/pin-markers.ts` — Context-aware root
- `src/status-bar.ts` — Context-aware root
- `src/review-panel.ts` — MCP mode button text, context-aware root
- `src/output.ts` — `isMcpMode()`, `submitToMcp()` functions
- `src/extract-styles.ts` — Canvas-based color conversion for lab/oklch
- `package.json` — `@modelcontextprotocol/sdk` dependency, `build:ext` script

## Next Steps

1. [ ] Get more users testing — Chrome Web Store submission is the unlock
2. [ ] Improve extension UX — better activation flow, status indicators
3. [ ] Real icon assets for extension (currently placeholder purple squares)
4. [ ] Investigate MCP sampling for automatic push-to-agent (eliminates "check my annotations" step)
5. [ ] Consider Railway deployment for always-on MCP server (after user validation)
6. [ ] Update CLAUDE.md with extension/MCP architecture
7. [ ] Build CLI binary with `serve` command included

## Notes

- The Shiplex project was the key validation — completely broken with proxy (no CSS), works perfectly with extension. This proved the architecture change was necessary, not premature.
- MCP adoption is universal: Codex, Cursor, Gemini CLI, Windsurf, GitHub Copilot, Claude Code all support it.
- The extension can't do MCP stdio directly — needs a local companion process. This is why `promptotype serve` exists.
- MCP is pull-based (agent calls tools). For push-to-agent, MCP sampling (`createMessage`) is the spec mechanism, but client support varies. `wait_for_annotations()` is the practical workaround.
