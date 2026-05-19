// Browser-side websocket helper for public market streams (Binance).
//
// Production-grade features:
//   - Exponential backoff with full jitter and a hard ceiling
//   - Heartbeat / stale-connection detection (forces reconnect if silent)
//   - Message batching via requestAnimationFrame so React state updates
//     coalesce into a single render per frame (~16ms)
//   - Optional throttling window for high-frequency streams
//   - Status callback for graceful UI degradation when the socket drops
//   - Visibility / online awareness: pause backoff when offline or hidden,
//     reconnect immediately when the tab/network comes back

export type StreamHandler<T = unknown> = (msg: T) => void;
export type BatchHandler<T = unknown> = (batch: T[]) => void;
export type ConnectionStatus = "connecting" | "open" | "degraded" | "closed";
export type StatusHandler = (status: ConnectionStatus, info?: { attempt: number; reason?: string }) => void;

export interface SubscribeOptions<T> {
  /** Per-message callback (kept for back-compat). Called inside the batched frame. */
  onMessage?: StreamHandler<T>;
  /** Receives the full batch flushed for this frame. Prefer this for React state. */
  onBatch?: BatchHandler<T>;
  /** Minimum ms between flushes. Default 0 (one flush per animation frame). */
  throttleMs?: number;
  /** Max messages buffered between flushes (oldest are dropped). Default 500. */
  maxBatch?: number;
  /** Notified on connection lifecycle changes — wire this to UI degradation badges. */
  onStatus?: StatusHandler;
  /** Force reconnect if no message received within this window (ms). Default 30s. */
  staleAfterMs?: number;
}

export interface WsHandle {
  close(): void;
  isOpen(): boolean;
  status(): ConnectionStatus;
}

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 500;

export function subscribeStream<T = unknown>(
  streamPath: string,
  handlerOrOptions: StreamHandler<T> | SubscribeOptions<T>,
): WsHandle {
  if (typeof window === "undefined") {
    return { close: () => undefined, isOpen: () => false, status: () => "closed" };
  }

  const opts: SubscribeOptions<T> =
    typeof handlerOrOptions === "function" ? { onMessage: handlerOrOptions } : handlerOrOptions;

  const {
    onMessage,
    onBatch,
    throttleMs = 0,
    maxBatch = 500,
    onStatus,
    staleAfterMs = 30_000,
  } = opts;

  let ws: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let staleTimer: ReturnType<typeof setInterval> | null = null;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let rafHandle: number | null = null;

  let buffer: T[] = [];
  let lastFlush = 0;
  let lastMessageAt = 0;
  let currentStatus: ConnectionStatus = "connecting";

  const setStatus = (next: ConnectionStatus, reason?: string) => {
    if (next === currentStatus) return;
    currentStatus = next;
    try { onStatus?.(next, { attempt, reason }); } catch { /* noop */ }
  };

  const cancelFlush = () => {
    if (rafHandle != null) { cancelAnimationFrame(rafHandle); rafHandle = null; }
    if (flushTimer != null) { clearTimeout(flushTimer); flushTimer = null; }
  };

  const flush = () => {
    rafHandle = null;
    flushTimer = null;
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    lastFlush = Date.now();
    try { onBatch?.(batch); } catch { /* noop */ }
    if (onMessage) {
      for (const m of batch) { try { onMessage(m); } catch { /* noop */ } }
    }
  };

  const scheduleFlush = () => {
    if (rafHandle != null || flushTimer != null) return;
    const since = Date.now() - lastFlush;
    if (throttleMs > 0 && since < throttleMs) {
      flushTimer = setTimeout(flush, throttleMs - since);
    } else {
      rafHandle = requestAnimationFrame(flush);
    }
  };

  const scheduleReconnect = (reason: string) => {
    if (closed) return;
    setStatus("degraded", reason);
    // Don't burn retries while offline / tab hidden — wait for the wake-up listeners.
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

    const expo = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
    const delay = Math.floor(Math.random() * expo); // full jitter
    attempt++;
    reconnectTimer = setTimeout(connect, delay);
  };

  const checkStale = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (Date.now() - lastMessageAt > staleAfterMs) {
      try { ws.close(); } catch { /* noop */ }
    }
  };

  const connect = () => {
    if (closed) return;
    setStatus("connecting");
    try {
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streamPath}`);
    } catch (e) {
      scheduleReconnect((e as Error).message);
      return;
    }

    ws.onopen = () => {
      attempt = 0;
      lastMessageAt = Date.now();
      setStatus("open");
      if (staleTimer) clearInterval(staleTimer);
      staleTimer = setInterval(checkStale, Math.max(5_000, Math.floor(staleAfterMs / 2)));
    };

    ws.onmessage = (ev) => {
      lastMessageAt = Date.now();
      let parsed: T;
      try { parsed = JSON.parse(ev.data) as T; } catch { return; }
      buffer.push(parsed);
      if (buffer.length > maxBatch) buffer.splice(0, buffer.length - maxBatch); // drop oldest
      scheduleFlush();
    };

    ws.onerror = () => { try { ws?.close(); } catch { /* noop */ } };

    ws.onclose = (ev) => {
      if (staleTimer) { clearInterval(staleTimer); staleTimer = null; }
      if (closed) { setStatus("closed"); return; }
      scheduleReconnect(`close ${ev.code}`);
    };
  };

  // Wake-up listeners: reconnect immediately when network/tab returns.
  const onOnline = () => {
    if (closed) return;
    if (ws && ws.readyState === WebSocket.OPEN) return;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    attempt = 0;
    connect();
  };
  const onVisibility = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") onOnline();
  };
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisibility);

  connect();

  return {
    close() {
      closed = true;
      setStatus("closed");
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (staleTimer) clearInterval(staleTimer);
      cancelFlush();
      buffer = [];
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      try { ws?.close(); } catch { /* noop */ }
    },
    isOpen: () => ws?.readyState === WebSocket.OPEN,
    status: () => currentStatus,
  };
}
