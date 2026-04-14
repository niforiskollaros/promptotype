# Promptotype

Point at UI elements in a running app, edit them visually, and send structured feedback to AI coding agents.

## The Problem

When reviewing a vibe-coded app, the typical workflow is: take a screenshot, paste it into an AI CLI, and describe what to change. This is slow, imprecise, and limited to one element at a time.

Promptotype replaces that with point-and-click annotations that include real computed styles, live visual editing, batch multiple elements, and output structured markdown that AI agents can act on immediately.

## How It Works

1. **Inspect** -- Hover elements to see highlights with box model visualization. Use `Alt+Scroll` to traverse depth (parent/child).
2. **Annotate** -- Click an element to open an editable popover: change text, pick colors, adjust font/spacing, toggle Tailwind classes -- all with live preview.
3. **Batch** -- Repeat for as many elements as you want. Each gets a numbered pin marker.
4. **Review** -- Click "Review & Submit" to see before/after diffs in a side panel.
5. **Submit** -- Send structured markdown to your AI agent, or copy to clipboard.

## Installation

There are three ways to use Promptotype, depending on your setup:

### Option A: Chrome Extension + MCP Server (recommended)

This is the full setup for continuous AI-assisted design iteration with Claude Code.

**1. Install the npm package**

```bash
npm install -g promptotype
```

This automatically:
- Downloads the correct platform binary
- Installs the `/promptotype` slash command for Claude Code
- Registers the MCP server in Claude Code
- Auto-allows MCP tool permissions

**2. Load the Chrome extension**

The extension is not yet on the Chrome Web Store. To install manually:

1. Clone or download this repo
2. Build the extension: `npm run build:ext`
3. Open `chrome://extensions/` in Chrome
4. Enable **Developer mode** (top-right toggle)
5. Click **Load unpacked** and select the `extension/` directory

**3. Start using it**

```bash
# In Claude Code, run the slash command:
/promptotype
```

The agent starts listening for annotations. Click the extension icon on any `localhost` page, activate the overlay, annotate elements, and submit. Annotations flow directly to the agent, which applies changes and waits for the next batch. This loop continues until you deactivate the overlay.

### Option B: CLI Proxy (no extension needed)

If you can't install the Chrome extension, the CLI proxy injects the overlay via an HTTP proxy:

```bash
# Auto-detect a running dev server
promptotype

# Explicit URL
promptotype http://localhost:3000

# From Claude Code
/promptotype http://localhost:3000
```

The proxy wraps your running app, injects the overlay, and prints structured markdown to stdout when you submit annotations.

### Option C: Standalone (no AI agent)

Use the Chrome extension without Claude Code. Annotations are copied to clipboard instead of sent to an agent -- paste them into any AI tool (ChatGPT, Claude.ai, Cursor, etc.).

1. Load the Chrome extension (see Option A, step 2)
2. Click the extension icon on any `localhost` page
3. Activate the overlay, annotate elements
4. Click "Review & Submit" then **Copy to Clipboard**

## Alternative Install Methods

### curl (binary only, no MCP)

```bash
curl -fsSL https://raw.githubusercontent.com/niforiskollaros/promptotype/main/install.sh | bash
```

Installs the binary to `~/.local/bin/promptotype` and registers slash commands for Claude Code, Codex, and Gemini CLI.

### Manual MCP registration

If you installed via curl or the MCP registration didn't run automatically:

```bash
claude mcp add promptotype -s user -- promptotype serve
```

## Usage with Claude Code

### Continuous mode (extension + MCP)

```bash
/promptotype
```

The agent calls `wait_for_annotations()`, blocks until you submit from the browser, applies changes, then waits again. The loop continues until you close the overlay (`Cmd+Shift+D`).

### One-shot mode (CLI proxy)

```bash
/promptotype http://localhost:3000
```

The proxy opens your app with the overlay injected. Submit annotations once, the agent receives them and the proxy exits.

## What Gets Captured

For each annotated element:

- **CSS selector** -- unique selector path for the element
- **Source location** -- file:line from React Fiber `_debugSource` (React < 19)
- **Text content** -- direct text from the element
- **Computed styles** -- font, color, spacing, alignment (as hex)
- **CSS classes** -- full class list, with Tailwind categorization when detected
- **Visual edits** -- any changes you made in the popover (text, colors, font, spacing, classes)
- **Before/after diffs** -- explicit diffs for all edits
- **Screenshot** -- captured per annotation (extension only)
- **Prompt** -- optional freeform instructions

### Example output

```markdown
## Design Annotations (2 elements)

### 1. `h2.card-title`
**Source:** src/components/Card.tsx:24
**Current styles:**
- Font: Inter, 14px, weight 600, line-height 1.5
- Color: #333333 (on background #FFFFFF)
- Margin: 0 0 8px 0
- Padding: 4px 8px
**Classes:** text-sm font-semibold mb-2

**Changes:**
- Font size: 14px -> 18px
- Font weight: 600 -> 700

**Prompt:** Make this heading larger and bolder -- it should dominate the card

---

### 2. `div.sidebar`
**Current styles:**
- Padding: 8px 8px 8px 8px

**Prompt:** Increase padding to 16px, feels too cramped
```

## CLI Reference

```
promptotype [url] [options]

Commands:
  promptotype [url]          Proxy mode -- inject overlay via HTTP proxy
  promptotype serve          MCP server -- for Chrome extension + AI agents

Options:
  --port <port>      Proxy port (default: 4000) or MCP port (default: 4100)
  --no-open          Don't auto-open the browser
  --timeout <secs>   Auto-exit after N seconds
  --json             Output JSON instead of markdown
  --help, -h         Show this help

Examples:
  promptotype                              # Auto-detect dev server
  promptotype http://localhost:3000        # Explicit URL
  promptotype 3000                         # Shorthand for localhost:3000
  promptotype serve                        # Start MCP server on port 4100
  promptotype serve --port 4200            # Custom MCP port
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+D` | Toggle overlay on/off |
| `Alt+Scroll` | Traverse element depth (parent/child) |
| `Cmd+Enter` | Save annotation (in popover) |
| `Escape` | Close popover / close review panel / deactivate |

## How It's Built

Single IIFE bundle (~89KB, ~20KB gzip) built with Vite. Vanilla TypeScript, zero framework dependencies. Works in any browser, on any app.

Two distribution modes:
- **Chrome Extension** -- injects overlay via Shadow DOM, sends annotations to MCP server
- **CLI Proxy** -- Bun-compiled binary that proxies your app and injects the overlay

The MCP server runs on port 4100 (HTTP for the extension, stdio for AI agents). The extension and MCP server communicate over localhost -- no external services, no cloud, all local.

## Development

```bash
npm install
npm run dev            # Dev server with sample app on port 3333
npm run build          # Build dist/promptotype.iife.js
npm run build:ext      # Build overlay + copy to extension/
npm run build:cli      # Build CLI binary for current platform
npm run build:cli:all  # Build for all 4 platforms
```

## License

ISC
