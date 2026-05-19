/**
 * TwelveData server-side adapter.
 *
 * SECURITY: Reads TWELVEDATA_API_KEY from process.env inside handlers only.
 * Never imported by client code. Never returns the key in responses.
 *
 * Features:
 *  - REST: quote (stocks/forex/crypto/ETF), time series, technical indicators,
 *    market state (exchange + is-market-open).
 *  - Token-bucket rate limiter (free tier ≈ 8 req/min — we use 6 req/min to
 *    leave headroom for failover bursts).
 *  - Retry with exponential backoff + full jitter, 429-aware.
 *  - In-memory micro-cache (TTL per endpoint) so failover bursts don't waste credits.
 *  - Latency + freshness telemetry, per-endpoint stats.
 *  - providerHealth() compatible with the fusion engine health aggregator.
 *  - Failover scoring + confidence weighting helpers.
 *  - WebSocket helper (returns the wss URL — the server-side SSE bridge attaches
 *    auth; client code never sees the key).
 *
 * Routing policy: this adapter is intended as a BACKUP. Engines should call
 * Finnhub/Binance first, and only fall through to TwelveData when those report
 * degraded/down (see selectBackupProvider in providers/index.ts).
 */

const BASE = "https://api.twelvedata.com";

// ---------- Telemetry ----------
type CallStat = {
  endpoint: string;
  lastOkAt: number | null;
  lastErrorAt: number | null;
  lastError: string | null;
  lastLatencyMs: number | null;
  ewmaLatencyMs: number | null;
  okCount: number;
  errCount: number;
  rateLimitedCount: number;
  lastStatus: number | null;
};

const stats = new Map<string, CallStat>();

function bump(endpoint: string, patch: Partial<CallStat>) {
  const cur =
    stats.get(endpoint) ??
    ({
      endpoint,
      lastOkAt: null,
      lastErrorAt: null,
      lastError: null,
      lastLatencyMs: null,
      ewmaLatencyMs: null,
      okCount: 0,
      errCount: 0,
      rateLimitedCount: 0,
      lastStatus: null,
    } satisfies CallStat);
  stats.set(endpoint, { ...cur, ...patch });
}

// ---------- Token bucket ----------
// Free tier ~8 req/min, ~800/day. We keep 6 req/min (= 0.1/s) sustained.
const RATE_CAPACITY = 6;
const RATE_REFILL_PER_SEC = 0.1;
let tokens = RATE_CAPACITY;
let lastRefill = Date.now();

