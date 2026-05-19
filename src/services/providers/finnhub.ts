/**
 * Finnhub server-side adapter.
 *
 * SECURITY: Reads FINNHUB_API_KEY from process.env inside handlers only.
 * Never imported by client code. Never returns the key in responses.
 *
 * Features:
 *  - REST: quote, company news, earnings calendar, market status, forex/crypto symbols
 *  - Rate-limit protection (token bucket, ~30 req/sec free tier)
 *  - Retry with exponential backoff + full jitter
 *  - Latency + stale-feed metrics per endpoint
 *  - Provider health diagnostics aggregator
 */

const BASE = "https://finnhub.io/api/v1";

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

// ---------- Token bucket (rate limiter) ----------
// Free tier ~60 req/min; we keep a conservative 30 req/sec hard ceiling.
const RATE_CAPACITY = 30;
const RATE_REFILL_PER_SEC = 30;
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
    await new Promise((r) => setTimeout(r, 50));
  }
}

// ---------- Core fetch with retry/backoff ----------
function getKey(): string {
  const k = process.env.FINNHUB_API_KEY;
  if (!k) throw new Error("FINNHUB_API_KEY is not configured");
  return k;
}

async function call<T>(
  endpoint: string,
  params: Record<string, string | number | undefined> = {},
  { retries = 3, timeoutMs = 8000 }: { retries?: number; timeoutMs?: number } = {}
): Promise<T> {
  const key = getKey();
  const qs = new URLSearchParams({ token: key });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const url = `${BASE}${endpoint}?${qs.toString()}`;
  // For telemetry, never include the token
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
        const wait = Math.min(8000, 500 * 2 ** attempt + Math.random() * 250);
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
        // 5xx is retryable
        if (res.status >= 500 && attempt < retries) {
          const wait = Math.min(6000, 300 * 2 ** attempt + Math.random() * 250);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw new Error(`Finnhub ${endpoint} failed: ${res.status} ${text.slice(0, 200)}`);
      }
      const json = (await res.json()) as T;
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
        const wait = Math.min(6000, 300 * 2 ** attempt + Math.random() * 250);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Finnhub request failed");
}

// ---------- Public REST API ----------
export interface FinnhubQuote {
  c: number; // current
  d: number | null; // change
  dp: number | null; // change %
  h: number; // high
  l: number; // low
  o: number; // open
  pc: number; // prev close
  t: number; // timestamp (seconds)
}

export async function getQuote(symbol: string): Promise<FinnhubQuote> {
  return call<FinnhubQuote>("/quote", { symbol: symbol.toUpperCase() });
}

export interface FinnhubNewsItem {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export async function getCompanyNews(symbol: string, fromISO: string, toISO: string) {
  return call<FinnhubNewsItem[]>("/company-news", { symbol: symbol.toUpperCase(), from: fromISO, to: toISO });
}

export async function getGeneralNews(category: "general" | "forex" | "crypto" | "merger" = "general") {
  return call<FinnhubNewsItem[]>("/news", { category });
}

export interface FinnhubEarning {
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  hour: string;
  quarter: number;
  revenueActual: number | null;
  revenueEstimate: number | null;
  symbol: string;
  year: number;
}

export async function getEarningsCalendar(fromISO: string, toISO: string, symbol?: string) {
  const r = await call<{ earningsCalendar: FinnhubEarning[] }>("/calendar/earnings", {
    from: fromISO,
    to: toISO,
    symbol: symbol?.toUpperCase(),
  });
  return r.earningsCalendar ?? [];
}

export interface FinnhubMarketStatus {
  exchange: string;
  holiday: string | null;
  isOpen: boolean;
  session: string | null;
  timezone: string;
  t: number;
}

export async function getMarketStatus(exchange = "US"): Promise<FinnhubMarketStatus> {
  return call<FinnhubMarketStatus>("/stock/market-status", { exchange });
}

export async function getForexSymbols(exchange = "OANDA") {
  return call<Array<{ description: string; displaySymbol: string; symbol: string }>>("/forex/symbol", { exchange });
}

export async function getCryptoSymbols(exchange = "BINANCE") {
  return call<Array<{ description: string; displaySymbol: string; symbol: string }>>("/crypto/symbol", { exchange });
}

// ---------- Diagnostics ----------
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

/**
 * High-level provider health: combines latency, errors, rate-limits, and freshness.
 */
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
          list.reduce((a, s) => a + (s.ewmaLatencyMs ?? s.lastLatencyMs ?? 0), 0) / list.length
        );
  return {
    provider: "finnhub" as const,
    status,
    errorRate,
    rateLimited,
    avgLatencyMs: avgLatency,
    endpoints: list,
    configured: !!process.env.FINNHUB_API_KEY,
    generatedAt: Date.now(),
  };
}
