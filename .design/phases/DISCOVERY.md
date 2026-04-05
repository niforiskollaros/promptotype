---
phase: discovery
skill: dsp-discovery
completed: 2026-04-05T12:30:00Z
depth: standard
challenge_mode: heavy
context_loaded:
  - PROJECT.md
problem_statement: "Anyone reviewing a vibe-coded running app needs a way to point at specific UI elements and tell an AI agent exactly what to change, with real extracted design values — without screenshots and manual descriptions."
primary_user: "Anyone reviewing a locally running AI-generated app (designer, PM, developer)"
key_requirements:
  - REQ-01: Browser overlay with dev-tools-style element selection and nesting
  - REQ-02: Extract font properties, colors, spacing (padding/margin), and alignment from selected elements
  - REQ-03: Freeform prompt input per selected element
  - REQ-04: Batch multiple element annotations in a single session
  - REQ-05: Review/summary screen showing all annotations before submission
  - REQ-06: Structured output to AI coding agents (clipboard/CLI)
---

# Design Brief: Promptotype

## Executive Summary

Promptotype is a browser overlay that lets anyone select UI elements in a locally running app, see their computed design properties, write prompts per element, batch multiple annotations, review them, and send structured feedback to AI coding agents. It replaces the screenshot-paste-describe workflow with precise, structured, point-and-click design feedback.

## Problem Statement

> **Anyone reviewing a vibe-coded app** needs a way to **point at specific UI elements and communicate exactly what to change** because **screenshots lose context, manual descriptions are slow and imprecise, and individual fixes can't be batched**, which results in **slow iteration cycles, miscommunication with AI agents, and multiple back-and-forth rounds to get the UI right**.

## Users & Context

### Primary User
- **Role:** Anyone reviewing a locally running AI-generated app — designer, PM, developer, or founder
- **Goals:** Quickly communicate visual improvements to an AI coding agent with precision
- **Current behavior:** Take a screenshot, paste into CLI, write a prompt describing what to change. One element at a time.
- **Pain points:** Screenshots lack structured data; describing visual issues in words is slow and imprecise; can't batch multiple fixes; AI agents sometimes misinterpret visual intent
- **Expertise level:** Design-literate (understands basic terms like padding, margin, font-size) but not necessarily code-literate

### Secondary Users
- **AI coding agents (Claude Code, Cursor, etc.):** Receive structured annotations. Need clear, actionable context about what element to change and what the desired outcome is.

### Usage Context
- **When/where:** During local development, reviewing an AI-generated app running in the browser (localhost)
- **Surrounding workflow:** User prompts AI → AI generates/modifies code → App runs locally → User reviews in browser → **Promptotype captures feedback** → Feedback goes back to AI → Repeat
- **Frequency:** Multiple times per session, potentially dozens of annotations per review cycle

## Current State Journey Map

```
[See issue in running app] → [Take screenshot] → [Paste in CLI] → [Write description ⚠️] → [AI interprets ❓] → [AI makes changes] → [Review again 🔧] → [Repeat for next element ⚠️]
```

- ⚠️ Writing descriptions is slow and imprecise
- ❓ AI may misinterpret what element or property you mean
- 🔧 One element at a time — can't batch
- 💡 Opportunity: Point at the element, see its real values, write a prompt, batch multiple, send structured data

## Future State Journey Map

```
[See issues in running app] → [Activate Promptotype] → [Click element → see properties → write prompt] → [Repeat for more elements] → [Review all annotations] → [Submit to AI agent] → [AI makes all changes at once]
```

## Requirements

