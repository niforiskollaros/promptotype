# Promptotype

Point at UI elements in a running app, describe what should change, and send structured feedback to AI coding agents.

## The Problem

When reviewing a vibe-coded app, the typical workflow is: take a screenshot, paste it into an AI CLI, and describe what to change. This is slow, imprecise, and limited to one element at a time.

Promptotype replaces that with point-and-click annotations that include real computed styles, batch multiple elements, and output structured markdown that AI agents can act on immediately.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/niforiskollaros/promptotype/main/install.sh | bash
```

This installs the `promptotype` binary and registers `/promptotype` as a slash command for Claude Code, Codex, and Gemini CLI.

## Quick Start

```bash
# Auto-detect a running dev server
promptotype

# Explicit URL
promptotype http://localhost:3000

# From Claude Code
/promptotype http://localhost:3000
```

## How It Works

1. **Activate** -- Press `Cmd+Shift+D` or click the floating button
2. **Inspect** -- Hover elements to see highlights with box model visualization
3. **Select** -- Click to see computed font, color, spacing, and alignment
4. **Annotate** -- Write a prompt describing what should change
5. **Batch** -- Repeat for as many elements as you want -- each gets a numbered pin
6. **Review** -- Click "Review & Submit" to see all annotations in a side panel
7. **Submit** -- Sends structured markdown directly to the AI agent (or copies to clipboard)

### What Gets Extracted

For each selected element:
- **Font** -- family, size, weight, line-height
- **Color** -- text color, background color (as hex)
- **Spacing** -- padding, margin (with box model visualization)
- **Alignment** -- text-align, display, align-items

### What the AI Agent Receives

```markdown
## Design Annotations (2 elements)

### 1. `h2.card-title`
**Current styles:**
- Font: Inter, 14px, weight 600, line-height 1.5
- Color: #333333 (on background #FFFFFF)
- Margin: 0 0 8px 0
- Padding: 4px 8px

**Prompt:** Make this heading larger and bolder -- it should dominate the card

---

### 2. `div.sidebar`
**Current styles:**
- Padding: 8px 8px 8px 8px

**Prompt:** Increase padding to 16px, feels too cramped
```

## CLI Options

```
promptotype [url] [options]

Options:
  --port <port>      Proxy server port (default: 4000)
  --no-open          Don't auto-open the browser
  --timeout <secs>   Auto-exit after N seconds
  --json             Output JSON instead of markdown
  --help, -h         Show this help
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+D` | Toggle Promptotype on/off |
| `Alt+Scroll` | Traverse element depth (parent/child) |
| `Cmd+Enter` | Save annotation (in popover) |
| `Escape` | Close popover / close review panel / deactivate |

## How It's Built

Single IIFE bundle (~66KB, ~14KB gzip) built with Vite. Vanilla TypeScript, zero framework dependencies. Works in any browser, on any app.

The CLI is a Bun-compiled binary that runs a proxy server between your browser and target app. It injects the overlay, handles annotation submissions via a session-token-authenticated API, and prints structured markdown to stdout for AI agents to consume.

## Development

```bash
npm install
npm run dev          # Dev server with sample app on port 3333
npm run build        # Build dist/promptotype.iife.js
npm run build:cli    # Build CLI binary for current platform
```

## License

ISC
