'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveView } from '@thp/application';

/** What the realtime server sends (see apps/realtime). */
type ServerMessage =
  | { readonly type: 'view'; readonly view: LiveView }
  | { readonly type: 'error'; readonly code: string };

export type SocketState = 'connecting' | 'open' | 'closed';

const maxRetryMs = 8000;

/**
 * Connects to the live session with a ticket (sent in the first message, never in the URL),
 * keeps the latest view, and reconnects with back-off until the ticket is refused.
 */
export function useLiveSocket(realtimeUrl: string, ticket: string) {
  const [view, setView] = useState<LiveView | null>(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const [state, setState] = useState<SocketState>('connecting');
  const [error, setError] = useState<string | null>(null);
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    let stopped = false;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      const ws = new WebSocket(`${realtimeUrl.replace(/^http/u, 'ws')}/live`);
      socket.current = ws;
      ws.onopen = () => {
        attempt = 0;
        setState('open');
        ws.send(JSON.stringify({ type: 'hello', ticket }));
      };
      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        if (message.type === 'view') {
          setView(message.view);
          setReceivedAt(Date.now());
          setError(null);
          return;
        }
        setError(message.code);
        if (message.code === 'unauthenticated') stopped = true;
      };
      ws.onclose = () => {
        setState('closed');
        if (stopped) return;
        retry = setTimeout(connect, Math.min(maxRetryMs, 500 * 2 ** attempt));
        attempt += 1;
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      socket.current?.close();
    };
  }, [realtimeUrl, ticket]);

  const send = useCallback((message: Readonly<Record<string, unknown>>) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(message));
  }, []);

  return { view, receivedAt, state, error, send };
}

/** Whole seconds left on the question, counting down between views. */
export function useCountdown(view: LiveView | null, receivedAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (view?.status !== 'question') return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => {
      clearInterval(timer);
    };
  }, [view]);
  if (view?.status !== 'question') return 0;
  return Math.max(0, Math.ceil((view.timeLeftMs - (now - receivedAt)) / 1000));
}
