# Session: Improvements & Distribution (v0.2.0)

**Date**: 2026-04-10
**Branch**: `main` (merged from `feature/mcp_and_extention`)
**Duration**: Full session

## Accomplished

- **Fixed the push-to-agent flow** — MCP sampling/notifications don't trigger Claude Code. Solution: HTTP wait endpoint (`/__pt__/api/wait`) that blocks until annotations arrive. Slash command uses this for blocking curl → agent receives annotations as command output.
- **Continuous annotation mode** — `/promptotype` starts a loop: agent calls `wait_for_annotations()` via MCP, receives batch, applies, waits again. Deactivating the overlay sends close signal (`/__pt__/api/close`) that stops the loop.
- **Global slash command** — installed to `~/.claude/commands/promptotype.md` so it works in any project.
- **Clear after submit** — annotations, pins, and review panel clear after successful submission. Overlay returns to inspect mode for next round.
- **React Fiber source location** — extracts file:line from `_debugSource` on React elements (< v19). Also checks `data-inspector-*` and `data-pt-*` attributes. Shown in popover and markdown output.
- **CSS classes + text content in annotations** — agent gets actual Tailwind classes and element text, not just computed styles.
- **Tailwind class detection + categorization** — detects Tailwind via `--tw-*` CSS variables, groups classes by category (typography, color, spacing, layout, etc.) in markdown output.
- **Editable popover redesign** — text content, color pickers (native), font size/weight/line-height, margin/padding all editable directly. Tailwind class chips (click to remove, input to add). Computed styles collapsed. Changes output as explicit before→after diffs.
- **Color conversion fix** — `lab()`, `oklch()`, `oklab()` converted to hex via canvas `getImageData` pixel-read approach. Fixes Chrome console warnings.
- **Live preview** — editing in popover applies changes to the actual element temporarily. Cancel/Escape reverts.
- **Review panel shows diffs** — color dots with before→after, text changes, class additions/removals. Text content shown for identification.
- **Improved extension popup** — version, MCP status, overlay status, page URL.
- **Breadcrumb bar moved** — from top (blocking headers) to above status bar.
- **Toggle button hidden when active** — no overlap with status bar.
- **MCP server port retry** — tries 4100-4109 if default port is in use.
- **Published v0.2.0** — npm package with postinstall that downloads binary, installs slash command, registers MCP server, auto-allows tools in Claude Code permissions.
- **Extension zip** — `dist/promptotype-extension-v0.2.0.zip` for manual sharing.
- **Researched V0/Lovable inline editing** — documented source-code mapping approaches (Fiber, Babel plugins, Vite plugins, Stega encoding).

## Decisions

- **HTTP wait endpoint over MCP sampling** — MCP is pull-based; sampling doesn't trigger agent action in Claude Code. The blocking curl pattern (same as proxy) works reliably.
- **Continuous mode via MCP tool loop** — slash command instructs agent to call `wait_for_annotations()` repeatedly. Close signal from overlay stops the loop.
- **Live preview reverts on save** — the agent makes the real change in code, not the browser preview. Preview is for user confirmation only.
- **Popover: editable over descriptive** — direct editing (text, colors, classes) eliminates prompt writing for simple changes. Prompt stays for complex instructions.
- **Canvas getImageData for color conversion** — only reliable method for CSS Color Level 4 formats. Canvas fillStyle doesn't normalize lab/oklch to hex.

## Files Changed/Created

**New files:**
- `src/tailwind.ts` — Tailwind detection + class categorization
- `extension/content-bridge.js` — Screenshot request relay between page and background

**Significantly modified:**
- `src/annotation-popover.ts` — Complete rewrite: editable text, color pickers, class chips, style inputs, live preview, collapsed sections
- `src/extract-styles.ts` — Source location extraction (Fiber + data attributes), CSS class extraction, text content extraction, screenshot capture, canvas color conversion
- `src/types.ts` — Added SourceLocation, DesignChanges, new Annotation fields
- `src/output.ts` — Tailwind categories, text content, source location, change diffs in markdown
- `src/review-panel.ts` — Change diffs with color dots, text content display
- `src/index.ts` — Live preview, clear after submit, toggle button hide/show, MCP close signal
- `src/breadcrumb-bar.ts` — Repositioned above status bar
- `cli/mcp-server.ts` — Wait endpoint, close endpoint, port retry, MCP sampling attempt, logging
- `cli/index.ts` — Serve subcommand
- `cli/promptotype.md` — MCP tool-based continuous mode instructions
- `npm/postinstall.js` — Slash command install, MCP registration, permissions auto-allow
- `extension/popup.html` + `popup.js` — Status info, page URL, version
- `extension/manifest.json` — Content script for screenshot bridge
- `package.json` — v0.2.0, new scripts, files

## Next Steps

1. [ ] Get the extension on Chrome Web Store
2. [ ] Share with users — write up the Shiplex demo story
3. [ ] Real extension icons (currently placeholder purple squares)
4. [ ] Consider Railway deployment for always-on MCP server (after user validation)
5. [ ] Test with Cursor, Codex, Gemini CLI (not just Claude Code)
6. [ ] Investigate companion Vite plugin for source location injection (React 19+ compat)

## Notes

- v0.2.0 is on npm. Binary downloaded from GitHub release on install.
- Extension improvements (live preview, review diffs, popup) are on main but not in the v0.2.0 tag/binary. Will go out with v0.2.1.
- MCP server registered globally via `claude mcp add promptotype -s user`.
- Tools auto-allowed in `~/.claude/settings.json` to avoid permission prompts in continuous mode.
- The full annotation loop works end-to-end: `/promptotype` → annotate → submit → agent applies → wait → annotate → submit → deactivate → stop.
