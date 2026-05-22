/**
 * CommodityPriceAPI adapter — XAGUSD, WTI, BRENT, NATGAS.
 *
 * Server-only. Reads COMMODITYPRICEAPI_KEY from process.env.
 * Never throws — returns CommodityQuote or CommodityError.
 *
 * API ref: https://www.commoditypriceapi.com — REST endpoints
 *  GET /v2/latest?symbols=XAG,WTI,BRENT&base=USD
 * Plan tiers may use a slightly different path; this adapter is permissive on
 * the response shape (`rates` map OR `data` map).
 */

const BASE = "https://api.commoditypriceapi.com/v2";

const SYMBOL_MAP: Record<string, string> = {
  XAGUSD: "XAG", XAG: "XAG", SILVER: "XAG",
  XAUUSD: "XAU", XAU: "XAU", GOLD: "XAU",
  WTI: "WTI", USOIL: "WTI", CL: "WTI",
  BRENT: "BRENT", UKOIL: "BRENT",
  NATGAS: "NG", "NG": "NG", "NATURAL_GAS": "NG",
};

export interface CommodityQuote {
  symbol: string;            // canonical (e.g. "XAGUSD")
  translatedSymbol: string;  // API symbol (e.g. "XAG")
  endpoint: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  timestamp: number;
  delayed: boolean;
  latencyMs: number;
  raw: Record<string, unknown>;
}

export interface CommodityError {
  ok: false;
  reason: "missing_key" | "http_error" | "rate_limited" | "empty" | "network" | "unsupported";
  message: string;
  httpStatus?: number;
  latencyMs?: number;
  endpoint?: string;
  translatedSymbol?: string;
}

function getKey(): string | null {
  const k = process.env.COMMODITYPRICEAPI_KEY;
  return k && k.trim() ? k.trim() : null;
}

export function toCommoditySymbol(input: string): string {
  const s = (input ?? "").trim().toUpperCase();
  return SYMBOL_MAP[s] ?? "";
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
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

interface LatestResponse {
  success?: boolean;
  base?: string;
  timestamp?: number;
  rates?: Record<string, number>;
  data?: Record<string, { price?: number; change?: number; change_percent?: number }>;
  error?: { message?: string };
}

export async function getCommodityQuote(symbol: string): Promise<CommodityQuote | CommodityError> {
  const key = getKey();
  const translated = toCommoditySymbol(symbol);
  const endpoint = `${BASE}/latest`;

  if (!key) return { ok: false, reason: "missing_key", message: "COMMODITYPRICEAPI_KEY not configured", endpoint, translatedSymbol: translated };
  if (!translated) return { ok: false, reason: "unsupported", message: `unsupported symbol ${symbol}`, endpoint };

  const url = `${endpoint}?apiKey=${encodeURIComponent(key)}&symbols=${encodeURIComponent(translated)}&base=USD`;
  try {
    const { res, latencyMs } = await timedFetch(url);
    if (res.status === 429) {
      return { ok: false, reason: "rate_limited", message: "CommodityPriceAPI rate limit", httpStatus: 429, latencyMs, endpoint, translatedSymbol: translated };
    }
    if (!res.ok) {
      return { ok: false, reason: "http_error", message: `HTTP ${res.status}`, httpStatus: res.status, latencyMs, endpoint, translatedSymbol: translated };
    }
    const j = (await res.json()) as LatestResponse;

    let price: number | null = null;
    let change: number | null = null;
    let changePct: number | null = null;
    if (j.rates && typeof j.rates[translated] === "number") {
      // rates are commodity-per-USD; price = 1/rate when USD-base inverts (most providers already return price in USD)
      price = j.rates[translated];
    }
    if (j.data && j.data[translated]) {
      price = price ?? num(j.data[translated].price);
      change = num(j.data[translated].change);
      changePct = num(j.data[translated].change_percent);
    }
    if (price == null) {
      return { ok: false, reason: "empty", message: j.error?.message ?? "empty quote", latencyMs, endpoint, translatedSymbol: translated };
    }
    return {
      symbol: symbol.toUpperCase(),
      translatedSymbol: translated,
      endpoint,
      price,
      change,
      changePercent: changePct,
      volume: null,
      timestamp: j.timestamp ? j.timestamp * 1000 : Date.now(),
      delayed: false,
      latencyMs,
      raw: j as unknown as Record<string, unknown>,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "network error";
    return { ok: false, reason: "network", message, endpoint, translatedSymbol: translated };
  }
}
