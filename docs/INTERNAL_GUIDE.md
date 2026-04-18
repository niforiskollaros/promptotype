# Promptotype — Internal Guide

> Turn "this card needs more padding, make this button purple, change this heading to say X" into actual code changes, without writing a single ticket or screenshot annotation.

---

## The scenario

You're reviewing a build of an app. Something's off — the padding feels cramped, the heading is the wrong size, a button is the wrong shade of green. Normally you'd:

1. Take a screenshot
2. Draw arrows or open Figma
3. Write a ticket or Slack message describing what you want
4. Wait for an engineer to interpret and implement

**With Promptotype, you skip all four steps.** You click the element in the running app, edit it visually (change colors, font, spacing, classes — see the changes live), and submit. The AI assistant applies the exact change to the codebase.

You can annotate a dozen things in a row, review them like a PR, submit once, and the AI works through all of them.

---

## What you need

Before you start, make sure you have these three things. If you're missing any, the install won't work — so check them first.

| | |
|---|---|
| **Google Chrome** | Any recent version |
| **Node.js 22 or newer** | Download from [nodejs.org](https://nodejs.org/) — grab the "LTS" installer. Works on Mac and Windows. |
| **Claude Code** | The AI assistant. Open a terminal (Terminal on Mac, PowerShell on Windows) and run: `npm install -g @anthropic-ai/claude-code` |

> **On a locked-down work laptop?** If your IT policy blocks either the Node installer or Chrome Developer mode, ping Nikos — we'll find a workaround.

---

## Install (5 minutes, once)

### 1. Install the Promptotype command

Open a terminal and run:

```
npm install -g promptotype
```

You should see "added 1 package" within a few seconds. That's it — no configuration, no accounts, no keys.

### 2. Download the Chrome extension

Go to the [latest release page](https://github.com/niforiskollaros/promptotype/releases/latest) and download `promptotype-chrome-extension.zip` from the Assets section.

**Unzip it and put the folder somewhere permanent** (e.g. `Documents/promptotype-extension/`). Chrome needs the folder to stay in place — if you delete it or move it, the extension stops working.

### 3. Load the extension in Chrome

1. Open a new Chrome tab and go to `chrome://extensions/`
2. In the top-right corner, turn on **Developer mode**
3. Click **Load unpacked** (it appears on the top-left once Developer mode is on)
4. Select the folder you just unzipped
5. You'll see "Promptotype" appear in your extensions list

### 4. Pin the icon

Click the puzzle-piece icon in Chrome's toolbar, find Promptotype in the dropdown, and click the pin icon next to it. The Promptotype icon is now always visible.

### 5. Keep Developer mode on

When you restart Chrome, it may ask *"Do you want to disable unpacked extensions?"* — **click "Keep"**. Otherwise Promptotype gets disabled and you'll have to re-enable it every time. This prompt is Chrome's default behavior for any unpublished extension, not a problem with Promptotype.

---

## Using it

### Start a session

Open Claude Code (the terminal app or the CLI) and type:

```
/promptotype
```

The assistant will say something like *"Waiting for annotations..."* — that means it's listening.

### Annotate the UI

1. Open the web app you want to review (e.g. `http://localhost:3000`, or whatever URL your team uses)
2. Click the **Promptotype icon** in Chrome's toolbar → **Activate on Page**
3. Hover over any element — you'll see a highlight with padding and margin visualized
4. **Click the element** to open the editor:
   - Change the text, colors, font size, spacing
   - Toggle Tailwind classes (if your app uses Tailwind)
   - Type an instruction in the "What should change?" field
   - See your edits applied live
5. Click **Save** — a numbered pin appears on the element so you can see what you've already annotated
6. Repeat for as many elements as you want

### Submit

1. When you're done, click **Review & Submit** at the bottom of the page
2. You'll see a side panel showing before/after diffs for every annotation
3. Click **Submit to Agent** — Claude Code receives the list of changes and starts applying them
4. The overlay resets and you can keep annotating while Claude works. Each "Submit" kicks off another round.
5. When you're done for the session, press **`Cmd + Shift + D`** (Mac) or **`Ctrl + Shift + D`** (Windows) to close the overlay — Claude Code will stop listening.

### Tips for great annotations

- **Describe intent, not implementation.** "Make this feel less dense" is often more useful than "change padding from 8px to 16px" — the AI can interpret intent across a design system better than it can pick magic numbers.
- **Batch related changes.** If you're adjusting spacing across five cards, annotate all five before submitting. The AI can see the pattern and apply it consistently.
- **You don't have to edit visually.** Sometimes it's enough to click an element and just write a prompt like "this section needs a real empty state, something warmer." The AI has all the context it needs from the click alone.
- **Use the clipboard fallback if you're in a pinch.** If Claude Code isn't set up, you can still click **Copy to Clipboard** in the review panel and paste the structured markdown into ChatGPT, Claude.ai, or any other AI chat.

---

## If something isn't working

Try these in order. If none of them fix it, ping **Nikos** on Slack with a screenshot of what you're seeing.

### "The extension icon isn't doing anything"

Make sure the page you're on isn't a Chrome internal page (`chrome://...` or `chrome-extension://...`). Promptotype works on `localhost` and any real website. If you're on a staging URL, that's fine — it should still work.

### "I submitted but nothing happened in Claude Code"

Two things to check:

1. Did you type `/promptotype` in Claude Code *before* you submitted? The assistant needs to be in listening mode.
2. Click the Promptotype icon — the popup shows an **MCP Server** status. If it says **"Connected"** with a green dot, you're good. If it says **"Not running"**, the background service isn't up. Close and reopen Claude Code — it will restart it. If it still doesn't reconnect, restart Claude Code from the terminal (not from Spotlight/Start Menu) so it picks up your PATH.

### "Chrome is warning me about disabling unpacked extensions"

That's expected — click **Keep**. It's Chrome's default warning for any unpublished extension (which includes every internal tool at most companies).

### "I don't see the Developer mode toggle in Chrome"

Your work Chrome profile is managed by IT. You have two options:
- Use a personal Chrome profile (File → New Profile)
- Ask IT to allow unpacked extensions, or to add Promptotype to the approved list

### "Everything used to work, now the extension isn't loading"

The most common cause: the unzipped extension folder got moved or deleted. Re-download it, put it back in place, and click the refresh icon (↻) on the Promptotype card in `chrome://extensions/`.

---

## Keeping it up to date

Whenever a new version ships, both pieces need updating:

1. **The Promptotype command:** `npm install -g promptotype` — the terminal will nudge you with an "Update available" message when one is out
2. **The Chrome extension:** re-download the zip from the [latest release](https://github.com/niforiskollaros/promptotype/releases/latest), replace the contents of your folder, and click the refresh icon in `chrome://extensions/`

Both steps are a minute each. You don't have to do them simultaneously — an older extension will still work with a newer CLI, and vice versa.

---

## Who to ping

- **Something's broken or confusing:** Nikos on Slack (@n.kollaros)
- **A feature request:** same
- **A bug you can reproduce:** screenshot + URL + what you clicked, sent to Nikos — even better, file an issue at [github.com/niforiskollaros/promptotype/issues](https://github.com/niforiskollaros/promptotype/issues)
