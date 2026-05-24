// Streaming orchestrator — runs polling/websocket simulators, manages failover,
// merges realtime + historical, and pushes fused output onto the bus.
// In production, replace the simulator hooks with real WS/REST clients.

import { fusionBus } from "./eventBus";
import { PROVIDERS, providersFor } from "./providers";
import {
  recordTick, recordError, snapshotHealth, scanStaleFeeds, failover, selectProvider,
} from "./providerHealth";
import { ingestQuote } from "./quoteFusion";
import { cacheOHLC, getCachedOHLC, cacheQuote } from "./cache";
import { classifyRegime, updateMacro } from "./regime";
import { normalizeSymbol } from "./symbolNormalizer";
import type { AssetClass, OHLC, Quote } from "./types";

interface Subscription {
  symbolRaw: string;
  canonical: string;
  assetClass: AssetClass;
  provider: string;
  timer?: ReturnType<typeof setInterval>;
}

const SUBS = new Map<string, Subscription>();   // key = canonical
let staleTimer: ReturnType<typeof setInterval> | null = null;
let macroTimer: ReturnType<typeof setInterval> | null = null;
let running = false;

// ----- adapter hooks: replace these with real provider clients -----
type QuoteFetcher = (provider: string, symbol: string) => Promise<Quote>;
type HistoryFetcher = (provider: string, symbol: string, lookback: number) => Promise<OHLC[]>;

let fetchQuote: QuoteFetcher = simulatedQuote;
let fetchHistory: HistoryFetcher = simulatedHistory;

export function setProviderAdapters(adapters: { fetchQuote?: QuoteFetcher; fetchHistory?: HistoryFetcher }) {
  if (adapters.fetchQuote) fetchQuote = adapters.fetchQuote;
  if (adapters.fetchHistory) fetchHistory = adapters.fetchHistory;
}

// ----- core API -----
export function subscribe(symbolRaw: string, hint?: AssetClass): string {
  const norm = normalizeSymbol(symbolRaw, hint);
  if (SUBS.has(norm.canonical)) return norm.canonical;
  const spec = selectProvider(norm.assetClass);
  if (!spec) { console.warn(`[fusion] No provider available for ${norm.assetClass} — skipping`); return norm.canonical; }
  const sub: Subscription = {
    symbolRaw, canonical: norm.canonical, assetClass: norm.assetClass, provider: spec.id,
  };
  SUBS.set(norm.canonical, sub);
  if (running) attach(sub);
  return norm.canonical;
}

export function unsubscribe(canonical: string): void {
  const sub = SUBS.get(canonical);
  if (!sub) return;
  if (sub.timer) clearInterval(sub.timer);
  SUBS.delete(canonical);
}

export function listSubscriptions() {
  return [...SUBS.values()].map((s) => ({
    symbol: s.canonical, assetClass: s.assetClass, provider: s.provider,
  }));
}

export async function start() {
  if (running) return;
  running = true;
  for (const sub of SUBS.values()) attach(sub);
  staleTimer = setInterval(() => {
    scanStaleFeeds([...SUBS.values()].map((s) => ({
      symbol: s.canonical, assetClass: s.assetClass, provider: s.provider,
    })));
    // promote failover for any stale subscription
    for (const sub of SUBS.values()) {
      const h = snapshotHealth(sub.provider);
      if (h.stale || !h.up) {
        const next = failover(sub.canonical, sub.assetClass, sub.provider);
        if (next && next.id !== sub.provider) {
          if (sub.timer) clearInterval(sub.timer);
          sub.provider = next.id;
          attach(sub);
        }
      }
    }
    // emit periodic health snapshots
    for (const p of PROVIDERS) {
      fusionBus.emit({ type: "provider:health", health: snapshotHealth(p.id) });
    }
  }, 2_000);
  macroTimer = setInterval(() => {
    updateMacro({
      vix: 12 + Math.random() * 10,
      dxy: 103 + Math.random() * 2,
      yields10y: 4 + Math.random() * 0.6,
    });
  }, 5_000);
}

