# Architectural Decisions

## 2026-04-05: Vanilla TypeScript, No Framework

**Context**: Needed to decide on tech stack for a browser overlay that gets injected into any running app.
**Decision**: Vanilla TypeScript compiled to a single IIFE bundle via Vite.
**Rationale**: The tool must work in any browser, on any app, without conflicts. A framework (React, etc.) could clash with the host app's own framework. Single IIFE means one script tag to inject. React Grab uses the same approach.

## 2026-04-05: Batch Annotations as Core Differentiator

**Context**: The current workflow is screenshot + describe one element at a time.
**Decision**: Support selecting multiple elements, annotating each, reviewing all in a side panel, and submitting as one structured batch.
**Rationale**: This is the #1 value prop over screenshots. An AI agent can make all changes in one pass instead of multiple back-and-forth rounds.

## 2026-04-05: Structured Markdown as Output Format

**Context**: Needed to decide what format annotations are sent to AI agents in.
**Decision**: Structured markdown with element selector, current styles, user prompt, and optional color suggestion.
**Rationale**: AI agents parse markdown naturally. JSON would be more precise but less human-readable. Markdown works when pasted into any CLI tool.

## 2026-04-05: CLI Integration Roadmap — 4 Phases

**Context**: Multiple ways to connect the browser overlay to AI coding agents.
**Decision**: Progressive approach: (1) Clipboard → (2) Local API + bookmarklet → (3) Proxy plugin like plannotator → (4) MCP server + browser extension.
**Rationale**: Each phase builds on the previous. Start with what works now (clipboard), then add automation. The plannotator pattern (HTTP server, stdout contract, slash command) is proven. MCP + extension is the long-term vision where extension captures and MCP delivers to any agent.

## 2026-04-05: Optional Prompt Field

**Context**: User may want to annotate an element with just a color change or just to flag it, without writing a prompt.
**Decision**: Prompt textarea is optional. Annotations can be saved with just a color suggestion or even nothing (properties-only).
**Rationale**: Reduces friction. Sometimes the extracted properties + a color hex are enough context for the AI agent.

## 2026-04-05: Public Personal Repo for Distribution

**Context**: Enterprise repo (SignalOrg) is private, can't serve public release assets or install scripts.
**Decision**: Migrated to niforiskollaros/promptotype as the public distribution repo.
**Rationale**: Simplest path to public distribution without enterprise policy issues. Install script, npm, and CI all work against the public repo.

## 2026-04-09: Chrome Extension Replaces Proxy as Primary Injection

**Context**: Proxy broke on Next.js (hop-by-hop headers), then broke on Shiplex (different CSS delivery). Every framework has different quirks. Non-technical users can't debug proxy issues.
**Decision**: Chrome extension injects overlay directly via Shadow DOM. Proxy remains as fallback.
**Rationale**: Extension has direct DOM access — no headers, no encoding, no framework-specific hacks. Shadow DOM isolates overlay CSS from host page. Proven on Shiplex (fully styled) where proxy completely failed.

## 2026-04-09: MCP Server for Agent Delivery

**Context**: Need a standard way to deliver annotations from browser to any AI coding agent.
**Decision**: Local MCP server (`promptotype serve`) with stdio transport for agents and HTTP endpoint for extension.
**Rationale**: MCP is universally supported (Codex, Cursor, Gemini, Claude Code, Copilot, Windsurf). stdio is the most compatible transport. HTTP endpoint allows the extension (which can't do stdio) to communicate with the server.

## 2026-04-09: Shadow DOM for Overlay Isolation

**Context**: Overlay CSS was potentially affected by host page resets and Tailwind classes.
**Decision**: Inject all overlay UI into a Shadow DOM attached to a host element on the page.
**Rationale**: Shadow DOM prevents CSS leakage in both directions. Host page styles can't break the overlay, overlay styles can't affect the page. Required refactoring all 9 modules to use a context-based root container.

## 2026-04-10: HTTP Wait Endpoint Over MCP Sampling

**Context**: MCP is pull-based. Tried MCP sampling (`createMessage`) and log notifications to push annotations to the agent automatically. Claude Code ignores both — the agent only acts when it calls a tool.
**Decision**: Added `/__pt__/api/wait` HTTP endpoint that blocks until annotations arrive. The slash command uses `curl` against this endpoint, replicating the proxy's blocking behavior.
**Rationale**: The blocking curl pattern works because the agent is already waiting for the command's output. When annotations arrive, they flow straight into the conversation. This is the same pattern that made the proxy work, without the proxy's fragility.

## 2026-04-10: Editable Popover Over Prompt-Only

**Context**: Users had to describe every change in a text prompt ("change this color to red", "make text bigger"). Simple visual changes required unnecessary writing.
**Decision**: Made text, colors, font properties, spacing, and Tailwind classes directly editable in the popover. Changes output as explicit before→after diffs. Prompt stays for complex instructions.
**Rationale**: Direct editing eliminates the prompt for 80% of changes. The agent gets exact diffs instead of interpreting natural language, reducing misinterpretation.

## 2026-04-14: devDependencies Only — No Runtime npm Dependencies

**Context**: `@modelcontextprotocol/sdk` was listed as a production dependency, causing ~30 packages to install on end-user machines. The CLI binary is pre-compiled by Bun and bundles all its own dependencies.
**Decision**: Moved `@modelcontextprotocol/sdk` to devDependencies. The npm package now has zero production dependencies.
**Rationale**: The Bun-compiled binary is self-contained — it doesn't use `node_modules` at runtime. The npm package only ships a thin Node.js wrapper (`npm/cli.js`) that execs the binary, plus the postinstall script (pure Node stdlib). No runtime dependency is needed.

## 2026-04-14: bin/.gitkeep Instead of bin/ in npm files

**Context**: The `files` field in package.json included `bin/`, which accidentally shipped a 62MB locally-downloaded binary in the v0.2.1 tarball.
**Decision**: Changed `files` to include only `bin/.gitkeep`. Postinstall cleans up the placeholder before downloading the correct platform binary.
**Rationale**: The `bin/` directory needs to exist in the tarball so postinstall can write to it, but should never contain actual binaries — those are downloaded per-platform from GitHub Releases.

## 2026-04-05: Session Token for Proxy Endpoint

**Context**: Codex adversarial review flagged that any JS on the proxied page could forge annotation submissions to the CLI.
**Decision**: Generate a crypto.randomUUID() per proxy session, inject via bootstrap.js, validate on every annotation POST.
**Rationale**: The overlay is the only legitimate submitter. The token is injected only into the bootstrap file served by the proxy, not accessible to the target app's own scripts.
