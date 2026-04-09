---
phase: discovery
skill: dsp-discovery
completed: 2026-04-09T15:30:00Z
depth: standard
challenge_mode: heavy
context_loaded:
  - PROJECT.md
  - DISCOVERY.md (original Phase 1-3)
  - sessions/DECISIONS.md
problem_statement: "The proxy-based injection approach breaks across different dev servers and frameworks, making Promptotype unreliable for non-technical users. A browser extension with MCP server eliminates the proxy fragility and provides native integration with every major AI coding agent."
primary_user: "Designers and PMs reviewing locally running apps, plus developers who want seamless AI agent integration"
key_requirements:
  - REQ-P4-01: Chrome browser extension that injects the overlay IIFE into any page
  - REQ-P4-02: Shadow DOM isolation for overlay to prevent CSS conflicts
  - REQ-P4-03: Local MCP server (companion process) that receives annotations from extension
  - REQ-P4-04: MCP tools (get_annotations, wait_for_annotations) for AI agent consumption
  - REQ-P4-05: Extension-to-MCP communication via localhost HTTP
  - REQ-P4-06: Proxy CLI remains as fallback for users who don't want to install an extension
aesthetic_direction:
  archetype: null
  feel: null
  references: []
  mode_preference: null
  brand_constraints: "Existing purple accent (#7C3AED), dark warm surfaces (#161618)"
---

# Design Brief: Promptotype Phase 4 — Browser Extension + MCP Server

## Executive Summary

Replace the fragile proxy-based injection with a Chrome browser extension that injects the overlay directly into any page (zero proxy, zero header issues), paired with a local MCP server that delivers annotations to any AI coding agent natively. The proxy remains as a lightweight fallback. This makes Promptotype work effortlessly on any project, any framework, for any user.

## Problem Statement

> **Designers, PMs, and developers reviewing locally running apps** need a way to **annotate UI elements and send structured feedback to AI agents reliably** because **the current proxy-based approach breaks across different dev servers and frameworks** (Next.js basePath, Turbopack chunked responses, various CSS delivery mechanisms), which results in **unstyled pages, broken apps, and a tool that can't be trusted to "just work."**

### Evidence

- Proxy broke on Next.js 16 with basePath (hop-by-hop header forwarding)
- Proxy broke on Shiplex (different CSS delivery mechanism) even after the fix
- Every new framework/dev-server requires new proxy patches — whack-a-mole
- Non-technical users (designers, PMs) have zero tolerance for debugging proxy issues

## Users & Context

### Primary User: Designer / PM
- **Role:** Reviews locally running vibe-coded apps in the browser
- **Goals:** Point at elements, describe what to change, send to the developer's AI agent
- **Current behavior:** Takes screenshots, writes descriptions, pastes into Slack/CLI
- **Pain points:** Proxy breaks on their projects; they can't debug it; they give up
- **Expertise level:** Can install a Chrome extension. Cannot debug proxy/CLI issues.
- **Key insight:** This user will never run `npm install -g` — they need a Chrome Web Store link

### Secondary User: Developer
- **Role:** Receives annotations from designer/PM, or annotates their own apps
- **Goals:** Get structured feedback directly in their AI agent (Claude Code, Cursor, etc.)
- **Current behavior:** Runs proxy CLI, works when it works, frustrated when it doesn't
- **Pain points:** Proxy fragility; wants native agent integration
- **Expertise level:** Can run `npm install -g promptotype` and configure MCP servers

### Usage Context
- **When/where:** During development, reviewing AI-generated UI in the browser
- **Workflow with extension + MCP:**
  ```
  Designer installs Chrome extension (one time)
  Developer runs MCP server: promptotype serve (one time, or auto-start)
  Designer opens app in browser → clicks extension icon → annotates → hits Submit
  Developer tells agent "apply my design feedback" → agent calls get_annotations()
  ```

## Current State Journey Map

```
[See issue in app] → [Run promptotype CLI ⚠️] → [Proxy breaks on project ⚠️] → [Debug headers 🔧] → [Maybe it works ❓] → [Annotate] → [Submit] → [Pray it reaches agent]
```

- ⚠️ Proxy breaks on many real projects (Next.js, Shiplex, etc.)
- 🔧 Non-technical users can't debug proxy issues
- ❓ Unreliable delivery undermines trust in the tool

## Future State Journey Map

```
[See issue in app] → [Click extension icon] → [Annotate elements] → [Hit Submit] → [Agent receives annotations via MCP] → [Changes made]
```

- No proxy, no CLI command to start, no header issues
- Extension injects overlay directly — works on any page
- MCP delivers to any agent natively — no clipboard, no manual paste

