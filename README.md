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

Promptotype is distributed as a pure Node.js package — no platform binaries, no postinstall downloads, no Gatekeeper/signing issues on macOS. **Requires Node.js ≥ 22.**

There are three ways to use Promptotype, depending on your setup:

### Option A: Chrome Extension + MCP Server (recommended)

This is the full setup for continuous AI-assisted design iteration with Claude Code.

**1. Install the npm package**

```bash
npm install -g promptotype
```

This automatically:
- Installs the `/promptotype` slash command for Claude Code
- Registers the MCP server in Claude Code
- Auto-allows MCP tool permissions

The install is a single-file Node.js bundle (~850 KB) — no per-platform binaries.

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

### curl wrapper

```bash
curl -fsSL https://locusai.design/install.sh | bash
```

This is a thin wrapper that checks for Node ≥ 22 and runs `npm install -g promptotype` on your behalf — the result is identical to installing via npm directly.

### Manual MCP registration

If the MCP registration didn't run automatically (e.g. Claude Code wasn't on your `PATH` at install time):

```bash
claude mcp add promptotype -s user -- promptotype serve
```

## Updating

Starting in **v0.3.1**, `promptotype` checks for new versions automatically when you run it in an interactive terminal. A notice like this prints to stderr when a newer version is available:

```
╭──────────────────────────────────────╮
│                                      │
│   Update available 0.3.2 → 0.4.0     │
│   Run npm i -g promptotype to update │
│                                      │
╰──────────────────────────────────────╯
```

To update, run whichever of these fits your setup:

```bash
# Latest stable
npm install -g promptotype

# npm-native "update" alias (respects the range in your package.json)
npm update -g promptotype

# Pin to a specific version
npm install -g promptotype@0.3.2
```

Check your current version:

```bash
npm ls -g promptotype
```

### How the notifier behaves (the fine print)

- **First run after a new release may not show the box.** The check runs in a detached background process and caches the result for 24 hours. The box only appears once that cache has been written — typically on the second run after a new version drops, not the first.
- **Only shown on interactive TTYs.** If stderr isn't a terminal (CI, piped output, the MCP stdio channel Claude Code uses), the box is suppressed so it can't pollute logs or break the JSON-RPC stream.
- **Cached per user for 24h.** Location: `~/Library/Preferences/update-notifier-promptotype/` on macOS, `~/.config/update-notifier-promptotype/` on Linux.
- **Disable entirely:** set `NO_UPDATE_NOTIFIER=1` in your shell profile, or pass `--no-update-notifier`.
- **Upgrades from 0.2.x won't announce themselves.** The notifier ships inside the CLI, so 0.2.x users have to upgrade once manually to land on a version that can notify them going forward.

### Why upgrading from 0.2.x needs a one-time manual step

The 0.2.x install pointed the Claude Code MCP registration at a per-platform Bun binary that no longer exists. Since v0.3.2 the postinstall automatically re-registers the MCP server on every install, so the first `npm install -g promptotype` from an old version heals the registration for you. If you're on an even older version and the MCP server shows `✗ Failed to connect` in `claude mcp list`, run:

```bash
claude mcp remove promptotype -s user
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

The browser overlay is a single IIFE bundle (~89 KB, ~20 KB gzip) built with Vite. Vanilla TypeScript, zero framework dependencies. Works in any browser, on any app.

The CLI is a single Node.js ESM bundle (~850 KB) built with esbuild. Runs on any host with Node ≥ 22 — macOS, Linux, Windows, WSL. No platform binaries, no code signing, no postinstall downloads.

Two distribution modes:
- **Chrome Extension** -- injects overlay via Shadow DOM, sends annotations to MCP server
- **CLI Proxy** -- Node.js bundle that proxies your app and injects the overlay

The MCP server runs on port 4100 (HTTP for the extension, stdio for AI agents). The extension and MCP server communicate over localhost -- no external services, no cloud, all local.

## Development

```bash
npm install
npm run dev         # Vite dev server with sample app on port 3333
npm run build       # Build dist/promptotype.iife.js (overlay)
npm run build:cli   # Bundle dist/cli.mjs (CLI + MCP server)
npm run build:all   # Build both (runs automatically before npm publish)
npm run build:ext   # Build overlay + copy to extension/
npm run test:app    # Start mock app on localhost:3000
npm run test:proxy  # Run proxy against the mock app (via tsx)
```

Requires Node ≥ 22 for development too — the CLI uses the built-in WebSocket client and fetch.

## License

ISC
