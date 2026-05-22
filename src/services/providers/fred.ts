/**
 * FRED — St. Louis Fed economic data adapter.
 *
 * Server-only. Reads FRED_API_KEY from process.env.
 * Coverage: US treasuries (US02Y, US10Y, US30Y), Fed Funds Rate, CPI, inflation,
 * unemployment, GDP — anything addressable by a FRED series ID.
 *
 * Internal symbols are mapped to FRED series IDs; the router treats these
 * as `bond` / `treasury` asset class. FRED data is end-of-day (delayed).
 */

const BASE = "https://api.stlouisfed.org/fred";

/** Symbol → FRED series id. Extend as new instruments are wired in. */
const SERIES_MAP: Record<string, string> = {
  // Treasuries (constant maturity, % per annum)
  US02Y: "DGS2",
  US05Y: "DGS5",
  US10Y: "DGS10",
  US30Y: "DGS30",
  // Policy rate
  FEDFUNDS: "FEDFUNDS",
  "FED_FUNDS": "FEDFUNDS",
  // Inflation
  CPI: "CPIAUCSL",
  CPI_YOY: "CPIAUCSL",
  CORE_CPI: "CPILFESL",
  PCE: "PCE",
  CORE_PCE: "PCEPILFE",
  // Macro
  UNEMPLOYMENT: "UNRATE",
  GDP: "GDPC1",
  M2: "M2SL",
};

export interface FredQuote {
  symbol: string;
  translatedSymbol: string;
  endpoint: string;
  price: number;          // most-recent observation value
  change: number | null;
  changePercent: number | null;
  volume: number | null;  // n/a for macro
  timestamp: number;
  delayed: boolean;
  latencyMs: number;
  raw: { observations?: Array<{ date: string; value: string }> };
}

export interface FredError {
  ok: false;
  reason: "missing_key" | "http_error" | "rate_limited" | "empty" | "network" | "unsupported";
  message: string;
  httpStatus?: number;
  latencyMs?: number;
  endpoint?: string;
  translatedSymbol?: string;
}

function getKey(): string | null {
  const k = process.env.FRED_API_KEY;
  return k && k.trim() ? k.trim() : null;
}

export function toFredSeries(input: string): string {
  const s = (input ?? "").trim().toUpperCase();
  return SERIES_MAP[s] ?? "";
}

function num(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

async function timedFetch(url: string, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    return { res, latencyMs: Date.now() - start };
  } finally {
    clearTimeout(t);
  }
}

export async function getFredQuote(symbol: string): Promise<FredQuote | FredError> {
  const key = getKey();
  const series = toFredSeries(symbol);
  const endpoint = `${BASE}/series/observations`;

  if (!key) return { ok: false, reason: "missing_key", message: "FRED_API_KEY not configured", endpoint, translatedSymbol: series };
  if (!series) return { ok: false, reason: "unsupported", message: `no FRED mapping for ${symbol}`, endpoint };

  const url = `${endpoint}?series_id=${encodeURIComponent(series)}&api_key=${encodeURIComponent(key)}&file_type=json&sort_order=desc&limit=5`;
  try {
    const { res, latencyMs } = await timedFetch(url);
    if (res.status === 429) {
      return { ok: false, reason: "rate_limited", message: "FRED rate limit", httpStatus: 429, latencyMs, endpoint, translatedSymbol: series };
    }
    if (!res.ok) {
      return { ok: false, reason: "http_error", message: `FRED HTTP ${res.status}`, httpStatus: res.status, latencyMs, endpoint, translatedSymbol: series };
    }
    const j = (await res.json()) as { observations?: Array<{ date: string; value: string }> };
    const obs = (j.observations ?? []).filter((o) => o.value !== "." && o.value != null);
    if (obs.length === 0) {
      return { ok: false, reason: "empty", message: "FRED empty observations", latencyMs, endpoint, translatedSymbol: series };
    }
    const latest = obs[0];
    const previous = obs[1];
    const price = num(latest.value);
    if (price == null) {
      return { ok: false, reason: "empty", message: "FRED non-numeric latest", latencyMs, endpoint, translatedSymbol: series };
    }
    const prev = previous ? num(previous.value) : null;
    const change = prev != null ? price - prev : null;
    const changePct = prev != null && prev !== 0 ? (change! / prev) * 100 : null;
    return {
      symbol: symbol.toUpperCase(),
      translatedSymbol: series,
      endpoint,
      price,
      change,
      changePercent: changePct,
      volume: null,
      timestamp: Date.parse(latest.date) || Date.now(),
      delayed: true, // FRED is EOD
      latencyMs,
      raw: j,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "network error";
    return { ok: false, reason: "network", message, endpoint, translatedSymbol: series };
  }
}
