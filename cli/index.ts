#!/usr/bin/env bun
/**
 * DesignAnnotator CLI
 *
 * Usage:
 *   design-annotator <url> [--port <port>] [--no-open] [--timeout <seconds>] [--json]
 *
 * Examples:
 *   design-annotator http://localhost:3000
 *   design-annotator http://localhost:5173 --port 4000
 *   design-annotator http://localhost:3000 --no-open --timeout 600
 */

import { startProxyServer } from './server';

// --- Parse arguments ---
const args = process.argv.slice(2);

function getFlag(name: string): boolean {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1) {
    args.splice(idx, 1);
    return true;
  }
  return false;
}

function getOption(name: string, defaultValue: string): string {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < args.length) {
    const value = args[idx + 1];
    args.splice(idx, 2);
    return value;
  }
  return defaultValue;
}

const noOpen = getFlag('no-open');
const jsonOutput = getFlag('json');
const helpFlag = getFlag('help') || getFlag('h');
const port = parseInt(getOption('port', '4000'), 10);
const timeout = parseInt(getOption('timeout', '0'), 10); // 0 = no timeout

// Remaining arg is the target URL
const targetUrl = args[0];

if (helpFlag || !targetUrl) {
  const bin = 'design-annotator';
  console.error(`
  DesignAnnotator — Annotate UI elements, send structured feedback to AI agents

  Usage:
    ${bin} <url> [options]

  Options:
    --port <port>      Proxy server port (default: 4000)
    --no-open          Don't auto-open the browser
    --timeout <secs>   Auto-exit after N seconds (default: no timeout)
    --json             Output JSON instead of markdown
    --help, -h         Show this help

  Examples:
    ${bin} http://localhost:3000
    ${bin} http://localhost:5173 --port 4000
    ${bin} http://localhost:3000 --no-open --timeout 300
  `);
  process.exit(helpFlag ? 0 : 1);
}

// Validate URL
let parsedUrl: URL;
try {
  parsedUrl = new URL(targetUrl);
} catch {
  console.error(`Error: Invalid URL "${targetUrl}"`);
  console.error('Provide a full URL like http://localhost:3000');
  process.exit(1);
}

// --- Start proxy ---
let resolveAnnotations: ((markdown: string) => void) | null = null;
const annotationsPromise = new Promise<string>((resolve) => {
  resolveAnnotations = resolve;
});

const { server, url: proxyUrl } = startProxyServer({
  targetUrl: parsedUrl.toString(),
  port,
  onAnnotations: (markdown) => {
    resolveAnnotations?.(markdown);
  },
});

// Stderr for diagnostics (stdout is reserved for the annotation output)
console.error(`\x1b[35m▸ DesignAnnotator\x1b[0m proxy running at \x1b[1m${proxyUrl}\x1b[0m`);
console.error(`\x1b[35m▸\x1b[0m Proxying → ${parsedUrl.toString()}`);
console.error(`\x1b[35m▸\x1b[0m Waiting for annotations... (Cmd+Shift+D to activate overlay)\n`);

// --- Open browser ---
if (!noOpen) {
  const { platform } = process;
  const openCmd =
    platform === 'darwin' ? 'open' :
    platform === 'win32' ? 'start' :
    'xdg-open';

  Bun.spawn([openCmd, proxyUrl], { stdout: 'ignore', stderr: 'ignore' });
}

// --- Timeout ---
let timeoutId: ReturnType<typeof setTimeout> | undefined;
if (timeout > 0) {
  timeoutId = setTimeout(() => {
    console.error(`\n\x1b[33m▸ Timeout reached (${timeout}s) — exiting without annotations\x1b[0m`);
    server.stop();
    process.exit(1);
  }, timeout * 1000);
}

// --- Wait for annotations, print to stdout, exit ---
const markdown = await annotationsPromise;

if (timeoutId) clearTimeout(timeoutId);

if (jsonOutput) {
  // Wrap markdown in a JSON envelope
  const output = JSON.stringify({ annotations: markdown, timestamp: new Date().toISOString() });
  process.stdout.write(output + '\n');
} else {
  process.stdout.write(markdown + '\n');
}

console.error(`\n\x1b[32m▸ Annotations received!\x1b[0m Shutting down proxy.`);

// Brief delay so the HTTP response reaches the browser before we exit
await new Promise(resolve => setTimeout(resolve, 500));
server.stop();
process.exit(0);
