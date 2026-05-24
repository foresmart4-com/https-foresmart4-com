/**
 * Marketstack provider — server-side only.
 * Reads MARKETSTACK_API_KEY from process.env. Never exposes key to client.
 */

const BASE = "http://api.marketstack.com/v1";

export interface MarketstackQuote {
  success: true;
  provider: "marketstack";
  symbol: string;
  translatedSymbol: string;
  assetClass: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  currency: string | null;
  exchange: string | null;
  timestamp: number;
  delayed: boolean;
  dataMode: "eod" | "intraday";
}

export interface MarketstackError {
  success: false;
  provider: "marketstack";
  symbol: string;
  translatedSymbol: string;
  error: string;
  reason: "missing_key" | "http_error" | "empty" | "rate_limited" | "network" | "unsupported";
}

function getKey(): string | undefined {
  return process.env.MARKETSTACK_API_KEY?.trim();
}

export function isMarketstackConfigured(): boolean {
  return Boolean(getKey());
}

export function toMarketstackSymbol(symbol: string, assetClass?: string): string {
  const s = symbol.toUpperCase().trim();
  if (assetClass === "us_stock" && /^[A-Z]{1,5}$/.test(s)) return s;
  if (s.endsWith(".SR")) return s;
  if (s.endsWith(".L")) return s;
  if (/\.(DE|PA|MI|MC|AS|SW|HK|SS|SZ)$/.test(s)) return s;
  return s;
}

async function timedFetch(url: string, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return { res, latencyMs: Date.now() - start };
  } finally { clearTimeout(t); }
}

export async function getMarketstackQuote(symbol: string, assetClass?: string): Promise<MarketstackQuote | MarketstackError> {
  const key = getKey();
  const translated = toMarketstackSymbol(symbol, assetClass);
  if (!key) return { success: false, provider: "marketstack", symbol, translatedSymbol: translated, error: "MARKETSTACK_API_KEY not configured", reason: "missing_key" };

  const url = `${BASE}/eod/latest?access_key=${encodeURIComponent(key)}&symbols=${encodeURIComponent(translated)}&limit=1`;
  try {
    const { res } = await timedFetch(url);
    if (res.status === 429) return { success: false, provider: "marketstack", symbol, translatedSymbol: translated, error: "Rate limited", reason: "rate_limited" };
    if (!res.ok) return { success: false, provider: "marketstack", symbol, translatedSymbol: translated, error: `HTTP ${res.status}`, reason: "http_error" };

    const body = await res.json() as { data?: Array<Record<string, unknown>>; error?: { message?: string } };
    if (body.error) return { success: false, provider: "marketstack", symbol, translatedSymbol: translated, error: body.error.message ?? "API error", reason: "http_error" };
    if (!body.data?.length) return { success: false, provider: "marketstack", symbol, translatedSymbol: translated, error: "No data", reason: "empty" };

    const row = body.data[0];
    const price = Number(row.close ?? row.last);
    if (!price || !Number.isFinite(price)) return { success: false, provider: "marketstack", symbol, translatedSymbol: translated, error: "Empty price", reason: "empty" };

    const open = Number(row.open ?? price);
    const change = price - open;
    const changePct = open > 0 ? (change / open) * 100 : 0;

    return {
      success: true, provider: "marketstack", symbol, translatedSymbol: translated,
      assetClass: assetClass ?? "unknown",
      price, change: Math.round(change * 100) / 100, changePercent: Math.round(changePct * 100) / 100,
      volume: Number(row.volume) || null,
      currency: null, exchange: String(row.exchange ?? ""),
      timestamp: row.date ? new Date(String(row.date)).getTime() : Date.now(),
      delayed: true, dataMode: "eod",
    };
  } catch (e) {
    return { success: false, provider: "marketstack", symbol, translatedSymbol: translated, error: e instanceof Error ? e.message : "network error", reason: "network" };
  }
}