### Must Have (POC)
- **REQ-01:** Browser overlay with element selection via hover + click
- **REQ-02:** Dev-tools-style highlight on hover showing element boundaries
- **REQ-03:** Nested element selection (Alt + scroll to traverse depth, or equivalent)
- **REQ-04:** Extract and display computed font properties (size, weight, family, line-height)
- **REQ-05:** Extract and display computed colors (text color, background color) as hex values
- **REQ-06:** Extract and display spacing (padding and margin values)
- **REQ-07:** Extract and display alignment properties
- **REQ-08:** Freeform prompt input per selected element
- **REQ-09:** Simple color input (user provides hex values)
- **REQ-10:** Batch multiple element annotations in one session
- **REQ-11:** Review/summary screen showing all annotations with element identifier, current properties, and user prompt
- **REQ-12:** Edit/refine annotations in the review screen before submission
- **REQ-13:** Structured output format for AI agents (element selector + current values + prompt)
- **REQ-14:** Copy to clipboard / send to CLI integration

### Should Have
- Visual thumbnail or highlight for each annotated element in review screen
- Keyboard shortcut to activate/deactivate the tool
- Undo/remove individual annotations

### Could Have (Future)
- Design token integration (map to token names instead of raw values)
- Component detection (is this a design system component?)
- Figma comparison (side-by-side with design file)
- Screenshot capture per annotation
- Direct pipe to Claude Code session (not just clipboard)
- Multi-user collaboration
- Typography scale detection
- Spacing system detection (is this on an 8px grid?)

### Must NOT Have (POC)
- Full DOM tree panel (use existing browser DOM traversal)
- Production app support (dev-only)
- Design file import/sync
- Visual diff tooling

## Constraints & Dependencies

- **Technical:** Must work as browser extension or injected script on localhost. Uses native DOM APIs (`elementFromPoint`, `getComputedStyle`, parent/child traversal). No custom DOM tree panel needed — leverage the browser's existing tree.
- **Integration:** Output must be structured enough for AI agents to act on without follow-up questions.
- **UX:** Must feel like a design tool, not dev tools. The annotation UI should be approachable for non-developers.

## Success Metrics

| Metric | Current | Target | How Measured |
|--------|---------|--------|--------------|
| Time from "see issue" to "send to AI" | ~2-3 min (screenshot + describe) | < 30 seconds per element | Timed user flow |
| Batch capability | 1 element at a time | Unlimited per session | Feature exists |
| AI comprehension | Often needs follow-up | Actionable on first send | AI acts correctly without clarification |
| Context accuracy | Manual description (lossy) | 100% for extracted values | Computed vs extracted comparison |

## Risks & Assumptions

### Key Assumptions
- Users reviewing vibe-coded apps will prefer structured annotation over screenshots → Validate with dogfooding
- Computed CSS values provide enough context for AI agents to make correct changes → Validate by testing structured output with Claude Code
- Non-technical users understand basic terms like padding, margin, font-size → Validate with user testing
- Batch annotations are significantly more efficient than one-at-a-time → Validate by comparing workflows

### Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Element selection is frustrating for nested/complex layouts | Medium | High | Alt+scroll depth traversal; test with real apps |
| Extracted properties are overwhelming (too many values) | Medium | Medium | Curate which properties to show; progressive disclosure |
| Output format doesn't match what AI agents need | Low | High | Test with Claude Code early; iterate on format |
| Tool conflicts with app's own event handlers | Medium | Medium | Use capture phase; dedicated activation mode |

## Open Questions

1. **Injected script vs browser extension?** Extension has better DX but harder distribution. Script (like React Grab's approach) is easier to install via npm. Leaning toward injected script for POC.
2. **What does the annotation prompt bar look like exactly?** Inline popover near the element? Side panel? Bottom bar? Needs UX phase exploration.
3. **How to visually indicate "this element has been annotated" while continuing to annotate others?** Badge? Color change on overlay? Pin marker?
4. **Clipboard format:** Plain text markdown? JSON? What do AI agents parse best?

## Action Plan

### Immediate Next Steps
1. [ ] Run `/dsp:ux` to design the interaction flow and annotation UI
2. [ ] Prototype element selection with `elementFromPoint` + depth traversal
3. [ ] Test structured output format with Claude Code to validate AI comprehension

### Design Phase Readiness
- [x] Problem validated
- [x] Users understood
- [x] Scope clear
- [x] Success defined
- [x] Constraints documented
