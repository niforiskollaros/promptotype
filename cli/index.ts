/**
 * Promptotype CLI
 *
 * Usage:
 *   promptotype [url] [--port <port>] [--no-open] [--timeout <seconds>] [--json]
 *   promptotype serve [--port <port>]    # Start MCP server for extension
 *
 * If no URL is provided, scans common dev server ports and auto-connects.
 *
 * Examples:
 *   promptotype                              # Auto-detect running dev server
 *   promptotype http://localhost:3000         # Explicit URL
 *   promptotype http://localhost:5173 --port 4000
 *   promptotype serve                        # Start MCP server (port 4100)
 *   promptotype serve --port 4200            # Custom MCP port
 */

import { spawn } from 'node:child_process';
import updateNotifier from 'update-notifier';
import { startProxyServer } from './server';
import { startMcpServer } from './mcp-server';
import pkg from '../package.json';

// --- Common dev server ports to scan ---
const COMMON_PORTS = [
  3000, 3001, 3333, 4173, 4200, 5173, 5174, 8000, 8080, 8888,
];

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

// Check help first — must exit before any async work
const helpFlag = getFlag('help') || getFlag('h') || args.includes('-h');
if (args.includes('-h')) args.splice(args.indexOf('-h'), 1);

if (helpFlag) {
  const bin = 'promptotype';
  console.log(`
  Promptotype — Annotate UI elements, send structured feedback to AI agents

  Usage:
    ${bin} [url] [options]

  If no URL is provided, auto-detects running dev servers on common ports.

  Commands:
    ${bin} [url]                 Proxy mode (default) — inject overlay via HTTP proxy
    ${bin} serve                 MCP server — for Chrome extension + AI agents

  Options:
    --port <port>      Proxy port (default: 4000) or MCP port (default: 4100)
    --no-open          Don't auto-open the browser
    --timeout <secs>   Auto-exit after N seconds (default: no timeout)
    --json             Output JSON instead of markdown
    --help, -h         Show this help

  Examples:
    ${bin}                                  # Auto-detect dev server
    ${bin} http://localhost:3000            # Explicit URL
    ${bin} http://localhost:5173 --port 4000
    ${bin} serve                            # Start MCP server on port 4100
    ${bin} serve --port 4200                # Custom MCP port
  `);
  process.exit(0);
}

const noOpen = getFlag('no-open');
const jsonOutput = getFlag('json');
const port = parseInt(getOption('port', '4000'), 10);
const timeout = parseInt(getOption('timeout', '0'), 10); // 0 = no timeout

// --- Check for updates (async, once per 24h, writes to stderr only) ---
// Deferred notify doesn't fire in the MCP server mode (never exits cleanly),
// so we invoke immediately. stderr is always safe: MCP JSON-RPC uses stdout.
updateNotifier({
  pkg: { name: pkg.name, version: pkg.version },
  updateCheckInterval: 1000 * 60 * 60 * 24,
  shouldNotifyInNpmScript: false,
}).notify({
  defer: false,
  isGlobal: true,
  message:
    'Update available {currentVersion} → {latestVersion}\n' +
    'Run {updateCommand} to update.',
});

// Remaining arg is the target URL (optional now)
const targetUrlArg = args[0];

// --- MCP Server mode ---
if (targetUrlArg === 'serve') {
  // Use 4100 as default for serve mode (port var defaults to 4000 for proxy)
  const mcpPort = port === 4000 ? 4100 : port;
  await startMcpServer({ port: mcpPort });
  // Keep process alive — MCP server runs indefinitely
  await new Promise(() => {}); // never resolves
}

// --- Auto-detect dev servers ---
async function scanPort(p: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 500);
    const res = await fetch(`http://localhost:${p}`, {
      signal: controller.signal,
      redirect: 'manual',
    });
    clearTimeout(id);
    // Any response (even redirects) means something is running
    return true;
  } catch {
    return false;
  }
}

async function detectServers(): Promise<string[]> {
  console.error(`\x1b[35m▸\x1b[0m Scanning for dev servers...`);
  const results = await Promise.all(
    COMMON_PORTS.map(async (p) => ({ port: p, alive: await scanPort(p) }))
  );
  return results.filter(r => r.alive).map(r => `http://localhost:${r.port}`);
}

