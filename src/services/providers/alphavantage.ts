/**
 * Alpha Vantage server-side adapter.
 *
 * Role: secondary macro + forex + equities provider. Used as a fallback when
 * Finnhub is degraded, and as the primary feed for macro indicators
 * (DXY proxy, 10Y yield, oil, gold, SPX) consumed by the macro agent.
 *
 * SECURITY: Reads ALPHAVANTAGE_API_KEY from process.env inside handlers only.
 * Never imported by client code. Never returns the key in responses.
 *
 * Constraints:
 *  - Free tier: 5 req/min, 500/day. We rate-limit at 4/min and cache hard.
 *  - Macro indicators cached 24h (they update at most daily).
 *  - Quotes cached 60s; FX cached 30s.
 *  - Retries on 5xx + JSON "Note"/"Information" rate-limit messages.
 */

const BASE = "https://www.alphavantage.co/query";

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
  const cur = stats.get(endpoint) ?? {
    endpoint, lastOkAt: null, lastErrorAt: null, lastError: null,
    lastLatencyMs: null, ewmaLatencyMs: null,
    okCount: 0, errCount: 0, rateLimitedCount: 0, lastStatus: null,
  } satisfies CallStat;
  stats.set(endpoint, { ...cur, ...patch });
}

// ---------- Rate limit (4 req/min sustained) ----------
const RATE_CAPACITY = 4;
const RATE_REFILL_PER_SEC = 4 / 60;
let tokens = RATE_CAPACITY;
let lastRefill = Date.now();
async function take(): Promise<void> {
  while (true) {
    const now = Date.now();
    const elapsed = (now - lastRefill) / 1000;
    tokens = Math.min(RATE_CAPACITY, tokens + elapsed * RATE_REFILL_PER_SEC);
    lastRefill = now;
    if (tokens >= 1) { tokens -= 1; return; }
    await new Promise((r) => setTimeout(r, 250));
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

function getKey(): string {
  const k = process.env.ALPHAVANTAGE_API_KEY;
  if (!k) throw new Error("ALPHAVANTAGE_API_KEY is not configured");
  return k;
}

interface AVError { Note?: string; Information?: string; "Error Message"?: string }

async function call<T>(
  params: Record<string, string | number | undefined>,
  { ttlMs = 60_000, retries = 2, timeoutMs = 9000 }: { ttlMs?: number; retries?: number; timeoutMs?: number } = {},
): Promise<T> {
  const key = getKey();
  const qs = new URLSearchParams({ apikey: key });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const endpoint = String(params.function ?? "unknown");
  const cacheKey = `${endpoint}::${qs.toString().replace(/&?apikey=[^&]*/, "")}`;
  const hit = cacheGet<T>(cacheKey);
  if (hit) return hit;

  const url = `${BASE}?${qs.toString()}`;
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

      if (!res.ok) {
        bump(endpoint, {
          errCount: (stats.get(endpoint)?.errCount ?? 0) + 1,
          lastErrorAt: Date.now(),
          lastError: `HTTP ${res.status}`,
          lastStatus: res.status,
        });
        if (res.status >= 500 && attempt < retries) {
          const wait = Math.min(6000, 500 * 2 ** attempt + Math.random() * 250);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw new Error(`AlphaVantage ${endpoint} failed: ${res.status}`);
      }

      const json = (await res.json()) as T & AVError;
      // Alpha Vantage uses 200-OK + JSON for rate limits and errors.
      if (json && typeof json === "object") {
        if (json.Note || json.Information) {
          bump(endpoint, {
            rateLimitedCount: (stats.get(endpoint)?.rateLimitedCount ?? 0) + 1,
            lastStatus: 429,
            lastError: json.Note ?? json.Information ?? "rate limited",
            lastErrorAt: Date.now(),
          });
          const wait = Math.min(15_000, 1500 * 2 ** attempt + Math.random() * 500);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        if (json["Error Message"]) {
          bump(endpoint, {
            errCount: (stats.get(endpoint)?.errCount ?? 0) + 1,
            lastErrorAt: Date.now(),
            lastError: json["Error Message"],
            lastStatus: 400,
          });
          throw new Error(`AlphaVantage ${endpoint}: ${json["Error Message"]}`);
        }
      }

      const prev = stats.get(endpoint);
      const ewma = prev?.ewmaLatencyMs == null ? latency : Math.round(prev.ewmaLatencyMs * 0.7 + latency * 0.3);
      bump(endpoint, {
        okCount: (prev?.okCount ?? 0) + 1,
        lastOkAt: Date.now(),
        lastLatencyMs: latency,
        ewmaLatencyMs: ewma,
        lastStatus: 200,
      });
      cacheSet(cacheKey, json, ttlMs);
      return json;
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
      bump(endpoint, {
        errCount: (stats.get(endpoint)?.errCount ?? 0) + 1,
        lastErrorAt: Date.now(),
        lastError: err instanceof Error ? err.message : String(err),
      });
      if (attempt < retries) {
        const wait = Math.min(6000, 500 * 2 ** attempt + Math.random() * 250);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("AlphaVantage request failed");
}

// ---------- Equities ----------
export interface AVGlobalQuote {
  "Global Quote"?: {
    "01. symbol": string;
    "02. open": string;
    "03. high": string;
    "04. low": string;
    "05. price": string;
    "06. volume": string;
    "07. latest trading day": string;
    "08. previous close": string;
    "09. change": string;
    "10. change percent": string;
  };
}

export async function getEquityQuote(symbol: string) {
  return call<AVGlobalQuote>({ function: "GLOBAL_QUOTE", symbol }, { ttlMs: 60_000 });
}

// ---------- Forex ----------
export interface AVFxRate {
  "Realtime Currency Exchange Rate"?: {
    "1. From_Currency Code": string;
    "3. To_Currency Code": string;
    "5. Exchange Rate": string;
    "6. Last Refreshed": string;
    "8. Bid Price": string;
    "9. Ask Price": string;
  };
}
export async function getFxRate(from: string, to: string) {
  return call<AVFxRate>(
    { function: "CURRENCY_EXCHANGE_RATE", from_currency: from, to_currency: to },
    { ttlMs: 30_000 },
  );
}

// ---------- Macro indicators (cached 24h) ----------
const MACRO_TTL = 24 * 60 * 60 * 1000;
export interface AVSeries { name: string; interval: string; unit?: string; data: Array<{ date: string; value: string }> }

export const getTreasuryYield = (maturity: "3month" | "2year" | "5year" | "7year" | "10year" | "30year" = "10year") =>
  call<AVSeries>({ function: "TREASURY_YIELD", interval: "daily", maturity }, { ttlMs: MACRO_TTL });
export const getFederalFunds = () =>
  call<AVSeries>({ function: "FEDERAL_FUNDS_RATE", interval: "daily" }, { ttlMs: MACRO_TTL });
export const getInflation = () =>
  call<AVSeries>({ function: "INFLATION" }, { ttlMs: MACRO_TTL });
export const getRealGdp = () =>
  call<AVSeries>({ function: "REAL_GDP", interval: "quarterly" }, { ttlMs: MACRO_TTL });
export const getUnemployment = () =>
  call<AVSeries>({ function: "UNEMPLOYMENT" }, { ttlMs: MACRO_TTL });
export const getOilWti = () =>
  call<AVSeries>({ function: "WTI", interval: "daily" }, { ttlMs: MACRO_TTL });
export const getOilBrent = () =>
  call<AVSeries>({ function: "BRENT", interval: "daily" }, { ttlMs: MACRO_TTL });

// Gold + SPX + DXY proxies via tradable tickers (free tier doesn't expose
// DXY directly — UUP ETF is the standard proxy).
export const getGoldQuote = () => getEquityQuote("GLD");
export const getSpxQuote = () => getEquityQuote("SPY");
export const getDxyProxyQuote = () => getEquityQuote("UUP");

/** Aggregated macro snapshot for the macro engine. */
export async function getMacroSnapshot() {
  const [yield10y, fed, inflation, oilWti, oilBrent, dxy, gold, spx] = await Promise.allSettled([
    getTreasuryYield("10year"),
    getFederalFunds(),
    getInflation(),
    getOilWti(),
    getOilBrent(),
    getDxyProxyQuote(),
    getGoldQuote(),
    getSpxQuote(),
  ]);

  const last = (r: PromiseSettledResult<AVSeries>): number | null => {
    if (r.status !== "fulfilled") return null;
    const v = r.value?.data?.[0]?.value;
    const n = v ? parseFloat(v) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const quote = (r: PromiseSettledResult<AVGlobalQuote>): number | null => {
    if (r.status !== "fulfilled") return null;
    const v = r.value?.["Global Quote"]?.["05. price"];
    const n = v ? parseFloat(v) : NaN;
    return Number.isFinite(n) ? n : null;
  };

  return {
    generatedAt: Date.now(),
    yield10y: last(yield10y),
    fedFunds: last(fed),
    inflation: last(inflation),
    oilWti: last(oilWti),
    oilBrent: last(oilBrent),
    dxyProxy: quote(dxy),
    gold: quote(gold),
    spx: quote(spx),
  };
}

// ---------- Diagnostics & health ----------
export type StaleStatus = "fresh" | "stale" | "down" | "unknown";
export function staleStatus(s: CallStat | undefined, staleMs = 5 * 60_000, downMs = 30 * 60_000): StaleStatus {
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
    down > 0 || errorRate > 0.5 ? "down" : stale > 0 || errorRate > 0.2 ? "degraded" : "healthy";
  const avgLatency = list.length
    ? Math.round(list.reduce((a, s) => a + (s.ewmaLatencyMs ?? s.lastLatencyMs ?? 0), 0) / list.length)
    : null;

  const freshness = list.length ? fresh / list.length : 0;
  const latencyPenalty = avgLatency ? Math.min(1, avgLatency / 1500) : 0.4;
  const failoverScore = Math.max(0, Math.min(1,
    0.5 * (1 - errorRate) + 0.3 * freshness + 0.2 * (1 - latencyPenalty),
  ));

  return {
    provider: "alphavantage" as const,
    status, errorRate, rateLimited,
    avgLatencyMs: avgLatency,
    endpoints: list,
    configured: !!process.env.ALPHAVANTAGE_API_KEY,
    failoverScore: +failoverScore.toFixed(3),
    role: "secondary-macro" as const,
    generatedAt: Date.now(),
  };
}
