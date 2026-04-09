# Design Project: Promptotype

> Created: 2026-04-05
> Status: in_progress

## Design Vision

**One-liner:** A browser-based design inspector that extracts visual context from locally running apps and sends structured, annotated feedback to AI coding agents.

**Core Value Proposition:**
> Bridges the gap between "what I see in the browser" and "what the AI agent needs to know" — letting designers inspect, annotate, and communicate design intent without touching code.

## Target Users

### Primary User
| Attribute | Description |
|-----------|-------------|
| Role | Designer reviewing a locally running vibe-coded app |
| Goals | Inspect UI elements, capture design context, annotate feedback, send to AI agent |
| Pain Points | No structured way to communicate visual issues to AI tools; screenshots lack context; manual description is slow and imprecise |
| Expertise Level | Design-literate, not necessarily code-literate |
| Usage Context | Local development environment, reviewing AI-generated UI in the browser |

### Secondary Users
| Role | Relationship to Primary | Key Needs |
|------|------------------------|-----------|
| AI coding agent (Claude, Cursor, etc.) | Receives annotated design feedback | Structured, actionable context about what to change |
| Developer | May use tool themselves or review annotations | Clear specs tied to specific elements |

## Design Principles

> What principles guide design decisions for this project?

1. **Inspect, don't assume** — Extract real computed values from the DOM, not guesses
2. **Review before sending** — Always give the user a chance to annotate and refine before sending to an agent
3. **Start simple, grow smart** — Begin with text + color extraction, expand to spacing, layout, components over time

## Constraints

### Technical Constraints
- Must work on locally running apps (localhost)
- Browser extension or injected script approach (like React Grab)
- Needs to extract computed styles from live DOM elements
- Must integrate with CLI tools (Claude Code, Cursor, etc.)

### Brand/Visual Constraints
- The annotation UI should feel like a design tool, not a dev tool

### Timeline Constraints
- None specified

### Business Constraints
- None specified

## Success Criteria

| Metric | Current | Target | How Measured |
|--------|---------|--------|--------------|
| Element selection to annotation | N/A | < 3 seconds | Time from click to annotation UI |
| Context accuracy | N/A | 100% for text + color | Compare extracted vs actual computed values |
| Agent comprehension | N/A | Actionable on first send | AI agent can act on annotation without follow-up |

## Key Decisions

> Log major design decisions here as they're made

| Date | Phase | Decision | Rationale | Decided By |
|------|-------|----------|-----------|------------|
| 2026-04-05 | Init | Start with text + color extraction | Incremental approach; these are the most common design feedback items | User |
| 2026-04-05 | Init | Include annotation UI (plannotator-style) | Users need a review step before sending to AI | User |
| 2026-04-05 | Init | Target locally running apps | Primary use case is vibe-coded apps in dev | User |
| 2026-04-05 | Discovery | User is anyone reviewing a vibe-coded app, not just designers | PM, dev, founder all share the same workflow | User |
| 2026-04-05 | Discovery | Batch annotations as core differentiator | Select multiple elements, annotate each, review all, send once | User |
| 2026-04-05 | Discovery | Use native DOM traversal, no custom tree panel | Browser already has the tree; Alt+scroll for depth | User |
| 2026-04-05 | Discovery | POC properties: font, color, spacing, alignment | Covers visual hierarchy essentials without overbuilding | User |
| 2026-04-05 | UX | Inline popover for annotation, not side panel | Keep context near the element being annotated | UX Phase |
| 2026-04-05 | UX | Bottom status bar + right review panel | Batch management always visible; review maintains spatial context | UX Phase |
| 2026-04-05 | UX | Numbered pin markers on annotated elements | Clear, scannable, shows annotation order | UX Phase |
| 2026-04-05 | UX | Structured markdown as clipboard output | AI agents parse markdown naturally; human-readable too | UX Phase |
| 2026-04-09 | Discovery (P4) | Browser extension replaces proxy as primary injection | Proxy is inherently fragile — breaks on Next.js, Shiplex, etc. | User |
| 2026-04-09 | Discovery (P4) | Shadow DOM for overlay isolation | Prevents CSS conflicts between overlay and host page | User |
| 2026-04-09 | Discovery (P4) | MCP server (stdio) for agent delivery | Universal support — Codex, Cursor, Gemini, Claude Code, Copilot all support MCP | User |
| 2026-04-09 | Discovery (P4) | Chrome only for v1 | Focus on one platform, expand later | User |
| 2026-04-09 | Discovery (P4) | Ship extension + MCP together | Both needed: extension captures, MCP delivers | User |

## References

- [plannotator](https://github.com/backnotprop/plannotator) — Annotation UI inspiration
- [React Grab](https://www.react-grab.com/) — Element selection + context extraction inspiration

---

## Scope

### In Scope
- Browser-based element selection (hover + click/shortcut)
- Extract text content and color values from selected elements
- Structured annotation UI for review/editing
- Send annotated context to AI CLI tools
- Works on localhost running apps

### Out of Scope
- Figma integration (future)
- Production app support
- Collaborative/multi-user annotations
- Screenshot capture (future consideration)

### Future Considerations
- Spacing, layout, and typography extraction
- Component tree detection (React, Vue, etc.)
- Screenshot + visual diff
- Direct Figma comparison
- Plugin ecosystem
