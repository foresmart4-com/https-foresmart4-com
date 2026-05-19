// Real-time Intelligence Pipeline — debounced, event-driven recomputation
// triggered by websocket trades, with stale-data protection.
import { subscribeStream } from "@/services/broker/binanceWebsocket";

export type PipelineStatus = "connecting" | "live" | "degraded" | "stale" | "closed";

export interface PipelineHandle {
  close(): void;
  status(): PipelineStatus;
}

interface Options {
  /** Binance stream paths, e.g. ["btcusdt@trade", "ethusdt@trade"] */
  streams: string[];
  /** Called (debounced) when new data is ready for recompute. */
  onTick: (lastPrices: Record<string, number>) => void;
  /** Status changes for UI badges. */
  onStatus?: (s: PipelineStatus) => void;
  /** Coalesce window. Default 1500ms. */
  debounceMs?: number;
  /** Treat data older than this as stale (forces "stale" status). */
  staleAfterMs?: number;
}

interface TradeMsg { s?: string; p?: string }

export function startRealtimePipeline(opts: Options): PipelineHandle {
  const { streams, onTick, onStatus, debounceMs = 1500, staleAfterMs = 20_000 } = opts;
  const prices: Record<string, number> = {};
  let lastMessageAt = 0;
  let pending = false;
  let status: PipelineStatus = "connecting";
  let staleCheck: ReturnType<typeof setInterval> | null = null;
  let debounceT: ReturnType<typeof setTimeout> | null = null;
  let openCount = 0;

  const setStatus = (s: PipelineStatus) => {
    if (s === status) return;
    status = s;
    try { onStatus?.(s); } catch { /* noop */ }
  };

  const flush = () => {
    debounceT = null;
    if (!pending) return;
    pending = false;
    try { onTick({ ...prices }); } catch { /* noop */ }
  };

  const schedule = () => {
    pending = true;
    if (debounceT) return;
    debounceT = setTimeout(flush, debounceMs);
  };

  const handles = streams.map((path) =>
    subscribeStream<TradeMsg>(path, {
      onMessage: (msg) => {
        const sym = msg.s; const price = msg.p ? parseFloat(msg.p) : NaN;
        if (!sym || !isFinite(price)) return;
        prices[sym] = price;
        lastMessageAt = Date.now();
        if (status !== "live") setStatus("live");
        schedule();
      },
      onStatus: (s) => {
        if (s === "open") openCount++;
        else if (s === "degraded" || s === "closed") openCount = Math.max(0, openCount - 1);
        if (openCount === 0 && status !== "closed") setStatus("degraded");
      },
      throttleMs: 500, maxBatch: 200, staleAfterMs,
    }),
  );

  staleCheck = setInterval(() => {
    if (status === "closed") return;
    if (lastMessageAt && Date.now() - lastMessageAt > staleAfterMs) setStatus("stale");
  }, Math.max(2000, staleAfterMs / 3));

  return {
    close() {
      setStatus("closed");
      handles.forEach((h) => h.close());
      if (staleCheck) clearInterval(staleCheck);
      if (debounceT) clearTimeout(debounceT);
    },
    status: () => status,
  };
}
