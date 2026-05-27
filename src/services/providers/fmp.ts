/**
 * Financial Modeling Prep (FMP) — global market data adapter.
 *
 * Server-only. Reads FMP_API_KEY from process.env.
 * Coverage: indices, forex, global stocks, crypto fallback, commodities fallback.
 *
 * Never throws — returns either a quote or a structured error so the router
 * can fall through cleanly.
 */

const BASE = "https://financialmodelingprep.com/api/v3";

export interface FmpQuoteRaw {
  symbol?: string;
  price?: number;
  change?: number;
  changesPercentage?: number;
  volume?: number;
  timestamp?: number;
  [k: string]: unknown;
}

export interface FmpQuote {
  symbol: string;
  translatedSymbol: string;
  endpoint: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  timestamp: number;
  delayed: boolean;        // FMP free tier is EOD/delayed for many assets
  latencyMs: number;
  raw: FmpQuoteRaw;
}

export interface FmpError {
  ok: false;
  reason: "missing_key" | "http_error" | "rate_limited" | "empty" | "network";
  message: string;
  httpStatus?: number;
  latencyMs?: number;
  endpoint?: string;
  translatedSymbol?: string;
}

function getKey(): string | null {
  const k = process.env.FMP_API_KEY;
  return k && k.trim() ? k.trim() : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Translate canonical symbol into the FMP-expected ticker for a given class.
 *  - Indices: ^GSPC, ^DJI, ^IXIC, ^TASI (FMP uses leading ^)
 *  - Forex: EURUSD (no slash)
 *  - Crypto: BTCUSD
 *  - Saudi: 2222.SR (already canonical)
 *  - Commodities: CL=F, BZ=F, NG=F, GC=F, SI=F
 *  - Stocks: AAPL
 */
export function toFmpSymbol(input: string, hint?: string): string {
  const s = (input ?? "").trim().toUpperCase();
  if (!s) return "";
  // Already prefixed
  if (s.startsWith("^") || s.endsWith("=F")) return s;

  // Common indices map
  const INDEX: Record<string, string> = {
    SPX: "^GSPC", "S&P500": "^GSPC", SP500: "^GSPC",
    DJI: "^DJI", DOW: "^DJI",
    NDX: "^NDX", NASDAQ: "^IXIC", IXIC: "^IXIC",
    VIX: "^VIX",
    TASI: "^TASI", "TASI.SR": "^TASI",
  };
  if (INDEX[s]) return INDEX[s];

  // Saudi: keep .SR
  if (/\.SR$/i.test(s)) return s;

  // Forex pair "EUR/USD" → "EURUSD"
  const fx = s.match(/^([A-Z]{3})[\/-]?([A-Z]{3})$/);
  if (fx) return `${fx[1]}${fx[2]}`;

  // Metals canonical "XAU/USD" → "XAUUSD"
  if (s.includes("/")) return s.replace(/\//g, "");

  // Crypto pair BTCUSDT → BTCUSD (FMP uses USD)
  const cm = s.match(/^([A-Z0-9]{2,8})(USDT|USDC|BUSD)$/);
  if (cm) return `${cm[1]}USD`;

  // Commodity hints
  const COMM: Record<string, string> = {
    WTI: "CL=F", USOIL: "CL=F", BRENT: "BZ=F", NATGAS: "NG=F",
    GOLD: "GCUSD", SILVER: "SIUSD", COPPER: "HG=F",
  };
  if (COMM[s]) return COMM[s];

  return s;
}

async function timedFetch(url: string, timeoutMs = 7000) {
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

export async function getFmpQuote(symbol: string): Promise<FmpQuote | FmpError> {
  const key = getKey();
  const translated = toFmpSymbol(symbol);
  const endpoint = `${BASE}/quote/${encodeURIComponent(translated)}`;

  if (!key) return { ok: false, reason: "missing_key", message: "FMP_API_KEY not configured", endpoint, translatedSymbol: translated };
  if (!translated) return { ok: false, reason: "empty", message: "empty symbol", endpoint, translatedSymbol: translated };

  try {
    const { res, latencyMs } = await timedFetch(`${endpoint}?apikey=${encodeURIComponent(key)}`);
    if (res.status === 429) {
      return { ok: false, reason: "rate_limited", message: "FMP rate limit", httpStatus: 429, latencyMs, endpoint, translatedSymbol: translated };
    }
    if (!res.ok) {
      return { ok: false, reason: "http_error", message: `FMP HTTP ${res.status}`, httpStatus: res.status, latencyMs, endpoint, translatedSymbol: translated };
    }
    const j = (await res.json()) as FmpQuoteRaw[] | { "Error Message"?: string };
    if (!Array.isArray(j) || j.length === 0) {
      const msg = (j as { "Error Message"?: string })["Error Message"] || "empty";
      return { ok: false, reason: "empty", message: `FMP ${msg}`, httpStatus: res.status, latencyMs, endpoint, translatedSymbol: translated };
    }
    const row = j[0];
    const price = num(row.price);
    if (price == null) {
      return { ok: false, reason: "empty", message: "FMP empty price", latencyMs, endpoint, translatedSymbol: translated };
    }
    return {
      symbol: row.symbol ?? translated,
      translatedSymbol: translated,
      endpoint,
      price,
      change: num(row.change),
      changePercent: num(row.changesPercentage),
      volume: num(row.volume),
      timestamp: row.timestamp ? row.timestamp * 1000 : Date.now(),
      delayed: false,
      latencyMs,
      raw: row,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "network error";
    return { ok: false, reason: "network", message, endpoint, translatedSymbol: translated };
  }
}
