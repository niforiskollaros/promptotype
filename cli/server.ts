/**
 * Proxy server that sits between the browser and the target app.
 * - Forwards all HTTP requests to the target
 * - Injects the Promptotype overlay into HTML responses
 * - Serves the overlay JS from memory at /__pt__/overlay.js
 * - Handles WebSocket forwarding for HMR (hot module replacement)
 * - Exposes POST /__pt__/api/annotations for the overlay to submit
 */

// Embed the overlay IIFE at build time — Bun resolves this import as a text string
// @ts-ignore — Bun-specific import attribute
import OVERLAY_JS from '../dist/promptotype.iife.js' with { type: 'text' };

export interface ProxyServerOptions {
  targetUrl: string;
  port: number;
  onAnnotations: (markdown: string) => void;
}

export function startProxyServer(options: ProxyServerOptions): {
  server: ReturnType<typeof Bun.serve>;
  url: string;
} {
  const { targetUrl, port, onAnnotations } = options;
  const target = new URL(targetUrl);

  // Generate an unguessable session token to authenticate overlay submissions
  const sessionToken = crypto.randomUUID();

  // Bootstrap served as a separate JS file (not inline) for CSP compatibility
  const BOOTSTRAP_JS = `window.__PT_PROXY__=true;window.__PT_PROXY_ORIGIN__=location.origin;window.__PT_SESSION_TOKEN__="${sessionToken}";`;

  // Script tags injected before </body> — both are external, no inline scripts
  const INJECT_TAG = `<script src="/__pt__/overlay.js"></script>\n<script src="/__pt__/bootstrap.js"></script>`;

  const server = Bun.serve({
    port,

    async fetch(req, server) {
      const url = new URL(req.url);

      // --- WebSocket upgrade for HMR ---
      if (req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
        const targetWsUrl = `${target.protocol === 'https:' ? 'wss:' : 'ws:'}//${target.host}${url.pathname}${url.search}`;
        const success = server.upgrade(req, {
          data: { targetWsUrl },
        });
        if (success) return undefined;
        // If upgrade fails, fall through to proxy as normal HTTP
      }

      // --- Serve overlay JS from memory ---
      if (url.pathname === '/__pt__/overlay.js') {
        return new Response(OVERLAY_JS, {
          headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
        });
      }

      // --- Serve bootstrap JS (CSP-safe, no inline scripts) ---
      if (url.pathname === '/__pt__/bootstrap.js') {
        return new Response(BOOTSTRAP_JS, {
          headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
        });
      }

      // --- Health check (used by overlay to detect proxy mode) ---
      if (url.pathname === '/__pt__/health') {
        return new Response(JSON.stringify({ status: 'ok', proxy: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // --- Annotations API (requires session token) ---
      if (url.pathname === '/__pt__/api/annotations' && req.method === 'POST') {
        try {
          const body = await req.json();

          // Validate session token to prevent forged submissions
          if (body.token !== sessionToken) {
            return new Response(JSON.stringify({ error: 'Invalid session token' }), {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          const markdown = body.markdown as string;
          if (!markdown) {
            return new Response(JSON.stringify({ error: 'Missing markdown field' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          onAnnotations(markdown);
          return new Response(JSON.stringify({ status: 'received' }), {
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      // --- Proxy all other requests to the target ---
      const proxyUrl = `${target.origin}${url.pathname}${url.search}`;

      // Forward headers, skip host (let it match the target)
      const headers = new Headers(req.headers);
      headers.set('host', target.host);
      headers.delete('accept-encoding'); // Get uncompressed response so we can inject

      try {
        const proxyRes = await fetch(proxyUrl, {
          method: req.method,
          headers,
          body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
          redirect: 'manual',
        });

        // Rewrite absolute Location headers so redirects stay on the proxy
        const location = proxyRes.headers.get('location');
        if (location && proxyRes.status >= 300 && proxyRes.status < 400) {
          try {
            const locUrl = new URL(location, target.origin);
            if (locUrl.origin === target.origin) {
              const rewritten = `${locUrl.pathname}${locUrl.search}${locUrl.hash}`;
              const redirHeaders = new Headers(proxyRes.headers);
              redirHeaders.set('location', rewritten);
              return new Response(proxyRes.body, {
                status: proxyRes.status,
                statusText: proxyRes.statusText,
                headers: redirHeaders,
              });
            }
          } catch {
            // Malformed URL — pass through as-is
          }
        }

        const contentType = proxyRes.headers.get('content-type') || '';
        const isHtml = contentType.includes('text/html');

        if (isHtml) {
          // Inject overlay script into HTML
          let html = await proxyRes.text();

          // Inject before </body> if present, otherwise append
          if (html.includes('</body>')) {
            html = html.replace('</body>', `${INJECT_TAG}</body>`);
          } else if (html.includes('</html>')) {
            html = html.replace('</html>', `${INJECT_TAG}</html>`);
          } else {
            html += INJECT_TAG;
          }

          // Build response headers, skip problematic ones and CSP (we inject scripts)
          const resHeaders = new Headers();
          for (const [key, value] of proxyRes.headers.entries()) {
            const lower = key.toLowerCase();
            if (lower === 'content-encoding' || lower === 'content-length' || lower === 'transfer-encoding') continue;
            if (lower === 'content-security-policy' || lower === 'content-security-policy-report-only') continue;
            resHeaders.set(key, value);
          }

          // Prevent browser from caching proxied HTML — ensures switching targets
          // on the same port always shows the current project, not a stale one
          resHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');
          resHeaders.set('Pragma', 'no-cache');
          resHeaders.set('Expires', '0');

          return new Response(html, {
            status: proxyRes.status,
            statusText: proxyRes.statusText,
            headers: resHeaders,
          });
        }

        // Non-HTML: pass through body, but strip hop-by-hop headers.
        // Bun's fetch() de-chunks the body stream but keeps the original
        // transfer-encoding/content-encoding headers — forwarding those causes
        // the browser to try to decode an already-decoded body, breaking CSS/JS.
        const passHeaders = new Headers();
        for (const [key, value] of proxyRes.headers.entries()) {
          const lower = key.toLowerCase();
          if (lower === 'transfer-encoding' || lower === 'content-encoding' || lower === 'content-length') continue;
          if (lower === 'connection' || lower === 'keep-alive') continue;
          passHeaders.set(key, value);
        }

        return new Response(proxyRes.body, {
          status: proxyRes.status,
          statusText: proxyRes.statusText,
          headers: passHeaders,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        return new Response(
          `<html><body style="font-family:system-ui;padding:40px;background:#161618;color:#f0f0f2;">
            <h2 style="color:#ef4444;">Proxy Error</h2>
            <p>Could not reach <code>${proxyUrl}</code></p>
            <p style="color:#a1a1aa;">${msg}</p>
            <p style="margin-top:20px;font-size:14px;color:#71717a;">Make sure your app is running at <strong>${targetUrl}</strong></p>
          </body></html>`,
          { status: 502, headers: { 'Content-Type': 'text/html' } },
        );
      }
    },

    // --- WebSocket handler for HMR forwarding ---
    websocket: {
      open(ws) {
        const { targetWsUrl } = ws.data as { targetWsUrl: string };
        const upstream = new WebSocket(targetWsUrl);

        upstream.onmessage = (event) => {
          ws.send(typeof event.data === 'string' ? event.data : new Uint8Array(event.data as ArrayBuffer));
        };

        upstream.onclose = () => ws.close();
        upstream.onerror = () => ws.close();

        // Store upstream reference for forwarding client messages
        (ws as any)._upstream = upstream;
      },
      message(ws, message) {
        const upstream = (ws as any)._upstream as WebSocket | undefined;
        if (upstream?.readyState === WebSocket.OPEN) {
          upstream.send(message);
        }
      },
      close(ws) {
        const upstream = (ws as any)._upstream as WebSocket | undefined;
        if (upstream?.readyState === WebSocket.OPEN) {
          upstream.close();
        }
      },
    },
  });

  const serverUrl = `http://localhost:${server.port}`;
  return { server, url: serverUrl };
}