export function stop() {
  if (!running) return;
  running = false;
  for (const sub of SUBS.values()) if (sub.timer) clearInterval(sub.timer);
  if (staleTimer) clearInterval(staleTimer);
  if (macroTimer) clearInterval(macroTimer);
}

function attach(sub: Subscription) {
  const spec = PROVIDERS.find((p) => p.id === sub.provider)!;
  const tick = async () => {
    const t0 = performance.now();
    try {
      const q = await fetchQuote(sub.provider, sub.canonical);
      const lat = performance.now() - t0;
      recordTick(sub.provider, lat);
      const tagged: Quote = { ...q, symbol: sub.canonical, assetClass: sub.assetClass, provider: sub.provider };
      cacheQuote(sub.canonical, tagged);
      ingestQuote(tagged);
    } catch {
      recordError(sub.provider);
      const next = failover(sub.canonical, sub.assetClass, sub.provider);
      if (next && next.id !== sub.provider) {
        if (sub.timer) clearInterval(sub.timer);
        sub.provider = next.id;
        attach(sub);
      }
    }
  };
  const interval = spec.kind === "websocket"
    ? Math.max(500, spec.baseLatencyMs * 4)
    : (spec.pollMs ?? 3_000);
  sub.timer = setInterval(tick, interval);
  tick();
}

// ----- realtime + historical merge -----
export async function getMergedSeries(canonical: string, lookback = 200): Promise<OHLC[]> {
  const cached = getCachedOHLC(canonical);
  if (cached && cached.length >= lookback) return cached.slice(-lookback);
  const sub = SUBS.get(canonical);
  const provider = sub?.provider ?? PROVIDERS[0].id;
  const bars = await fetchHistory(provider, canonical, lookback);
  cacheOHLC(canonical, bars);
  // classify regime on merged history
  classifyRegime(canonical, bars);
  return bars;
}

// ----- simulators (deterministic-ish; replace in production) -----
const lastPrice = new Map<string, number>();
async function simulatedQuote(provider: string, symbol: string): Promise<Quote> {
  const spec = PROVIDERS.find((p) => p.id === provider)!;
  await new Promise((r) => setTimeout(r, spec.baseLatencyMs * (0.6 + Math.random() * 0.8)));
  if (Math.random() > spec.reliability) throw new Error("simulated network glitch");
  const prev = lastPrice.get(symbol) ?? seedPrice(symbol);
  const drift = (Math.random() - 0.5) * prev * 0.0015;
  const price = Math.max(0.0001, prev + drift);
  lastPrice.set(symbol, price);
  return {
    symbol, provider, price,
    bid: price * 0.9999, ask: price * 1.0001,
    volume: Math.round(Math.random() * 1000),
    ts: Date.now(),
    assetClass: spec.assetClasses[0],
  };
}

async function simulatedHistory(provider: string, symbol: string, lookback: number): Promise<OHLC[]> {
  const spec = PROVIDERS.find((p) => p.id === provider)!;
  await new Promise((r) => setTimeout(r, spec.baseLatencyMs));
  const out: OHLC[] = [];
  let p = seedPrice(symbol);
  const now = Date.now();
  for (let i = lookback; i > 0; i--) {
    const ts = now - i * 60_000;
    const o = p;
    const c = Math.max(0.0001, o * (1 + (Math.random() - 0.5) * 0.01));
    const h = Math.max(o, c) * (1 + Math.random() * 0.004);
    const l = Math.min(o, c) * (1 - Math.random() * 0.004);
    out.push({ symbol, ts, o, h, l, c, v: Math.round(1000 + Math.random() * 5000) });
    p = c;
  }
  lastPrice.set(symbol, p);
  return out;
}

function seedPrice(symbol: string): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  return 1 + (h % 100_000) / 100;
}
