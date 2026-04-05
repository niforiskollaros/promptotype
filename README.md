# DesignAnnotator

A browser overlay that lets you point at UI elements in a running app, see their computed design properties, write prompts, and send structured feedback to AI coding agents like Claude Code or Cursor.

**Think React Grab, but for design feedback.**

## The Problem

When reviewing a vibe-coded app, the typical workflow is: take a screenshot, paste it into an AI CLI, and describe what to change. This is slow, imprecise, and limited to one element at a time.

## How It Works

1. **Activate** — Press `Cmd+Shift+D` or click the floating DA button
2. **Inspect** — Hover over elements to see a highlight overlay with dimensions
3. **Select** — Click an element to see its computed font, color, spacing, and alignment
4. **Annotate** — Write a prompt describing what should change (e.g., "Make this heading larger and bolder")
5. **Batch** — Repeat for as many elements as you want — each gets a numbered pin marker
6. **Review** — Click "Review & Submit" to see all annotations in a side panel
7. **Copy** — Hit "Copy to Clipboard" to get structured markdown ready to paste into your AI agent

### What Gets Extracted

For each selected element:
- **Font** — family, size, weight, line-height
- **Color** — text color, background color (as hex)
- **Spacing** — padding, margin
- **Alignment** — text-align, display, align-items

### What the AI Agent Receives

```markdown
## Design Annotations (2 elements)

### 1. `h2.card-title`
**Current styles:**
- Font: Inter, 14px, weight 600, line-height 1.5
- Color: #333333 (on background #FFFFFF)
- Margin: 0 0 8px 0
- Padding: 4px 8px

**Prompt:** Make this heading larger and bolder — it should dominate the card

---

### 2. `div.sidebar`
**Current styles:**
- Padding: 8px 8px 8px 8px

**Prompt:** Increase padding to 16px, feels too cramped
```

## Key Features

- **Batch annotations** — Select multiple elements, review all at once, send in one go
- **Nested element selection** — `Alt+Scroll` to traverse depth (parent/child) without a DOM tree panel
- **Breadcrumb bar** — Shows the DOM path of the hovered element, click any segment to select it
- **Pin markers** — Numbered pins on annotated elements so you can see what you've covered
- **Zero dependencies** — Vanilla TypeScript, works in any browser, on any app

## Quick Start

```bash
# Install dependencies
npm install

# Start the dev server with a sample app
npm run dev

# Build the injectable script
npm run build
```

Then open `http://localhost:3333` and press `Cmd+Shift+D` to activate.

### Inject Into Any Running App

After building, add the script to any locally running app:

```html
<script src="path/to/dist/design-annotator.iife.js"></script>
```

Or use a bookmarklet (paste in browser console):

```js
const s = document.createElement('script');
s.src = 'http://localhost:3333/src/index.ts';
document.body.appendChild(s);
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+D` | Toggle DesignAnnotator on/off |
| `Alt+Scroll` | Traverse element depth (parent/child) |
| `Cmd+Enter` | Save annotation (in popover) |
| `Escape` | Close popover / close review panel / deactivate |

## Architecture

Single IIFE bundle (~35KB, ~8.5KB gzip) built with Vite. No framework dependencies.

```
src/
├── index.ts                 # Main orchestrator — mode management, event handling
├── types.ts                 # TypeScript interfaces (Annotation, ExtractedStyles)
├── extract-styles.ts        # getComputedStyle extraction + CSS selector generation
├── highlight-overlay.ts     # Element highlight overlay with dimensions label
├── breadcrumb-bar.ts        # DOM path breadcrumb bar (top of viewport)
├── annotation-popover.ts    # Properties display + prompt input + color suggestion
├── pin-markers.ts           # Numbered pin markers on annotated elements
├── status-bar.ts            # Bottom bar with annotation count + Review button
├── review-panel.ts          # Right side panel with annotation list + copy
└── output.ts                # Markdown generation + clipboard API
```

## Roadmap

- [ ] Spacing and typography scale detection
- [ ] Component detection (React, Vue, etc.)
- [ ] Design token mapping
- [ ] Direct pipe to Claude Code sessions
- [ ] Screenshot capture per annotation
- [ ] Figma comparison mode

## License

ISC
