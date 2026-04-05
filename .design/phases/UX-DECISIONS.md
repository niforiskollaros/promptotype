---
phase: ux
skill: dsp-ux
completed: 2026-04-05T13:00:00Z
context_loaded:
  - DISCOVERY.md
requirements_addressed:
  - REQ-01
  - REQ-02
  - REQ-03
  - REQ-04
  - REQ-05
  - REQ-06
  - REQ-07
  - REQ-08
  - REQ-09
  - REQ-10
  - REQ-11
  - REQ-12
  - REQ-13
  - REQ-14
components_specified:
  - ActivationToggle
  - ElementHighlightOverlay
  - DepthBreadcrumbBar
  - AnnotationPopover
  - PinMarkers
  - BottomStatusBar
  - ReviewSidePanel
---

# UX Decisions: Promptotype

## User Flow

```
[App running in browser]
       |
       v
[Activate] <-- Cmd+Shift+D or floating toggle button
       |
       v
+-- INSPECT MODE -----------------------------------------+
|                                                          |
|  Hover -> highlight overlay (blue border + margin/pad)   |
|  Alt+Scroll -> traverse depth (parent <-> child)         |
|  Breadcrumb bar shows: body > div.card > h2.title        |
|  Click -> select element, open annotation popover        |
|                                                          |
|  +-- ANNOTATION POPOVER ----------------------------+    |
|  | Element tag + class                              |    |
|  | Extracted: font, color, spacing, alignment       |    |
|  | Prompt: freeform textarea                        |    |
|  | Color suggestion: optional hex input             |    |
|  | [Cancel] [Save Annotation]                       |    |
|  +--------------------------------------------------+    |
|                                                          |
|  Saved -> numbered pin marker on element                 |
|  Continue selecting more elements...                     |
|                                                          |
|  Bottom bar: "3 annotations" [Review & Submit]           |
+----------------------------------------------------------+
       |
       v (Review & Submit)
+-- REVIEW MODE ------------------------------------------+
|                                                          |
|  Right side panel with all annotations listed            |
|  Each shows: element ID, properties, user prompt         |
|  Hover annotation -> highlights element on page          |
|  [Edit] reopens popover, [Delete] removes                |
|                                                          |
|  [Back to Inspect]  [Copy to Clipboard]                  |
+----------------------------------------------------------+
       |
       v (Copy to Clipboard)
[Structured markdown copied]
[Toast: "Copied 3 annotations - paste into your AI agent"]
[Tool deactivates]
```

## Usability Principles Applied

| Principle | Application | Rationale |
|-----------|-------------|-----------|
| Clarity | One action per mode: Inspect selects, Annotate captures, Review submits | No ambiguity about what clicking does in each mode |
| Cognitive Load | Properties shown as read-only summary, not editable fields | User only needs to write a prompt, not understand every CSS value |
| Feedback | Highlight on hover, pin on annotate, toast on copy | Every action has immediate visible feedback |
| Error Prevention | Empty prompt prevented from saving; Escape with annotations shows confirmation | Can't accidentally lose work or submit empty annotations |
| Consistency | Same popover for new + edit; same pin style throughout | Learn once, use everywhere |
| Progressive Disclosure | Basic flow is click+type+save; depth traversal and color input are optional | Power features don't clutter the simple path |

## Key UX Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Annotation input location | Side panel, Bottom bar, Inline popover | Inline popover | Keeps attention on the element. No context switch. Point at something, describe what to change right there. |
| Batch management | Counter in popover, Floating badge, Bottom bar | Bottom status bar | Always visible, doesn't obscure elements, persistent CTA. Like a shopping cart count. |
| Review screen | Full-page takeover, Modal, Side panel | Side panel (right) | User can still see the page. Clicking annotation highlights element. Maintains spatial context. |
| Annotated element indicator | Badge, Color change, Dot marker | Numbered pin markers | Small numbered circles (1, 2, 3) at top-right. Clear, scannable, shows order of annotations. |
| Depth traversal | DOM tree panel, Breadcrumb, Alt+scroll | Alt+Scroll + breadcrumb | Zero UI footprint for traversal. Breadcrumb shows context. No tree panel needed. |
| Activation | Always on, Toggle button, Shortcut | Shortcut + floating toggle | Cmd+Shift+D for power users. Floating button for discoverability. |
| Output format | JSON, Plain text, Markdown | Structured markdown | AI agents parse markdown naturally. Readable by humans too. |
| Popover positioning | Fixed position, Follow cursor, Near element | Smart near-element | Auto-adjusts to stay in viewport. Arrow points to selected element. |

