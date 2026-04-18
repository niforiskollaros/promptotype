# Session: Bun → Node Migration + Windows Support

**Date**: 2026-04-17
**Duration**: ~single long session
**Versions shipped**: 0.3.0, 0.3.1, 0.3.2, 0.3.3

## Accomplished

- **Dropped the Bun single-file binary** in favor of a pure Node.js ESM bundle. Solves macOS 26 Tahoe SIGKILL on unsigned binaries (Gatekeeper/amfid tightening), removes per-platform build matrix, cuts tarball from `26KB + 62MB download` → `190KB self-contained`. Windows becomes supported for free.
- **Built `cli/node-adapter.ts`** — ~120-line `serveFetch()` that runs Bun.serve-style `(req: Request) => Response` handlers on `node:http`, with EADDRINUSE port-retry and an upgrade-event hook for WebSocket handoff.
- **Rewrote the proxy WS path** using `ws` for the server side and Node 22's built-in `WebSocket` global for upstream. Added a pending-frame queue to handle the client-sends-before-upstream-OPEN race, and close-code sanitization (1005/1006 are reserved and can't be re-sent). Verified with `test/smoke-ws.mjs`.
- **Replaced Bun APIs** — `Bun.serve` → adapter, `Bun.spawn` → `child_process.spawn(…, {detached, stdio:'ignore'}).unref()`, `import … with { type: 'text' }` → `readFileSync` with fallback path resolution for dev/bundle modes.
- **New build pipeline** — `scripts/build-cli.mjs` uses esbuild to bundle the CLI as ESM with a `createRequire` banner (needed because `ws` is CJS and imports `require('events')` internally).
- **Simplified release workflow** — removed the four-platform binary build matrix; replaced with a single job that also attaches a `promptotype-chrome-extension.zip` so non-developers can install the Chrome extension without cloning/building.
- **Added `update-notifier`** — CLI checks npm registry once per 24h (cached, background fetch), prints a notice on stderr when a newer version is available. Safe for MCP stdio (stderr-only, TTY-gated).
- **Fixed the MCP self-heal bug** — postinstall now calls `claude mcp remove` before `add`, so upgrades from 0.2.x automatically repair stale registrations pointing at dead Bun binary paths.
- **Made Windows first-class** — swapped `which claude` for the cross-platform `claude --version`, replaced `cp` in `build:ext` with a Node `fs.copyFileSync` one-liner, added `emptyOutDir: false` to Vite so the two builds coexist in `dist/`.
- **Cleaned up the repo** — expanded `.gitignore`, stopped tracking `extension/overlay.js` (92KB build artifact that churned every diff) and `.design/` (DSP workflow state). 55 tracked files, all actual source now.
- **Documentation overhaul** — updated README, CLAUDE.md, and install.sh to reflect Node-first distribution; rewrote `docs/INTERNAL_GUIDE.md` twice (first technical pass, then rewritten for design/PM audience: warmer tone, scenario lead, no shell-command troubleshooting).

## Key Decisions

See `DECISIONS.md` for the full writeups. Summary:

- **Drop Bun binary, distribute as bundled Node.js ESM** — the root-cause answer to macOS 26 SIGKILL. Every major npm CLI (Vercel, Firebase, Stripe) does this. Requires Node ≥22 which is reasonable as of April 2026 (Node 20 EOL today).
- **Keep full self-containment via esbuild bundle** instead of marking deps external — single 1.2MB file, no runtime `node_modules` resolution, works the same on every host.
- **ESM output with `createRequire` banner**, not CJS — preserves top-level await in `cli/index.ts` and handles CJS transitive deps via the banner.
- **Ship a prebuilt extension zip with every GitHub release** — lowers the bar for non-technical users (the PM audience specifically) from "clone + npm install + npm run build:ext" to "download zip + Load unpacked".
- **Notifier over auto-update** — show a notice, let the user run the upgrade command. Auto-update creates trust issues and breaks in corporate environments.

## Files Changed