## Architecture

### Components

```
┌─────────────────────────────────┐
│  Chrome Extension               │
│  ┌───────────────────────────┐  │
│  │ Content Script            │  │
│  │ (injects overlay IIFE    │  │
│  │  into Shadow DOM)         │  │
│  └───────────┬───────────────┘  │
│              │ annotations       │
│  ┌───────────▼───────────────┐  │
│  │ Background Service Worker │  │
│  │ (manages state, routes    │  │
│  │  to MCP server)           │  │
│  └───────────┬───────────────┘  │
│              │ POST localhost    │
└──────────────┼──────────────────┘
               │
    ┌──────────▼──────────┐
    │  MCP Server          │
    │  (local companion)   │
    │                      │
    │  stdio ↔ AI agents   │
    │  HTTP  ↔ extension   │
    │                      │
    │  Tools:              │
    │  - get_annotations() │
    │  - wait_for_annot..()│
    └──────────────────────┘
         ↕ stdio
    ┌──────────────────────┐
    │  AI Agent             │
    │  (Claude Code,        │
    │   Cursor, Codex,      │
    │   Gemini CLI, etc.)   │
    └──────────────────────┘
```

### Extension Structure

```
extension/
├── manifest.json          # Manifest V3, Chrome only
├── background.ts          # Service worker — state, MCP communication
├── content.ts             # Content script — injects overlay into Shadow DOM
├── popup.html             # Extension popup — status, settings
├── popup.ts               # Popup logic
└── icons/                 # Extension icons (16, 48, 128px)
```

The content script:
1. Creates a Shadow DOM container on the page
2. Injects the existing overlay IIFE inside the shadow root
3. All overlay DOM/CSS is isolated from the host page
4. Annotation submission routes through the background service worker to the MCP server

### MCP Server Structure

```
cli/
├── index.ts               # CLI entry (existing) — add 'serve' subcommand
├── server.ts              # Proxy server (existing, fallback)
└── mcp-server.ts          # NEW: MCP server + HTTP receiver
```

The MCP server:
1. Runs as a local process: `promptotype serve` or `promptotype mcp`
2. Exposes stdio interface for AI agents (standard MCP)
3. Exposes HTTP endpoint for the extension to POST annotations
4. Holds one annotation batch at a time (new submission replaces old)
5. Registered in agent config: `claude mcp add promptotype -- promptotype serve`

### MCP Tools

**`get_annotations()`**
- Returns the latest submitted annotation batch as structured markdown
- Returns `{ annotations: null, message: "No annotations pending" }` if empty
- Non-blocking — returns immediately

**`wait_for_annotations(timeout_seconds?: number)`**
- Blocks until the user submits annotations from the extension
- Returns the annotation batch when received
- Optional timeout (default: 300s / 5 min)
- This is the "live" mode — agent waits, user annotates, annotations arrive

### Communication Flow

```
1. Extension content script → (message) → Background service worker
2. Background service worker → POST http://localhost:4100/__pt__/api/annotations → MCP server
3. MCP server stores batch, resolves any pending wait_for_annotations() calls
4. AI agent calls get_annotations() or wait_for_annotations() via stdio → gets markdown
```

Port 4100 chosen to avoid conflicts with common dev server ports (3000, 4000, 5173, 8080).

### Shadow DOM Isolation

```typescript
// Content script pseudocode
const host = document.createElement('div');
host.id = 'promptotype-root';
const shadow = host.attachShadow({ mode: 'closed' });

// Inject overlay CSS into shadow root (extracted from IIFE)
const style = document.createElement('style');
style.textContent = OVERLAY_CSS;
shadow.appendChild(style);

// Inject overlay into shadow root
const container = document.createElement('div');
shadow.appendChild(container);
document.body.appendChild(host);

// Initialize overlay inside shadow root
initPromptotype(container);
```

The overlay IIFE needs refactoring to:
- Accept a root container parameter (instead of assuming `document.body`)
- Export its CSS separately (for shadow DOM injection)
- Route DOM operations through the container, not `document`

## Requirements

### Must Have (v1)

| ID | Requirement | Component |
|----|-------------|-----------|
| REQ-P4-01 | Chrome extension (Manifest V3) injects overlay into any page | Extension |
| REQ-P4-02 | Shadow DOM isolation — overlay CSS/DOM never leaks to/from host page | Extension |
| REQ-P4-03 | Extension popup shows connection status to MCP server | Extension |
| REQ-P4-04 | Local MCP server as companion process (`promptotype serve`) | MCP Server |
| REQ-P4-05 | `get_annotations()` MCP tool — returns latest batch | MCP Server |
| REQ-P4-06 | `wait_for_annotations()` MCP tool — blocks until submission | MCP Server |
| REQ-P4-07 | HTTP endpoint for extension to POST annotations | MCP Server |
| REQ-P4-08 | Clipboard fallback when MCP server is not running | Extension |
| REQ-P4-09 | Proxy CLI remains as fallback distribution method | CLI |
| REQ-P4-10 | Works on localhost and local network URLs | Extension |