## Component Behaviors

### 1. Activation Toggle

**Purpose:** Enter/exit inspect mode

**States:**
| State | Behavior | Visual Indicator |
|-------|----------|------------------|
| Default (off) | Tool inactive, app behaves normally | Small semi-transparent floating button bottom-left: "DA" monogram |
| Hover | Button becomes fully opaque | Tooltip: "Activate Promptotype (Cmd+Shift+D)" |
| Active (on) | Inspect mode enabled, cursor changes to crosshair | Button solid with accent color, subtle pulse. Faint overlay tint on page signals inspect mode |
| Has annotations | Shows annotation count | Badge with count on toggle button |

**Interactions:**
- Click: Toggle inspect mode on/off
- Keyboard: Cmd+Shift+D toggles
- Escape: Deactivates (confirmation if annotations exist)

### 2. Element Highlight Overlay

**Purpose:** Show which element is under cursor and its boundaries

**States:**
| State | Behavior | Visual Indicator |
|-------|----------|------------------|
| Default | No highlight | -- |
| Hover | Element highlighted | Blue semi-transparent overlay with border. Margin in orange, padding in green (Chrome DevTools style) |
| Depth traversal | Navigating parent/child | Highlight updates, breadcrumb shows path |
| Selected | Element locked, popover opens | Highlight becomes solid border (no fill) |
| Already annotated | Hovering annotated element | Purple accent highlight instead of blue |

**Interactions:**
- Mouse move: Highlight follows cursor
- Alt+Scroll Up: Select parent element
- Alt+Scroll Down: Select first child element
- Click: Select element, open annotation popover
- Click annotated element: Reopen existing annotation for editing

### 3. Depth Breadcrumb Bar

**Purpose:** Show current element position in DOM during inspection

**States:**
| State | Behavior | Visual Indicator |
|-------|----------|------------------|
| Default | Hidden when tool is off | -- |
| Active | Shows path of hovered element | Top bar: `body > div.app > main > div.card > h2.title` with current element bold |
| Depth change | User scrolls to change depth | Highlight shifts to new element in breadcrumb |

**Interactions:**
- Click any segment: Select that ancestor directly

### 4. Annotation Popover

**Purpose:** Show extracted properties and capture user prompt

**Layout:**
```
+-------------------------------------+
| h2.card-title                    X  |
|---------properties------------------|
| Font                                |
|  Inter . 14px . 600 . 1.5          |
|                                     |
| Color                               |
|  Text: # #333333  Bg: # #FFFFFF     |
|                                     |
| Spacing                             |
|  Margin: 0 0 8px 0                  |
|  Padding: 4px 8px 4px 8px          |
|                                     |
| Alignment                           |
|  text-align: left                   |
|---------prompt-----------------------|
| Your prompt:                        |
| +----------------------------------+|
| | Make this heading larger and     ||
| | bolder - it should dominate      ||
| | the card                         ||
| +----------------------------------+|
|                                     |
| Color suggestion: [#______] #       |
|                                     |
|        [Cancel]  [Save Annotation]  |
+-------------------------------------+
```

**States:**
| State | Behavior | Visual Indicator |
|-------|----------|------------------|
| Default | Shows extracted properties + empty prompt | Positioned near element, auto-adjusts |
| Typing | User writing prompt | Textarea active |
| Editing existing | Reopened annotation | Prompt pre-filled, button says "Update Annotation" |
| Saving | User clicks Save | Checkmark animation, popover closes, pin appears |
| Error | Extraction failed for property | Row shows "--" muted |
| Empty prompt | Save with no prompt | Gentle shake + "Add a prompt to describe what to change" |

