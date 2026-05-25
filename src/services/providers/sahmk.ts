/**
 * SAHMK server-side adapter — Saudi market quotes.
 *
 * SECURITY: Reads SAHMK_API_KEY from process.env. Never imported by client code.
 *
 * Features:
 *  - Never throws: all errors returned as structured SahmkQuoteResult.
 *  - Token bucket (10 req/min conservative limit).
 *  - Retry with exponential backoff (3 attempts, 429-aware).
 *  - Per-endpoint telemetry compatible with providerHealth() aggregator.
 *  - source: "live" | "delayed" from API is_delayed field.
 */

const BASE = "https://app.sahmk.sa/api/v1";

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
  } satisfies CallStat;
  stats.set(endpoint, { ...cur, ...patch });
}

// ---------- Token bucket (10 req/min conservative) ----------
const RATE_CAPACITY = 10;
const RATE_REFILL_PER_SEC = 10 / 60;
let tokens = RATE_CAPACITY;
let lastRefill = Date.now();

async function take(): Promise<void> {
  while (true) {
    const now = Date.now();
    const elapsed = (now - lastRefill) / 1000;
    tokens = Math.min(RATE_CAPACITY, tokens + elapsed * RATE_REFILL_PER_SEC);
    lastRefill = now;
    if (tokens >= 1) { tokens -= 1; return; }
    await new Promise((r) => setTimeout(r, 200));
  }
}

// ---------- Result type ----------
export interface SahmkQuoteResult {
  provider: "sahmk";
  symbol: string;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  source: "live" | "delayed" | "unavailable";
  live: boolean;
  delayed: boolean;
  lastError: string | null;
  fallbackUsed: false;
  timestamp: number;
}

// ---------- Quote ----------
export async function getQuote(symbol: string): Promise<SahmkQuoteResult> {
  const apiKey = process.env.SAHMK_API_KEY;
  const clean = symbol.replace(".SR", "");
  const endpoint = `/quote/${clean}/`;

  if (!apiKey) {
    bump(endpoint, {
      errCount: (stats.get(endpoint)?.errCount ?? 0) + 1,
      lastErrorAt: Date.now(),
      lastError: "SAHMK_API_KEY missing",
      lastStatus: 0,
    });
    return {
      provider: "sahmk",
      symbol: `${clean}.SR`,
      price: null,
      changePercent: null,
      volume: null,
      source: "unavailable",
      live: false,
      delayed: false,
      lastError: "SAHMK_API_KEY missing",
      fallbackUsed: false,
      timestamp: Date.now(),
    };
  }

  let lastErrMsg = "SAHMK request failed";
  for (let attempt = 0; attempt <= 2; attempt++) {
    await take();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const started = Date.now();
    try {
      const res = await fetch(`${BASE}${endpoint}`, {
        signal: ctrl.signal,
        headers: { "X-API-Key": apiKey, Accept: "application/json" },
      });
      const latency = Date.now() - started;
      clearTimeout(t);

      if (res.status === 429) {
        bump(endpoint, {
          rateLimitedCount: (stats.get(endpoint)?.rateLimitedCount ?? 0) + 1,
          lastStatus: 429,
          lastError: "rate_limited",
          lastErrorAt: Date.now(),
        });
        const wait = Math.min(8000, 600 * 2 ** attempt + Math.random() * 300);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        lastErrMsg = `HTTP ${res.status} ${text.slice(0, 120)}`.trim();
        bump(endpoint, {
          errCount: (stats.get(endpoint)?.errCount ?? 0) + 1,
          lastErrorAt: Date.now(),
          lastError: lastErrMsg,
          lastStatus: res.status,
        });
        if (res.status >= 500 && attempt < 2) {
          const wait = Math.min(6000, 400 * 2 ** attempt + Math.random() * 200);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        break;
      }

      const data = await res.json();
      const prev = stats.get(endpoint);
      const ewma =
        prev?.ewmaLatencyMs == null ? latency : Math.round(prev.ewmaLatencyMs * 0.7 + latency * 0.3);
      bump(endpoint, {
        okCount: (prev?.okCount ?? 0) + 1,
        lastOkAt: Date.now(),
        lastLatencyMs: latency,
        ewmaLatencyMs: ewma,
        lastStatus: 200,
        lastError: null,
      });

      const isDelayed = data.is_delayed ?? true;
      return {
        provider: "sahmk",
        symbol: `${clean}.SR`,
        price: typeof data.price === "number" ? data.price : null,
        changePercent: typeof data.change_percent === "number" ? data.change_percent : null,
        volume: typeof data.volume === "number" ? data.volume : null,
        source: isDelayed ? "delayed" : "live",
        live: !isDelayed,
        delayed: isDelayed,
        lastError: null,
        fallbackUsed: false,
        timestamp: Date.now(),
      };
    } catch (err) {
      clearTimeout(t);
      lastErrMsg = err instanceof Error ? err.message : String(err);
      bump(endpoint, {
        errCount: (stats.get(endpoint)?.errCount ?? 0) + 1,
        lastErrorAt: Date.now(),
        lastError: lastErrMsg,
      });
      if (attempt < 2) {
        const wait = Math.min(6000, 400 * 2 ** attempt + Math.random() * 200);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
    }
  }

  return {
    provider: "sahmk",
    symbol: `${clean}.SR`,
    price: null,
    changePercent: null,
    volume: null,
    source: "unavailable",
    live: false,
    delayed: false,
    lastError: lastErrMsg,
    fallbackUsed: false,
    timestamp: Date.now(),
  };
}

// ---------- Health ----------
type StaleStatus = "fresh" | "stale" | "down" | "unknown";

function staleStatus(s: CallStat | undefined, staleMs = 60_000, downMs = 5 * 60_000): StaleStatus {
  if (!s || !s.lastOkAt) return "unknown";
  const age = Date.now() - s.lastOkAt;
  if (age > downMs) return "down";
  if (age > staleMs) return "stale";
  return "fresh";
}

export function providerHealth() {
  const list = Array.from(stats.values()).map((s) => ({
    ...s,
    stale: staleStatus(s),
    ageMs: s.lastOkAt ? Date.now() - s.lastOkAt : null,
  }));
  const total = list.reduce((a, s) => a + s.okCount + s.errCount, 0);
  const errors = list.reduce((a, s) => a + s.errCount, 0);
  const errorRate = total ? errors / total : 0;
  const down = list.filter((s) => s.stale === "down").length;
  const stale = list.filter((s) => s.stale === "stale").length;
  const status: "healthy" | "degraded" | "down" =
    down > 0 || errorRate > 0.5 ? "down" : stale > 0 || errorRate > 0.15 ? "degraded" : "healthy";
  const avgLatencyMs = list.length
    ? Math.round(list.reduce((a, s) => a + (s.ewmaLatencyMs ?? s.lastLatencyMs ?? 0), 0) / list.length)
    : null;
  const configured = !!process.env.SAHMK_API_KEY;
  const failoverScore = configured && errorRate < 0.5 ? Math.max(0, +(1 - errorRate * 2).toFixed(3)) : 0;

  return {
    provider: "sahmk" as const,
    status,
    errorRate: +errorRate.toFixed(3),
    rateLimited: list.reduce((a, s) => a + s.rateLimitedCount, 0),
    avgLatencyMs,
    endpoints: list,
    configured,
    failoverScore,
    role: "saudi-market" as const,
    generatedAt: Date.now(),
  };
}
