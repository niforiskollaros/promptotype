/**
 * Mock app server that simulates real dev server behavior.
 * Tests Promptotype proxy against common patterns that break naive proxies.
 *
 * Modes:
 *   --mode static     Simple static files (default)
 *   --mode nextjs     Simulates Next.js with basePath, chunked responses, CSP headers
 *
 * Usage: tsx test/mock-app/serve.ts [--port 3000] [--mode nextjs]
 */

import { resolve, join, extname } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { serveFetch } from '../../cli/node-adapter';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--port') || '3000', 10);
const mode = process.argv.find((_, i, a) => a[i - 1] === '--mode') || 'static';

const BASE_PATH = '/aibi';

async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

async function readText(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

async function readBytes(path: string): Promise<Buffer> {
  return readFile(path);
}

async function handleFetch(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let pathname = url.pathname;

  if (mode === 'nextjs') {
    if (pathname === '/') {
      return new Response(null, {
        status: 308,
        headers: { Location: BASE_PATH },
      });
    }

    if (pathname.startsWith(BASE_PATH)) {
      const stripped = pathname.slice(BASE_PATH.length) || '/';

      if (stripped === '/' || stripped === '') {
        let html = await readText(join(ROOT, 'index.html'));

        html = html.replace(/href="\//g, `href="${BASE_PATH}/`);
        html = html.replace(/src="\//g, `src="${BASE_PATH}/`);
        html = html.replace(/@import url\('\//g, `@import url('${BASE_PATH}/`);

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const half = Math.floor(html.length / 2);
            controller.enqueue(encoder.encode(html.slice(0, half)));
            controller.enqueue(encoder.encode(html.slice(half)));
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'Content-Security-Policy': "frame-ancestors 'none'",
          },
        });
      }

      const filePath = join(ROOT, stripped);
      if (!filePath.startsWith(ROOT)) {
        return new Response('Forbidden', { status: 403 });
      }

      if (!(await fileExists(filePath))) {
        return new Response('Not Found', { status: 404 });
      }

      const ext = extname(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      if (ext === '.css') {
        const cssContent = await readText(filePath);
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(cssContent));
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': contentType,
            'Transfer-Encoding': 'chunked',
            'Content-Security-Policy': "frame-ancestors 'none'",
          },
        });
      }

      const bytes = await readBytes(filePath);
      return new Response(bytes, {
        headers: {
          'Content-Type': contentType,
          'Content-Security-Policy': "frame-ancestors 'none'",
        },
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  // --- Static mode: simple file server ---
  if (pathname === '/') pathname = '/index.html';

  const filePath = join(ROOT, pathname);
  if (!filePath.startsWith(ROOT)) {
    return new Response('Forbidden', { status: 403 });
  }

  if (!(await fileExists(filePath))) {
    return new Response('Not Found', { status: 404 });
  }

  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const bytes = await readBytes(filePath);
  return new Response(bytes, {
    headers: { 'Content-Type': contentType },
  });
}

const result = await serveFetch({ port, fetch: handleFetch });
console.log(`Mock app running at http://localhost:${result.port} (mode: ${mode})`);
if (mode === 'nextjs') {
  console.log(`  basePath: ${BASE_PATH} — open http://localhost:${result.port}${BASE_PATH}`);
}