**Interactions:**
- Escape: Close without saving
- Cmd+Enter: Save annotation
- Click outside: Close without saving
- Tab: Move between prompt and color input
- Click color swatch in properties: Pre-fills color suggestion

### 5. Pin Markers

**Purpose:** Indicate annotated elements on page

**States:**
| State | Behavior | Visual Indicator |
|-------|----------|------------------|
| Default | Shows on annotated element | Small numbered circle at top-right of element |
| Hover | Preview | Tooltip with first line of prompt |
| Click (inspect mode) | Reopen | Opens popover in edit mode |
| Review mode | Linked to panel | Pin pulses when annotation highlighted in review |

### 6. Bottom Status Bar

**Purpose:** Persistent batch status and primary CTA

**Layout:**
```
+-----------------------------------------------------------+
|  DA  |  3 annotations  |  Esc to exit  | [Review & Submit] |
+-----------------------------------------------------------+
```

**States:**
| State | Behavior | Visual Indicator |
|-------|----------|------------------|
| No annotations | Tool active indicator | "Promptotype active . Click elements to annotate . Esc to exit" |
| Has annotations | Count + CTA | "3 annotations . [Review & Submit]" - button prominent |
| Hover count | -- | Clickable, opens review panel |

**Interactions:**
- Click "Review & Submit": Opens review side panel
- Escape: Deactivates (confirmation if annotations exist)
- Click count: Opens review panel

### 7. Review Side Panel

**Purpose:** Review, edit, and submit all annotations

**Layout:**
```
+----------------------------------+
|  Review Annotations (3)       X  |
|----------------------------------|
|                                  |
|  (1) h2.card-title               |
|  Font: Inter 14px 600            |
|  Color: #333 on #FFF             |
|  "Make this heading larger       |
|   and bolder"                    |
|  [Edit] [Delete]                 |
|  ---                             |
|                                  |
|  (2) div.card                    |
|  Padding: 8px                    |
|  "Increase padding to 16px,     |
|   feels too cramped"             |
|  [Edit] [Delete]                 |
|  ---                             |
|                                  |
|  (3) button.primary              |
|  Font: Inter 12px 500            |
|  Color: #FFF on #0066FF          |
|  "Make button text 14px"         |
|  [Edit] [Delete]                 |
|                                  |
|----------------------------------|
|  [Back to Inspect]               |
|  [Copy to Clipboard]             |
+----------------------------------+
```

**States:**
| State | Behavior | Visual Indicator |
|-------|----------|------------------|
| Default | List of annotations | Side panel from right, page shifts left |
| Hover annotation | Highlights element on page | Element gets pulsing highlight |
| Empty | No annotations | "No annotations yet" + [Back to Inspect] |
| After copy | Confirmation | Button -> checkmark "Copied!" for 2s, toast appears |
| Deleting | Remove annotation | Slides out, pin removed, count updates |

**Interactions:**
- Click annotation card: Highlights element on page
- Edit: Closes panel, opens popover on element in edit mode
- Delete: Removes (with undo toast, 5 seconds)
- Copy to Clipboard: Generates markdown, copies, shows confirmation
- Back to Inspect: Closes panel
- Escape: Closes panel

## Output Format

Structured markdown copied to clipboard:

```markdown
## Design Annotations (3 elements)

### 1. h2.card-title
**Current styles:**
- Font: Inter, 14px, weight 600, line-height 1.5
- Color: #333333 (on background #FFFFFF)
- Margin: 0 0 8px 0
- Padding: 4px 8px

**Prompt:** Make this heading larger and bolder - it should dominate the card

---

### 2. div.card
**Current styles:**
- Padding: 8px 8px 8px 8px

**Prompt:** Increase padding to 16px, feels too cramped

---

### 3. button.primary
**Current styles:**
- Font: Inter, 12px, weight 500
- Color: #FFFFFF (on background #0066FF)

**Prompt:** Make button text 14px

**Suggested color:** #0052CC
```