async function pickServer(servers: string[]): Promise<string> {
  console.error(`\x1b[35m▸\x1b[0m Found ${servers.length} dev server${servers.length !== 1 ? 's' : ''}:\n`);
  servers.forEach((s, i) => {
    console.error(`  \x1b[1m${i + 1}.\x1b[0m ${s}`);
  });
  console.error('');

  // Read from stdin
  process.stderr.write(`\x1b[35m▸\x1b[0m Which one? (1): `);

  const choice = await new Promise<string>((resolve) => {
    let data = '';
    process.stdin.setRawMode?.(false);
    process.stdin.resume();
    process.stdin.once('data', (chunk) => {
      data = chunk.toString().trim();
      process.stdin.pause();
      resolve(data);
    });
  });

  const index = (choice === '' ? 1 : parseInt(choice, 10)) - 1;
  if (index < 0 || index >= servers.length || isNaN(index)) {
    console.error(`\x1b[31m▸ Invalid choice\x1b[0m`);
    process.exit(1);
  }
  return servers[index];
}

// --- Resolve target URL ---
let resolvedUrl: string;

if (targetUrlArg) {
  // Explicit URL provided
  try {
    new URL(targetUrlArg);
    resolvedUrl = targetUrlArg;
  } catch {
    // Maybe they just passed a port number like "3000"
    const asPort = parseInt(targetUrlArg, 10);
    if (!isNaN(asPort) && asPort > 0 && asPort < 65536) {
      resolvedUrl = `http://localhost:${asPort}`;
    } else {
      console.error(`\x1b[31m▸ Invalid URL or port:\x1b[0m "${targetUrlArg}"`);
      console.error('  Provide a full URL (http://localhost:3000) or just a port number (3000)');
      process.exit(1);
    }
  }
} else {
  // Auto-detect
  const servers = await detectServers();

  if (servers.length === 0) {
    console.error(`\x1b[31m▸ No dev servers found\x1b[0m on ports: ${COMMON_PORTS.join(', ')}`);
    console.error('  Start your dev server first, or provide a URL explicitly.');
    process.exit(1);
  } else if (servers.length === 1) {
    resolvedUrl = servers[0];
    console.error(`\x1b[35m▸\x1b[0m Auto-detected: \x1b[1m${resolvedUrl}\x1b[0m\n`);
  } else {
    resolvedUrl = await pickServer(servers);
  }
}

const parsedUrl = new URL(resolvedUrl);

// --- Start proxy ---
let resolveAnnotations: ((markdown: string) => void) | null = null;
const annotationsPromise = new Promise<string>((resolve) => {
  resolveAnnotations = resolve;
});

const proxy = await startProxyServer({
  targetUrl: parsedUrl.toString(),
  port,
  onAnnotations: (markdown) => {
    resolveAnnotations?.(markdown);
  },
});
const proxyUrl = proxy.url;

// Stderr for diagnostics (stdout is reserved for the annotation output)
console.error(`\x1b[35m▸ Promptotype\x1b[0m proxy running at \x1b[1m${proxyUrl}\x1b[0m`);
console.error(`\x1b[35m▸\x1b[0m Proxying → ${parsedUrl.toString()}`);
console.error(`\x1b[35m▸\x1b[0m Waiting for annotations... (Cmd+Shift+D to activate overlay)\n`);

// --- Open browser ---
if (!noOpen) {
  const { platform } = process;
  const openCmd =
    platform === 'darwin' ? 'open' :
    platform === 'win32' ? 'start' :
    'xdg-open';

  // `start` on Windows is a cmd.exe builtin; shell: true covers that case.
  const child = spawn(openCmd, [proxyUrl], {
    stdio: 'ignore',
    detached: true,
    shell: platform === 'win32',
  });
  child.on('error', () => { /* no browser, no problem */ });
  child.unref();
}

// --- Timeout ---
let timeoutId: ReturnType<typeof setTimeout> | undefined;
if (timeout > 0) {
  timeoutId = setTimeout(() => {
    console.error(`\n\x1b[33m▸ Timeout reached (${timeout}s) — exiting without annotations\x1b[0m`);
    proxy.close().finally(() => process.exit(1));
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
await proxy.close();
process.exit(0);
