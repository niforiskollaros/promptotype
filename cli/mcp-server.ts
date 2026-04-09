/**
 * Promptotype MCP Server
 *
 * Dual-interface server:
 * 1. HTTP endpoint on localhost for the Chrome extension to POST annotations
 * 2. MCP stdio interface for AI agents to consume annotations
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

  function receiveBatch(markdown: string): void {
    currentBatch = markdown;
    batchTimestamp = Date.now();

    // Count annotations from markdown
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
      console.error(`\x1b[35m▸\x1b[0m Stored — agent can call get_annotations() to retrieve`);
    }
  }

  // --- HTTP fetch handler (shared across port attempts) ---
  async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // Health check — extension uses this to detect if MCP server is running
    if (url.pathname === '/__pt__/health') {
      return new Response(JSON.stringify({ status: 'ok', mcp: true }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
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

        return new Response(JSON.stringify({ status: 'received' }), {
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
      break; // Success
    } catch (e: any) {
      if (e?.code === 'EADDRINUSE') {
        actualPort++;
        continue;
      }
      throw e; // Unexpected error
    }
  }

  if (!httpServer) {
    console.error(`\x1b[31m▸ Could not find an open port (tried ${port}-${actualPort})\x1b[0m`);
    process.exit(1);
  }

  // --- MCP Server (stdio) for AI agents ---
  const mcp = new McpServer({
    name: 'promptotype',
    version: '0.2.0',
  });

  // Tool: get_annotations — non-blocking, returns latest batch
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

  // Tool: wait_for_annotations — blocks until user submits
  mcp.tool(
    'wait_for_annotations',
    'Wait for the user to submit design annotations from the Promptotype browser extension. Blocks until annotations are received or timeout is reached. Use this when the user says to wait for their annotations or when they are about to annotate.',
    {
      timeout_seconds: z.number().optional().default(300).describe('Maximum seconds to wait (default: 300)'),
    },
    async ({ timeout_seconds }) => {
      // If there's already a batch waiting, return it immediately
      if (currentBatch) {
        const batch = currentBatch;
        currentBatch = null;
        batchTimestamp = null;
        return {
          content: [{ type: 'text' as const, text: batch }],
        };
      }

      // Wait for a submission
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

        return {
          content: [{ type: 'text' as const, text: markdown }],
        };
      } catch {
        return {
          content: [{
            type: 'text' as const,
            text: `Timed out after ${timeout_seconds}s waiting for annotations. The user may not have submitted yet.`,
          }],
        };
      }
    },
  );

  // Connect MCP to stdio
  const transport = new StdioServerTransport();
  mcp.connect(transport);

  // Log to stderr (stdout is reserved for MCP protocol)
  console.error(`\x1b[35m▸ Promptotype MCP\x1b[0m server running`);
  console.error(`\x1b[35m▸\x1b[0m Extension endpoint: http://localhost:${httpServer.port}/__pt__/api/annotations`);
  console.error(`\x1b[35m▸\x1b[0m MCP stdio ready — agents can call get_annotations() or wait_for_annotations()`);

  return { httpServer, mcp, transport };
}