## Accessibility Requirements

| Requirement | WCAG | Implementation |
|-------------|------|----------------|
| Keyboard navigation | 2.1.1 | Tab through popover fields; Cmd+Enter to save; Escape to close/deactivate |
| Focus visibility | 2.4.7 | Visible focus ring on all interactive elements in popover, panel, status bar |
| Color independence | 1.4.1 | Pin markers use numbers not just color; highlight uses border + fill |
| Label association | 1.3.1 | "Your prompt" label tied to textarea; "Color suggestion" label tied to input |
| Sufficient contrast | 1.4.3 | All overlay text meets 4.5:1 contrast ratio |
| Touch targets | 2.5.5 | All buttons minimum 44x44px tap area |

## Error Handling

| Error Scenario | User Message | Recovery Action |
|----------------|--------------|-----------------|
| Can't extract properties (SVG, canvas) | "Some properties couldn't be read" | Show what was extracted, allow prompt anyway |
| Shortcut conflicts with app | Toast: "Shortcut conflict - use toggle button" | Floating button always available |
| Clipboard write fails | "Couldn't copy - click to try again" | Show text in selectable modal as fallback |
| Element removed from DOM | "This element is no longer on the page" | Keep in list with warning badge, include in output |
| Escape with unsaved annotations | "You have 3 unsaved annotations. Exit anyway?" | [Keep Annotating] [Exit & Discard] |

## Empty States

| Empty State | What Shows | User Action |
|-------------|------------|-------------|
| Tool activated, no annotations | Bottom bar: "Click elements to annotate" | Start clicking |
| Review panel, no annotations | "No annotations yet" | [Back to Inspect] |
| Popover, extraction empty | Property shows "--" | Can still write prompt |

## Loading States

| Operation | Loading Indicator | Placement |
|-----------|-------------------|-----------|
| Property extraction | Skeleton lines in popover | Properties section |
| Clipboard copy | Button spinner | Copy button |

## Requirements Coverage

| Requirement | Addressed By | Notes |
|-------------|--------------|-------|
| REQ-01: Browser overlay with element selection | ElementHighlightOverlay + ActivationToggle | Hover+click with crosshair cursor |
| REQ-02: Dev-tools-style highlight | ElementHighlightOverlay | Blue border + margin/padding visualization |
| REQ-03: Nested element selection | Alt+Scroll + DepthBreadcrumbBar | Zero UI footprint depth traversal |
| REQ-04: Extract font properties | AnnotationPopover properties section | family, size, weight, line-height |
| REQ-05: Extract colors as hex | AnnotationPopover properties section | Text + background color |
| REQ-06: Extract spacing | AnnotationPopover properties section | Padding + margin values |
| REQ-07: Extract alignment | AnnotationPopover properties section | text-align value |
| REQ-08: Freeform prompt | AnnotationPopover textarea | With Cmd+Enter shortcut |
| REQ-09: Color input | AnnotationPopover color suggestion field | Hex input with swatch |
| REQ-10: Batch annotations | PinMarkers + BottomStatusBar | Numbered pins, running count |
| REQ-11: Review screen | ReviewSidePanel | All annotations listed with properties + prompts |
| REQ-12: Edit in review | ReviewSidePanel Edit button | Reopens popover on element |
| REQ-13: Structured output | Markdown generation | Element selector + current values + prompt |
| REQ-14: Copy to clipboard | ReviewSidePanel Copy button | With toast confirmation |

## Handoff Notes for UI Phase

- **Visual direction:** Should feel like a design tool (Figma inspector vibe), not browser DevTools. Clean, minimal, light surfaces, sharp typography.
- **Critical interactions:** Hover highlight must feel instant (<16ms). Popover positioning must be smart. Review panel slide-in smooth (200ms ease-out).
- **Color palette:** Use violet/purple accent - unlikely to clash with inspected app colors.
- **Typography:** System font stack for overlay UI.
- **Spacing:** 8px grid for all overlay components.
- **Open visual questions:** Popover arrow style, pin marker size, review panel width, transition animations.
