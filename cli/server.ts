/**
 * Proxy server that sits between the browser and the target app.
 * - Forwards all HTTP requests to the target
 * - Injects the Promptotype overlay into HTML responses
 * - Serves the overlay JS from memory at /__pt__/overlay.js
 * - Handles WebSocket forwarding for HMR (hot module replacement)
 * - Exposes POST /__pt__/api/annotations for the overlay to submit
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { serveFetch, type ServeResult } from './node-adapter';

// Resolve the overlay bundle. When running the built bundle it sits next to it
// in dist/; in source/dev mode it's one level up. Try both.
function loadOverlay(): string {
  const candidates = [
    new URL('./promptotype.iife.js', import.meta.url),
    new URL('../dist/promptotype.iife.js', import.meta.url),
  ];
  for (const c of candidates) {
    try {
      return readFileSync(fileURLToPath(c), 'utf8');
    } catch {
      // try next
    }
  }
  throw new Error(
    'Could not locate promptotype.iife.js. Run `npm run build` to produce the overlay bundle first.',
  );
}

const OVERLAY_JS = loadOverlay();

export interface ProxyServerOptions {
  targetUrl: string;
  port: number;
  onAnnotations: (markdown: string) => void;
}

export interface ProxyServerResult extends ServeResult {
  url: string;
}

export async function startProxyServer(options: ProxyServerOptions): Promise<ProxyServerResult> {
  const { targetUrl, port, onAnnotations } = options;
  const target = new URL(targetUrl);

  // Generate an unguessable session token to authenticate overlay submissions
  const sessionToken = crypto.randomUUID();

  // Bootstrap served as a separate JS file (not inline) for CSP compatibility
  const BOOTSTRAP_JS = `window.__PT_PROXY__=true;window.__PT_PROXY_ORIGIN__=location.origin;window.__PT_SESSION_TOKEN__="${sessionToken}";`;

  // Script tags injected before </body> — both are external, no inline scripts
  const INJECT_TAG = `<script src="/__pt__/overlay.js"></script>\n<script src="/__pt__/bootstrap.js"></script>`;

  // --- WebSocket proxy for HMR ---
  // Server-side upgrades handled by `ws`; upstream connection uses Node 22+'s
  // built-in WebSocket global so we don't need a separate client library.
  const wss = new WebSocketServer({ noServer: true });

  async function handleFetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

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
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // --- Proxy all other requests to the target ---
    const proxyUrl = `${target.origin}${url.pathname}${url.search}`;

    const headers = new Headers(req.headers);
    headers.set('host', target.host);
    headers.delete('accept-encoding'); // Get uncompressed response so we can inject

    try {
      const proxyRes = await fetch(proxyUrl, {
        method: req.method,
        headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
        redirect: 'manual',
        // @ts-expect-error — undici accepts duplex when body is a stream
        duplex: req.method !== 'GET' && req.method !== 'HEAD' && req.body ? 'half' : undefined,
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
        let html = await proxyRes.text();

        if (html.includes('</body>')) {
          html = html.replace('</body>', `${INJECT_TAG}</body>`);
        } else if (html.includes('</html>')) {
          html = html.replace('</html>', `${INJECT_TAG}</html>`);
        } else {
          html += INJECT_TAG;
        }

        const resHeaders = new Headers();
        for (const [key, value] of proxyRes.headers.entries()) {
          const lower = key.toLowerCase();
          if (lower === 'content-encoding' || lower === 'content-length' || lower === 'transfer-encoding') continue;
          if (lower === 'content-security-policy' || lower === 'content-security-policy-report-only') continue;
          resHeaders.set(key, value);
        }

        resHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        resHeaders.set('Pragma', 'no-cache');
        resHeaders.set('Expires', '0');

        return new Response(html, {
          status: proxyRes.status,
          statusText: proxyRes.statusText,
          headers: resHeaders,
        });
      }

      // Non-HTML: pass through body, strip hop-by-hop + encoding headers
      // (undici already decoded the body, keeping those would break the browser).
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
  }

  const result = await serveFetch({
    port,
    fetch: handleFetch,
    onUpgrade: (req, socket, head) => {
      // Only handle actual WebSocket upgrades; let other upgrades fall through.
      if ((req.headers.upgrade || '').toLowerCase() !== 'websocket') {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (clientWs) => {
        const pathname = req.url ?? '/';
        const targetWsUrl = `${target.protocol === 'https:' ? 'wss:' : 'ws:'}//${target.host}${pathname}`;

        // Preserve the subprotocol the client asked for so Vite HMR et al. see the right one.
        const requestedProtocols = (req.headers['sec-websocket-protocol'] ?? '')
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean);

        let upstream: WebSocket;
        try {
          upstream = requestedProtocols.length > 0
            ? new WebSocket(targetWsUrl, requestedProtocols)
            : new WebSocket(targetWsUrl);
        } catch (err) {
          console.error('[proxy ws] failed to open upstream:', err);
          clientWs.close(1011, 'Upstream WebSocket failed to open');
          return;
        }

        upstream.binaryType = 'arraybuffer';

        // Client may send frames before upstream's handshake completes.
        // Queue anything that arrives before OPEN, then flush on 'open'.
        const pending: Array<string | Buffer> = [];
        let upstreamOpen = false;

        const sendToUpstream = (frame: string | Buffer) => {
          if (upstreamOpen) {
            upstream.send(frame);
          } else {
            pending.push(frame);
          }
        };

        upstream.addEventListener('open', () => {
          upstreamOpen = true;
          for (const frame of pending) upstream.send(frame);
          pending.length = 0;
        });

        upstream.addEventListener('message', (event) => {
          const data = event.data;
          if (typeof data === 'string') {
            clientWs.send(data);
          } else if (data instanceof ArrayBuffer) {
            clientWs.send(Buffer.from(data));
          } else {
            clientWs.send(data as Buffer);
          }
        });
        // 1005/1006 are reserved and can't be sent in a close frame — normalize.
        const sanitizeCode = (code: number | undefined): number | undefined => {
          if (typeof code !== 'number') return undefined;
          if (code === 1005 || code === 1006) return undefined;
          if (code < 1000 || code > 4999) return 1000;
          return code;
        };

        upstream.addEventListener('close', (ev) => {
          const c = sanitizeCode(ev.code);
          if (c === undefined) clientWs.close();
          else clientWs.close(c, ev.reason);
        });
        upstream.addEventListener('error', () => clientWs.close(1011, 'Upstream error'));

        clientWs.on('message', (data, isBinary) => {
          if (isBinary) {
            const buf = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer);
            sendToUpstream(buf);
          } else {
            const str = Array.isArray(data)
              ? Buffer.concat(data).toString('utf8')
              : Buffer.isBuffer(data)
                ? data.toString('utf8')
                : Buffer.from(data as ArrayBuffer).toString('utf8');
            sendToUpstream(str);
          }
        });
        clientWs.on('close', (code, reason) => {
          if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
            const c = sanitizeCode(code);
            if (c === undefined) upstream.close();
            else upstream.close(c, reason.toString('utf8'));
          }
        });
        clientWs.on('error', () => {
          if (upstream.readyState === WebSocket.OPEN) upstream.close();
        });
      });
    },
  });

  const url = `http://localhost:${result.port}`;
  return { ...result, url };
}
