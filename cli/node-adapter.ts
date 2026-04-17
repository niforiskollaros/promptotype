/**
 * Fetch-style HTTP server on top of node:http.
 *
 * Lets us keep `(req: Request) => Promise<Response>` handlers — the same shape
 * Bun.serve uses — while running on Node. Also handles port-retry on EADDRINUSE
 * and exposes the raw `upgrade` event for WebSocket handoff.
 */

import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import { Readable } from 'node:stream';
import type { Socket } from 'node:net';

export type FetchHandler = (req: Request) => Response | Promise<Response>;
export type UpgradeHandler = (req: IncomingMessage, socket: Socket, head: Buffer) => void;

export interface ServeOptions {
  port: number;
  fetch: FetchHandler;
  onUpgrade?: UpgradeHandler;
  portRetries?: number;
}

export interface ServeResult {
  server: Server;
  port: number;
  close: () => Promise<void>;
}

function toWebRequest(req: IncomingMessage): Request {
  const host = req.headers.host ?? 'localhost';
  const protocol = (req.socket as { encrypted?: boolean }).encrypted ? 'https' : 'http';
  const url = `${protocol}://${host}${req.url ?? '/'}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const method = req.method ?? 'GET';
  const hasBody = method !== 'GET' && method !== 'HEAD';

  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers,
  };

  if (hasBody) {
    init.body = Readable.toWeb(req) as unknown as BodyInit;
    init.duplex = 'half';
  }

  return new Request(url, init);
}

async function writeWebResponse(webRes: Response, serverRes: ServerResponse): Promise<void> {
  serverRes.statusCode = webRes.status;
  serverRes.statusMessage = webRes.statusText;

  // set-cookie can repeat — reconstruct as array if present.
  const getSetCookie = (webRes.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  const cookies = typeof getSetCookie === 'function' ? getSetCookie.call(webRes.headers) : [];
  if (cookies.length > 0) {
    serverRes.setHeader('set-cookie', cookies);
  }
  webRes.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    serverRes.setHeader(key, value);
  });

  if (!webRes.body) {
    serverRes.end();
    return;
  }

  const nodeStream = Readable.fromWeb(webRes.body as unknown as Parameters<typeof Readable.fromWeb>[0]);
  await new Promise<void>((resolve, reject) => {
    nodeStream.on('error', (err) => {
      serverRes.destroy(err);
      reject(err);
    });
    serverRes.on('error', (err) => reject(err));
    serverRes.on('close', () => resolve());
    serverRes.on('finish', () => resolve());
    nodeStream.pipe(serverRes);
  });
}

export async function serveFetch(options: ServeOptions): Promise<ServeResult> {
  const { fetch: handler, onUpgrade, portRetries = 10 } = options;
  const startPort = options.port;

  const server = createServer((req, res) => {
    (async () => {
      try {
        const webReq = toWebRequest(req);
        const webRes = await handler(webReq);
        await writeWebResponse(webRes, res);
      } catch (err) {
        if (!res.headersSent) {
          res.statusCode = 500;
        }
        if (!res.writableEnded) {
          res.end();
        }
        console.error('[serveFetch] handler error:', err);
      }
    })();
  });

  if (onUpgrade) {
    server.on('upgrade', onUpgrade);
  }

  const boundPort = await new Promise<number>((resolve, reject) => {
    let current = startPort;
    let attempts = 0;

    const onError = (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && attempts < portRetries) {
        attempts++;
        current++;
        // Retry on next tick so the failed listen fully settles.
        setImmediate(() => server.listen(current));
        return;
      }
      server.removeListener('error', onError);
      server.removeListener('listening', onListening);
      reject(err);
    };

    const onListening = () => {
      server.removeListener('error', onError);
      server.removeListener('listening', onListening);
      resolve(current);
    };

    server.on('error', onError);
    server.on('listening', onListening);
    server.listen(current);
  });

  return {
    server,
    port: boundPort,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
