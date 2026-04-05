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

## 2026-04-05: Session Token for Proxy Endpoint

**Context**: Codex adversarial review flagged that any JS on the proxied page could forge annotation submissions to the CLI.
**Decision**: Generate a crypto.randomUUID() per proxy session, inject via bootstrap.js, validate on every annotation POST.
**Rationale**: The overlay is the only legitimate submitter. The token is injected only into the bootstrap file served by the proxy, not accessible to the target app's own scripts.
