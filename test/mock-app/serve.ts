/**
 * Mock app server that simulates real dev server behavior.
 * Tests Promptotype proxy against common patterns that break naive proxies.
 *
 * Modes:
 *   --mode static     Simple static files (default)
 *   --mode nextjs     Simulates Next.js with basePath, chunked responses, CSP headers
 *
 * Usage: bun test/mock-app/serve.ts [--port 3000] [--mode nextjs]
 */

import { resolve, join, extname } from 'path';

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

const ROOT = resolve(import.meta.dir);
const port = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--port') || '3000', 10);
const mode = process.argv.find((_, i, a) => a[i - 1] === '--mode') || 'static';

// Next.js-like basePath simulation
const BASE_PATH = '/aibi';

function serveStatic(pathname: string, headers?: Record<string, string>) {
  return async () => {
    const filePath = join(ROOT, pathname);

    if (!filePath.startsWith(ROOT)) {
      return new Response('Forbidden', { status: 403 });
    }

    const file = Bun.file(filePath);
    const exists = await file.exists();

    if (!exists) {
      return new Response('Not Found', { status: 404 });
    }

    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    return new Response(file, {
      headers: { 'Content-Type': contentType, ...headers },
    });
  };
}

const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    if (mode === 'nextjs') {
      // --- Next.js mode: basePath + chunked + CSP ---

      // Root → redirect to basePath (like Next.js does)
      if (pathname === '/') {
        return new Response(null, {
          status: 308,
          headers: { 'Location': BASE_PATH },
        });
      }

      // Strip basePath for file lookup
      if (pathname.startsWith(BASE_PATH)) {
        const stripped = pathname.slice(BASE_PATH.length) || '/';

        // Serve index for basePath root
        if (stripped === '/' || stripped === '') {
          const file = Bun.file(join(ROOT, 'index.html'));
          let html = await file.text();

          // Rewrite asset paths to include basePath (like Next.js does)
          html = html.replace(/href="\//g, `href="${BASE_PATH}/`);
          html = html.replace(/src="\//g, `src="${BASE_PATH}/`);
          html = html.replace(/@import url\('\//g, `@import url('${BASE_PATH}/`);

          // Stream the response in chunks (simulates chunked transfer-encoding)
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            start(controller) {
              // Send HTML in chunks to simulate streaming SSR
              const chunk1 = html.slice(0, Math.floor(html.length / 2));
              const chunk2 = html.slice(Math.floor(html.length / 2));
              controller.enqueue(encoder.encode(chunk1));
              controller.enqueue(encoder.encode(chunk2));
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

        // Serve static files under basePath
        const filePath = join(ROOT, stripped);
        if (!filePath.startsWith(ROOT)) {
          return new Response('Forbidden', { status: 403 });
        }

        const file = Bun.file(filePath);
        const exists = await file.exists();
        if (!exists) {
          return new Response('Not Found', { status: 404 });
        }

        const ext = extname(filePath);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        // Simulate chunked CSS delivery (like Turbopack)
        if (ext === '.css') {
          const cssContent = await file.text();
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

        return new Response(file, {
          headers: {
            'Content-Type': contentType,
            'Content-Security-Policy': "frame-ancestors 'none'",
          },
        });
      }

      // Anything outside basePath → 404
      return new Response('Not Found', { status: 404 });

    } else {
      // --- Static mode: simple file server ---
      if (pathname === '/') pathname = '/index.html';

      const filePath = join(ROOT, pathname);
      if (!filePath.startsWith(ROOT)) {
        return new Response('Forbidden', { status: 403 });
      }

      const file = Bun.file(filePath);
      const exists = await file.exists();
      if (!exists) {
        return new Response('Not Found', { status: 404 });
      }

      const ext = extname(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      return new Response(file, {
        headers: { 'Content-Type': contentType },
      });
    }
  },
});

console.log(`Mock app running at http://localhost:${server.port} (mode: ${mode})`);
if (mode === 'nextjs') {
  console.log(`  basePath: ${BASE_PATH} — open http://localhost:${server.port}${BASE_PATH}`);
}