| Action | Path | Description |
|--------|------|-------------|
| Created | `cli/node-adapter.ts` | Fetch-style HTTP server on `node:http` + port-retry + upgrade hook |
| Created | `scripts/build-cli.mjs` | esbuild bundler with shebang + createRequire banner |
| Created | `test/smoke-ws.mjs` | WebSocket proxy round-trip verification |
| Created | `docs/INTERNAL_GUIDE.md` | PM/designer-friendly Confluence source doc |
| Rewritten | `cli/server.ts` | Proxy swapped from `Bun.serve`+WS handlers to adapter + `ws` package |
| Rewritten | `cli/mcp-server.ts` | Uses adapter, async startup, version bumped through to 0.3.3 |
| Rewritten | `cli/index.ts` | Shebang removed (banner owns it), `child_process.spawn`, update-notifier wired in |
| Rewritten | `test/mock-app/serve.ts` | Converted from Bun (`Bun.serve`, `Bun.file`, `import.meta.dir`) to Node |
| Rewritten | `install.sh` | Now a thin wrapper that verifies Node ≥22 and runs `npm install -g` |
| Rewritten | `.github/workflows/release.yml` | Single build job + extension zip asset, no binary matrix |
| Rewritten | `npm/postinstall.js` | Drops binary download, adds MCP self-heal (remove before add), `claude --version` not `which claude` |
| Rewritten | `README.md` | Node-first install notes, "Updating" section, Windows-supported claim |
| Modified | `CLAUDE.md` | Architecture now describes Node ESM + esbuild + update-notifier, version bumped to 0.3.3 |
| Modified | `package.json` | `"engines": { "node": ">=22" }`, `bin → dist/cli.mjs`, `build:ext` cross-platform, deps (esbuild, tsx, ws, @types/ws, @types/node, update-notifier), `prepublishOnly: build:all` |
| Modified | `vite.config.ts` | `emptyOutDir: false` so CLI and overlay bundles coexist |
| Modified | `.gitignore` | Expanded: `.claude/`, `.design/`, `extension/overlay.js`, logs, env files, editor/IDE state, `*.tgz`, coverage |
| Modified | `site/index.html` | Swapped curl/npm prominence so npm is primary; added "Requires Node 22+" line |
| Deleted | `bin/` (dir) + `bin/promptotype` + `bin/.gitkeep` | No more platform binaries |
| Deleted | `npm/cli.js` | Thin wrapper no longer needed — bundle is the bin |

## Next Steps

- [ ] **Get a Windows tester** to actually run the flow end-to-end (I don't have a Windows box; v0.3.3 should work but hasn't been physically verified)
- [ ] **Chrome Web Store submission** — $5 + review time, lets non-developers skip the Developer-mode dance entirely
- [ ] **Paste `docs/INTERNAL_GUIDE.md` into Confluence** — change the "ping Nikos on Slack" line to an actual Slack handle first
- [ ] **Consider MCP-side update nudge** — `update-notifier` is TTY-only, so Claude-Code-first users (who run `promptotype serve` via stdio) never see it. An MCP log notification on connection when an update exists would reach that audience. Held off because it risks noise, but worth revisiting if users report being stuck on old versions.
- [ ] **Consider removing/redirecting GitHub release draft workflow** — initial releases v0.3.0/0.3.1 came out as drafts, v0.3.2+ publish directly. Worth confirming the behavior is stable.

## Notes

- **Two forced-publish moments** during the session: once when GitHub auth was the work account (`n-kollaros_signalgr`) not the personal one (`niforiskollaros`) — fixed with `gh auth switch`. Worth remembering for future publishes from this machine.
- **Stale MCP registration encountered on real machine** — the user's local `claude mcp list` showed promptotype pointed at `bun /Users/nkollaros/Projects/Skills & Tools/DesignAnnotator/cli/index.ts serve`. This was a pre-npm-packaging registration that our 0.3.0/0.3.1 postinstall silently failed to overwrite (add fails if entry exists). Fix shipped in 0.3.2.
- **update-notifier first-release caveat** — the first version shipping the notifier (0.3.1) can never announce itself. Existing users find out via README/word-of-mouth. Documented in README and CLAUDE.md for future-us.
- **Bundle size trajectory**: 62MB Bun binary → 855KB (0.3.0, pre-notifier) → 1.2MB (0.3.1+, with update-notifier pulling boxen/chalk/configstore). Still dramatically better.

---
*Session documented with wrap-up skill*