async function take(): Promise<void> {
  while (true) {
    const now = Date.now();
    const elapsed = (now - lastRefill) / 1000;
    tokens = Math.min(RATE_CAPACITY, tokens + elapsed * RATE_REFILL_PER_SEC);
    lastRefill = now;
    if (tokens >= 1) {
      tokens -= 1;
      return;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

// ---------- Cache ----------
interface CacheEntry<T> { value: T; expiresAt: number }
const cache = new Map<string, CacheEntry<unknown>>();
function cacheGet<T>(key: string): T | undefined {
  const e = cache.get(key);
  if (!e) return undefined;
  if (e.expiresAt < Date.now()) { cache.delete(key); return undefined; }
  return e.value as T;
}
function cacheSet<T>(key: string, value: T, ttlMs: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// ---------- Core fetch ----------
function getKey(): string {
  const k = process.env.TWELVEDATA_API_KEY;
  if (!k) throw new Error("TWELVEDATA_API_KEY is not configured");
  return k;
}

interface CallOpts {
  retries?: number;
  timeoutMs?: number;
  ttlMs?: number;
}

async function call<T>(
  endpoint: string,
  params: Record<string, string | number | undefined> = {},
  { retries = 3, timeoutMs = 8000, ttlMs = 0 }: CallOpts = {},
): Promise<T> {
  const key = getKey();
  const qs = new URLSearchParams({ apikey: key });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const url = `${BASE}${endpoint}?${qs.toString()}`;
  const cacheKey = `${endpoint}::${new URLSearchParams(
    Object.entries(params).reduce<Record<string, string>>((acc, [k, v]) => {
      if (v !== undefined && v !== null && v !== "") acc[k] = String(v);
      return acc;
    }, {}),
  ).toString()}`;
  if (ttlMs > 0) {
    const hit = cacheGet<T>(cacheKey);
    if (hit) return hit;
  }
  const id = endpoint;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await take();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const started = Date.now();
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
      const latency = Date.now() - started;
      clearTimeout(t);

      if (res.status === 429) {
        bump(id, {
          rateLimitedCount: (stats.get(id)?.rateLimitedCount ?? 0) + 1,
          lastStatus: 429,
        });
        const wait = Math.min(10_000, 800 * 2 ** attempt + Math.random() * 400);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        bump(id, {
          errCount: (stats.get(id)?.errCount ?? 0) + 1,
          lastErrorAt: Date.now(),
          lastError: `HTTP ${res.status}`,
          lastStatus: res.status,
        });
        if (res.status >= 500 && attempt < retries) {
          const wait = Math.min(6000, 400 * 2 ** attempt + Math.random() * 300);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw new Error(`TwelveData ${endpoint} failed: ${res.status} ${text.slice(0, 200)}`);
      }
      const json = (await res.json()) as T & { status?: string; code?: number; message?: string };
      // TwelveData returns 200 with { status: "error", code, message } on quota/symbol problems.
      if (json && typeof json === "object" && "status" in json && json.status === "error") {
        const msg = json.message ?? "TwelveData error";
        const code = json.code ?? 0;
        if (code === 429 || /limit/i.test(msg)) {
          bump(id, {
            rateLimitedCount: (stats.get(id)?.rateLimitedCount ?? 0) + 1,
            lastStatus: 429,
            lastError: msg,
            lastErrorAt: Date.now(),
          });
          const wait = Math.min(10_000, 800 * 2 ** attempt + Math.random() * 400);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        bump(id, {
          errCount: (stats.get(id)?.errCount ?? 0) + 1,
          lastErrorAt: Date.now(),
          lastError: msg,
          lastStatus: code || 400,
        });
        throw new Error(`TwelveData ${endpoint}: ${msg}`);
      }
      const prev = stats.get(id);
      const ewma =
        prev?.ewmaLatencyMs == null ? latency : Math.round(prev.ewmaLatencyMs * 0.7 + latency * 0.3);
      bump(id, {
        okCount: (prev?.okCount ?? 0) + 1,
        lastOkAt: Date.now(),
        lastLatencyMs: latency,
        ewmaLatencyMs: ewma,
        lastStatus: res.status,
      });
      if (ttlMs > 0) cacheSet(cacheKey, json, ttlMs);
      return json;
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
      bump(id, {
        errCount: (stats.get(id)?.errCount ?? 0) + 1,
        lastErrorAt: Date.now(),
        lastError: err instanceof Error ? err.message : String(err),
      });
      if (attempt < retries) {
        const wait = Math.min(6000, 400 * 2 ** attempt + Math.random() * 300);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("TwelveData request failed");
}

// ---------- Public REST API ----------
export interface TwelveDataQuote {
  symbol: string;
  name?: string;
  exchange?: string;
  currency?: string;
  datetime?: string;
  timestamp?: number;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
  previous_close?: string;
  change?: string;
  percent_change?: string;
  is_market_open?: boolean;
}

export async function getQuote(symbol: string): Promise<TwelveDataQuote> {
  return call<TwelveDataQuote>("/quote", { symbol }, { ttlMs: 15_000 });
}

export async function getBatchQuotes(symbols: string[]): Promise<Record<string, TwelveDataQuote>> {
  if (symbols.length === 0) return {};
  // TwelveData supports comma-separated symbols in /quote.
  const sym = symbols.join(",");
  const res = await call<Record<string, TwelveDataQuote> | TwelveDataQuote>(
    "/quote", { symbol: sym }, { ttlMs: 15_000 },
  );
  if (symbols.length === 1) return { [symbols[0]]: res as TwelveDataQuote };
  return res as Record<string, TwelveDataQuote>;
}

export interface TwelveDataPrice { price: string }
export async function getRealtimePrice(symbol: string): Promise<number | null> {
  const r = await call<TwelveDataPrice>("/price", { symbol }, { ttlMs: 5_000 });
  const n = parseFloat(r.price);
  return Number.isFinite(n) ? n : null;
}

export type Interval =
  | "1min" | "5min" | "15min" | "30min" | "45min"
  | "1h" | "2h" | "4h" | "8h" | "1day" | "1week" | "1month";

export interface TwelveDataBar {
  datetime: string;
  open: string; high: string; low: string; close: string; volume?: string;
}
export interface TwelveDataSeries {
  meta: { symbol: string; interval: string; currency?: string; exchange?: string; type?: string };
  values: TwelveDataBar[];
  status: string;
}

export async function getTimeSeries(symbol: string, interval: Interval = "1day", outputsize = 90) {
  return call<TwelveDataSeries>("/time_series", { symbol, interval, outputsize }, { ttlMs: 60_000 });
}

export interface TwelveDataIndicatorPoint { datetime: string; value: string }
export interface TwelveDataIndicator {
  meta: Record<string, string | number | null>;
  values: TwelveDataIndicatorPoint[];
  status: string;
}

export async function getRSI(symbol: string, interval: Interval = "1day", time_period = 14) {
  return call<TwelveDataIndicator>("/rsi", { symbol, interval, time_period }, { ttlMs: 120_000 });
}
export async function getEMA(symbol: string, interval: Interval = "1day", time_period = 20) {
  return call<TwelveDataIndicator>("/ema", { symbol, interval, time_period }, { ttlMs: 120_000 });
}
export async function getMACD(symbol: string, interval: Interval = "1day") {
  return call<TwelveDataIndicator>("/macd", { symbol, interval }, { ttlMs: 120_000 });
}

export interface TwelveDataMarketState {
  name: string;
  code: string;
  country: string;
  is_market_open: boolean;
  time_after_open?: string;
  time_to_open?: string;
  time_to_close?: string;
}
export async function getMarketState(exchange = "NASDAQ"): Promise<TwelveDataMarketState[]> {
  const r = await call<TwelveDataMarketState[]>("/market_state", { exchange }, { ttlMs: 60_000 });
  return Array.isArray(r) ? r : [];
}

// ---------- WebSocket (URL only — bridged server-side) ----------
/**
 * Returns the authenticated wss URL for the TwelveData price stream. NEVER
 * expose this to the client — open the socket server-side and bridge to the
 * client over the existing SSE infrastructure.
 */
export function getWebSocketUrl(symbols: string[]): string {
  const key = getKey();
  const list = symbols.join(",");
  return `wss://ws.twelvedata.com/v1/quotes/price?apikey=${encodeURIComponent(key)}&symbols=${encodeURIComponent(list)}`;
}

// ---------- Diagnostics & health ----------
export type StaleStatus = "fresh" | "stale" | "down" | "unknown";

export function staleStatus(s: CallStat | undefined, staleMs = 60_000, downMs = 5 * 60_000): StaleStatus {
  if (!s || !s.lastOkAt) return "unknown";
  const age = Date.now() - s.lastOkAt;
  if (age > downMs) return "down";
  if (age > staleMs) return "stale";
  return "fresh";
}

export function snapshotStats() {
  return Array.from(stats.values()).map((s) => ({
    ...s,
    stale: staleStatus(s),
    ageMs: s.lastOkAt ? Date.now() - s.lastOkAt : null,
  }));
}

export function providerHealth() {
  const list = snapshotStats();
  const total = list.reduce((a, s) => a + s.okCount + s.errCount, 0);
  const errors = list.reduce((a, s) => a + s.errCount, 0);
  const rateLimited = list.reduce((a, s) => a + s.rateLimitedCount, 0);
  const errorRate = total ? errors / total : 0;
  const fresh = list.filter((s) => s.stale === "fresh").length;
  const stale = list.filter((s) => s.stale === "stale").length;
  const down = list.filter((s) => s.stale === "down").length;
  const status: "healthy" | "degraded" | "down" =
    down > 0 || errorRate > 0.5 ? "down" : stale > 0 || errorRate > 0.15 ? "degraded" : "healthy";
  const avgLatency =
    list.length === 0
      ? null
      : Math.round(
          list.reduce((a, s) => a + (s.ewmaLatencyMs ?? s.lastLatencyMs ?? 0), 0) / list.length,
        );

  // Failover score: higher = better candidate. Used by the fusion router when
  // the primary feed is degraded.
  const freshness = list.length ? fresh / list.length : 0;
  const latencyPenalty = avgLatency ? Math.min(1, avgLatency / 1000) : 0.3;
  const failoverScore = Math.max(0, Math.min(1,
    0.55 * (1 - errorRate) + 0.25 * freshness + 0.2 * (1 - latencyPenalty),
  ));

  // Quote-confidence weight — how much to trust a quote from this provider in
  // a fused consensus right now.
  const quoteConfidence = Math.max(0.1, Math.min(0.9,
    0.6 * (1 - errorRate) + 0.25 * freshness + 0.15 * (1 - latencyPenalty),
  ));

  return {
    provider: "twelvedata" as const,
    status,
    errorRate,
    rateLimited,
    avgLatencyMs: avgLatency,
    endpoints: list,
    configured: !!process.env.TWELVEDATA_API_KEY,
    failoverScore: +failoverScore.toFixed(3),
    quoteConfidence: +quoteConfidence.toFixed(3),
    role: "backup" as const,
    generatedAt: Date.now(),
  };
}
