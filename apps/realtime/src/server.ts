import { createServer, type Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { Connection, LiveHub, Scheduler } from './live-hub.ts';

/** Frames are small JSON commands; anything bigger is refused. */
const maxMessageBytes = 16 * 1024;
/** Keeps idle connections open through proxies. */
const pingEveryMs = 25_000;

export const timerScheduler: Scheduler = {
  schedule(ms, run) {
    const timer = setTimeout(run, ms);
    return () => {
      clearTimeout(timer);
    };
  },
};

/**
 * HTTP for the health check, and WebSockets on /live for the web app's pages only. Each socket's
 * messages are handled in order; the hub does the rest.
 */
export function createRealtimeServer(
  hub: LiveHub,
  options: { readonly allowedOrigin: string },
): Server {
  const server = createServer((request, response) => {
    const healthy = request.method === 'GET' && request.url === '/health';
    response.writeHead(healthy ? 200 : 404, { 'content-type': 'text/plain' });
    response.end(healthy ? 'ok' : 'not found');
  });
  const sockets = new WebSocketServer({
    server,
    path: '/live',
    maxPayload: maxMessageBytes,
    verifyClient: ({ origin }: { origin: string }) => origin === options.allowedOrigin,
  });

  sockets.on('connection', (socket) => {
    const connection: Connection = {
      send(message) {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
      },
      close() {
        socket.close();
      },
    };
    let queue = Promise.resolve();
    socket.on('message', (data: Buffer) => {
      queue = queue.then(() => hub.receive(connection, data.toString())).catch(() => undefined);
    });
    const ping = setInterval(() => {
      socket.ping();
    }, pingEveryMs);
    socket.on('close', () => {
      clearInterval(ping);
      hub.disconnect(connection);
    });
  });

  server.on('close', () => {
    sockets.close();
  });
  return server;
}
