#!/usr/bin/env node
/**
 * Smoke test: verify WebSocket proxy forwards messages bidirectionally.
 *
 * 1. Start an upstream WS echo server on a random port.
 * 2. Start the proxy targeting it.
 * 3. Connect a client THROUGH the proxy.
 * 4. Send a message, expect echo back.
 */

import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { startProxyServer } from '../cli/server.ts';

const upstreamHttp = createServer();
const upstreamWss = new WebSocketServer({ server: upstreamHttp });
upstreamWss.on('connection', (ws) => {
  // Echo, preserving the text/binary flag (ws hands us a Buffer either way).
  ws.on('message', (data, isBinary) => ws.send(data, { binary: isBinary }));
});
await new Promise((r) => upstreamHttp.listen(0, r));
const upstreamPort = upstreamHttp.address().port;
console.log(`upstream ws server on :${upstreamPort}`);

const proxy = await startProxyServer({
  targetUrl: `http://localhost:${upstreamPort}`,
  port: 4500,
  onAnnotations: () => {},
});
console.log(`proxy on ${proxy.url}`);

const client = new WebSocket(proxy.url.replace('http://', 'ws://'));

const received = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('timeout waiting for echo')), 3000);
  client.addEventListener('open', () => {
    console.log('client connected through proxy');
    client.send('hello');
  });
  client.addEventListener('message', (ev) => {
    clearTimeout(timer);
    resolve(ev.data);
  });
  client.addEventListener('error', (err) => {
    clearTimeout(timer);
    reject(err);
  });
});

console.log(`✓ received echo: "${received}"`);

if (received !== 'hello') {
  console.error('FAIL: echo mismatch');
  process.exit(1);
}

client.close();
await proxy.close();
upstreamWss.close();
await new Promise((r) => upstreamHttp.close(r));
console.log('✓ WS proxy smoke test passed');
process.exit(0);
