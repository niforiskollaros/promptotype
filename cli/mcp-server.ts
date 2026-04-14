/**
 * Promptotype MCP Server
 *
 * Dual-interface server:
 * 1. HTTP endpoint on localhost for the Chrome extension to POST annotations
 * 2. MCP stdio interface for AI agents to consume annotations
 *
 * When annotations arrive from the extension, the server:
 * - Resolves any pending wait_for_annotations() calls (instant delivery)
 * - Attempts MCP sampling to push annotations directly to the agent
 * - Sends a log notification as a fallback signal
 * - Stores the batch for get_annotations() retrieval
 *
 * Usage:
 *   promptotype serve [--port 4100]
 *
 * Agent configuration:
 *   claude mcp add promptotype -- promptotype serve
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

export interface McpServerOptions {
  port: number;
}

export function startMcpServer(options: McpServerOptions) {
  const { port } = options;

  // --- Annotation state ---
  let currentBatch: string | null = null;
  let batchTimestamp: number | null = null;
  let waitResolvers: Array<(markdown: string) => void> = [];
  let mcpConnected = false;
  const CLOSE_SIGNAL = '__PT_SESSION_CLOSED__';

  function signalClose(): void {
    console.error(`\x1b[33m▸\x1b[0m Session closed by user — stopping continuous mode`);
    // Resolve pending waiters with the close signal
    for (const resolve of waitResolvers) {
      resolve(CLOSE_SIGNAL);
    }
    waitResolvers = [];
    currentBatch = null;
    batchTimestamp = null;
  }

  // --- MCP Server (stdio) for AI agents ---
  const mcp = new McpServer(
    {
      name: 'promptotype',
      version: '0.2.4',
    },
    {
      capabilities: {
        logging: {},
      },
    },
  );

  async function pushToAgent(markdown: string): Promise<void> {
    if (!mcpConnected) return;

    const count = (markdown.match(/^### \d+\./gm) || []).length;

    // 1. Send log notification — surfaces in agent UI
    try {
      await mcp.server.sendLoggingMessage({
        level: 'info',
        logger: 'promptotype',
        data: `New design annotations received (${count} element${count !== 1 ? 's' : ''}). Use get_annotations() to retrieve and apply them.`,
      });
      console.error(`\x1b[35m▸\x1b[0m Sent log notification to agent`);
    } catch (e) {
      console.error(`\x1b[33m▸\x1b[0m Log notification failed: ${e instanceof Error ? e.message : e}`);
    }

    // 2. Try MCP sampling — ask the agent to apply the annotations directly
    try {
      await mcp.server.createMessage({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Design annotations just arrived from the Promptotype browser extension. Please apply these changes to the codebase:\n\n${markdown}`,
            },
          },
        ],
        includeContext: 'thisServer',
        maxTokens: 8192,
      });
      console.error(`\x1b[32m▸\x1b[0m Sampling request sent — agent should apply changes`);
    } catch (e) {
      // Sampling not supported by this client — that's OK, fall back to manual
      console.error(`\x1b[33m▸\x1b[0m Sampling not available (${e instanceof Error ? e.message : 'unsupported'}) — agent can use get_annotations()`);
    }
  }

  function receiveBatch(markdown: string): void {
    currentBatch = markdown;
    batchTimestamp = Date.now();

    const count = (markdown.match(/^### \d+\./gm) || []).length;
    console.error(`\x1b[32m▸ Received ${count} annotation${count !== 1 ? 's' : ''}\x1b[0m from extension`);

    // Resolve any pending wait_for_annotations calls
    const hadWaiters = waitResolvers.length > 0;
    for (const resolve of waitResolvers) {
      resolve(markdown);
    }
    waitResolvers = [];

    if (hadWaiters) {
      console.error(`\x1b[35m▸\x1b[0m Delivered to waiting agent`);
    } else {
      // No one is waiting — try to push proactively
      pushToAgent(markdown);
    }
  }

  // --- HTTP fetch handler ---
  async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === '/__pt__/health') {
      return new Response(JSON.stringify({ status: 'ok', mcp: true, connected: mcpConnected }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Close signal from extension — ends continuous mode
    if (url.pathname === '/__pt__/api/close' && req.method === 'POST') {
      signalClose();
      return new Response(JSON.stringify({ status: 'closed' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Wait endpoint — blocks until annotations arrive (used by slash command)
    if (url.pathname === '/__pt__/api/wait' && req.method === 'GET') {
      // If there's already a batch, return it immediately
      if (currentBatch) {
        const batch = currentBatch;
        currentBatch = null;
        batchTimestamp = null;
        return new Response(batch, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // Block until annotations arrive (timeout: 5 min)
      const timeoutParam = url.searchParams.get('timeout');
      const timeout = timeoutParam ? parseInt(timeoutParam, 10) * 1000 : 300_000;

      try {
        const markdown = await Promise.race([
          new Promise<string>((resolve) => {
            waitResolvers.push(resolve);
          }),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), timeout);
          }),
        ]);
        if (markdown === CLOSE_SIGNAL) {
          return new Response('__PT_SESSION_CLOSED__', {
            headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
          });
        }
        return new Response(markdown, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
        });
      } catch {
        return new Response('Timed out waiting for annotations.', {
          status: 408,
          headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }

    // Annotation submission from extension
    if (url.pathname === '/__pt__/api/annotations' && req.method === 'POST') {
      try {
        const body = await req.json();
        const markdown = body.markdown as string;
        if (!markdown) {
          return new Response(JSON.stringify({ error: 'Missing markdown field' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }

        receiveBatch(markdown);

        return new Response(JSON.stringify({ status: 'received', pushed: mcpConnected }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  }

  // --- Start HTTP server with port retry ---
  let httpServer: ReturnType<typeof Bun.serve> | null = null;
  let actualPort = port;

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      httpServer = Bun.serve({ port: actualPort, fetch: handleRequest });
      break;
    } catch (e: any) {
      if (e?.code === 'EADDRINUSE') {
        actualPort++;
        continue;
      }
      throw e;
    }
  }

  if (!httpServer) {
    console.error(`\x1b[31m▸ Could not find an open port (tried ${port}-${actualPort})\x1b[0m`);
    process.exit(1);
  }

  // --- MCP Tools ---

  // get_annotations — non-blocking, returns latest batch
  mcp.tool(
    'get_annotations',
    'Get the latest design annotations submitted from the Promptotype browser extension. Returns structured markdown with CSS selectors, computed styles, and user prompts for each annotated UI element. Use this when the user says to check, apply, or review their design annotations.',
    {},
    async () => {
      if (!currentBatch) {
        return {
          content: [{
            type: 'text' as const,
            text: 'No annotations pending. Ask the user to annotate elements in their browser using the Promptotype extension, then try again.',
          }],
        };
      }

      const batch = currentBatch;
      const age = batchTimestamp ? Math.round((Date.now() - batchTimestamp) / 1000) : 0;

      // Clear after reading
      currentBatch = null;
      batchTimestamp = null;

      return {
        content: [{
          type: 'text' as const,
          text: `${batch}\n\n---\n_Received ${age}s ago_`,
        }],
      };
    },
  );

  // wait_for_annotations — blocks until user submits
  mcp.tool(
    'wait_for_annotations',
    'Wait for the user to submit design annotations from the Promptotype browser extension. Blocks until annotations are received or timeout is reached. Use this when the user says to wait for their annotations or when they are about to annotate.',
    {
      timeout_seconds: z.number().optional().default(300).describe('Maximum seconds to wait (default: 300)'),
    },
    async ({ timeout_seconds }) => {
      if (currentBatch) {
        const batch = currentBatch;
        currentBatch = null;
        batchTimestamp = null;
        return {
          content: [{ type: 'text' as const, text: batch }],
        };
      }

      const timeout = (timeout_seconds ?? 300) * 1000;
      try {
        const markdown = await Promise.race([
          new Promise<string>((resolve) => {
            waitResolvers.push(resolve);
          }),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), timeout);
          }),
        ]);

        if (markdown === CLOSE_SIGNAL) {
          return {
            content: [{
              type: 'text' as const,
              text: 'The user has closed the Promptotype overlay. The annotation session has ended. Do not call wait_for_annotations again.',
            }],
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: `${markdown}\n\n---\n_Apply these changes, then call wait_for_annotations again to receive the next batch._`,
          }],
        };
      } catch {
        return {
          content: [{
            type: 'text' as const,
            text: `Timed out after ${timeout_seconds}s waiting for annotations. The user may not have submitted yet. You can call wait_for_annotations again to keep waiting.`,
          }],
        };
      }
    },
  );

  // --- Connect MCP to stdio ---
  const transport = new StdioServerTransport();
  mcp.connect(transport).then(() => {
    mcpConnected = true;
    console.error(`\x1b[32m▸\x1b[0m MCP connected to agent`);
  });

  // Log to stderr (stdout is reserved for MCP protocol)
  console.error(`\x1b[35m▸ Promptotype MCP\x1b[0m server running`);
  console.error(`\x1b[35m▸\x1b[0m Extension endpoint: http://localhost:${httpServer.port}/__pt__/api/annotations`);
  console.error(`\x1b[35m▸\x1b[0m MCP stdio ready — waiting for agent connection...`);

  return { httpServer, mcp, transport };
}
