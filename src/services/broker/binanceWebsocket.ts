// Browser-side websocket helper for public market streams (Binance).
// Auto-reconnect with exponential backoff. No keys needed for public streams.

export type StreamHandler<T = unknown> = (msg: T) => void;

export interface WsHandle {
  close(): void;
  isOpen(): boolean;
}

export function subscribeStream<T = unknown>(streamPath: string, handler: StreamHandler<T>): WsHandle {
  if (typeof window === "undefined") {
    return { close: () => undefined, isOpen: () => false };
  }
  let ws: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streamPath}`);
    ws.onopen = () => { attempt = 0; };
    ws.onmessage = (ev) => {
      try { handler(JSON.parse(ev.data) as T); } catch { /* noop */ }
    };
    ws.onclose = () => {
      if (closed) return;
      const delay = Math.min(30_000, 500 * 2 ** attempt++);
      reconnectTimer = setTimeout(connect, delay);
    };
    ws.onerror = () => ws?.close();
  };
  connect();

  return {
    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
    isOpen: () => ws?.readyState === WebSocket.OPEN,
  };
}