### Should Have

| ID | Requirement |
|----|-------------|
| SH-01 | Auto-detect if MCP server is running (extension shows status) |
| SH-02 | Extension badge shows annotation count |
| SH-03 | `promptotype serve` auto-starts on system login (launchd/systemd) |

### Could Have (Future)

| ID | Requirement |
|----|-------------|
| CH-01 | Work on staging/preview deploy URLs (not just localhost) |
| CH-02 | Firefox extension |
| CH-03 | Safari extension |
| CH-04 | MCP resource (promptotype://annotations) in addition to tools |
| CH-05 | Screenshot capture per annotation |
| CH-06 | Streamable HTTP MCP transport (for remote/team use) |

### Must NOT Have (v1)

- No cloud service or remote server — everything local
- No user accounts or authentication (beyond session token)
- No collaborative/multi-user features
- No Figma integration (separate future effort)

## Constraints & Dependencies

### Technical
- Chrome Manifest V3 (service workers, no persistent background pages)
- MCP stdio transport for agent compatibility (universal support)
- Existing overlay IIFE needs refactoring for Shadow DOM (accept root container)
- Bun for MCP server (consistent with existing CLI)

### Distribution
- Chrome Web Store review process (days to weeks)
- Can sideload locally for development/testing
- npm package for MCP server: `npm install -g promptotype` (already published)

### Timeline
- None specified — ship when ready

## Success Metrics

| Metric | Current (proxy) | Target (extension + MCP) | How Measured |
|--------|----------------|--------------------------|--------------|
| Works on any project | ~50% (proxy breaks) | 100% | Test against 5+ diverse projects |
| Setup time for designers | N/A (can't use proxy) | < 2 min (install extension) | Time to first annotation |
| Setup time for developers | ~2 min (npm + CLI) | ~3 min (npm + MCP config) | Time to first agent-received annotation |
| Annotation delivery | Clipboard or proxy POST | Direct to agent via MCP | Agent receives without manual paste |

## Risks & Assumptions

### Key Assumptions
| Assumption | Validation |
|------------|------------|
| Shadow DOM will fully isolate overlay from host page CSS | Test against Shiplex, AiBi, and other projects that broke |
| Designers will install a Chrome extension | Low friction — standard Chrome Web Store flow |
| Developers will configure MCP server in their agent | One-time setup, well-documented in every agent |
| localhost HTTP between extension and MCP server works reliably | Standard pattern, used by many dev tools |

### Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Chrome Manifest V3 service worker limitations (5-min timeout) | Medium | Medium | Keep service worker stateless; MCP server holds state |
| Shadow DOM doesn't fully isolate (edge cases) | Low | High | Test exhaustively against diverse apps |
| User confusion: "which do I install?" (extension vs npm) | Medium | Medium | Clear docs: designers = extension, developers = extension + npm |
| Chrome Web Store rejects the extension | Low | High | Follow CWS policies strictly; sideload for testing |

## Open Questions

1. **Overlay IIFE refactoring scope:** How much work to make the overlay accept a root container and export CSS separately? Is it a clean refactor or a rewrite?
2. **MCP server port:** 4100 is proposed — any conflicts? Should it be configurable?
3. **Extension activation:** Click the extension icon to toggle? Or auto-inject on all localhost pages with a toggle in the popup?
4. **Versioning:** Extension and MCP server versions need to stay compatible. Same semver, or independent?

## Action Plan

### Implementation Order

1. **Refactor overlay IIFE for Shadow DOM** — accept root container, export CSS separately
2. **Build MCP server** (`cli/mcp-server.ts`) — HTTP receiver + MCP stdio tools
3. **Build Chrome extension** — content script, background worker, popup
4. **Integration testing** — test against AiBi, Shiplex, and 3+ other projects
5. **Chrome Web Store submission**

### Design Phase Readiness
- [x] Problem validated (proxy breaks on real projects — experienced firsthand)
- [x] Users understood (designers/PMs install extension, developers add MCP)
- [x] Scope clear (extension + MCP server, Chrome only, localhost, v1)
- [x] Success defined (works on any project, < 2 min designer setup)
- [x] Constraints documented
