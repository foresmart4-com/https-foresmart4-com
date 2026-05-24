/**
 * EODHD (eodhistoricaldata.com) provider — server-side only.
 * Reads EODHD_API_KEY from process.env. Never exposes key to client.
 */

const BASE = "https://eodhd.com/api";

export interface EodhdQuote {
  success: true;
  provider: "eodhd";
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
  dataMode: "live" | "delayed" | "eod" | "intraday";
}

export interface EodhdError {
  success: false;
  provider: "eodhd";
  symbol: string;
  translatedSymbol: string;
  error: string;
  reason: "missing_key" | "http_error" | "empty" | "rate_limited" | "network" | "unsupported";
}

function getKey(): string | undefined {
  return process.env.EODHD_API_KEY?.trim();
}

export function isEodhdConfigured(): boolean {
  return Boolean(getKey());
}

export function toEodhdSymbol(symbol: string, assetClass?: string): string {
  const s = symbol.toUpperCase().trim();
  if (s.includes(".")) return s;
  if (assetClass === "us_stock" || /^[A-Z]{1,5}$/.test(s)) return `${s}.US`;
  if (assetClass === "crypto") return `${s.replace(/USDT$|USD$/, "")}-USD.CC`;
  if (assetClass === "forex") {
    const m = s.match(/^([A-Z]{3})([A-Z]{3})$/);
    if (m) return `${m[1]}${m[2]}.FOREX`;
  }
  if (assetClass === "commodity") {
    const map: Record<string, string> = { WTI: "CL.COMM", BRENT: "BZ.COMM", NATGAS: "NG.COMM" };
    if (map[s]) return map[s];
  }
  if (assetClass === "metal") {
    const map: Record<string, string> = { XAUUSD: "GC.COMM", XAGUSD: "SI.COMM", GOLD: "GC.COMM", SILVER: "SI.COMM" };
    if (map[s]) return map[s];
  }
  return s;
}

async function timedFetch(url: string, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    return { res, latencyMs: Date.now() - start };
  } finally { clearTimeout(t); }
}

export async function getEodhdQuote(symbol: string, assetClass?: string): Promise<EodhdQuote | EodhdError> {
  const key = getKey();
  const translated = toEodhdSymbol(symbol, assetClass);
  if (!key) return { success: false, provider: "eodhd", symbol, translatedSymbol: translated, error: "EODHD_API_KEY not configured", reason: "missing_key" };

  const url = `${BASE}/real-time/${encodeURIComponent(translated)}?api_token=${encodeURIComponent(key)}&fmt=json`;
  try {
    const { res, latencyMs } = await timedFetch(url);
    if (res.status === 429) return { success: false, provider: "eodhd", symbol, translatedSymbol: translated, error: "Rate limited", reason: "rate_limited" };
    if (!res.ok) return { success: false, provider: "eodhd", symbol, translatedSymbol: translated, error: `HTTP ${res.status}`, reason: "http_error" };

    const data = await res.json() as Record<string, unknown>;
    const price = Number(data.close ?? data.previousClose ?? data.adjusted_close);
    if (!price || !Number.isFinite(price)) return { success: false, provider: "eodhd", symbol, translatedSymbol: translated, error: "Empty price", reason: "empty" };

    const prev = Number(data.previousClose ?? data.previous_close ?? price);
    const change = price - prev;
    const changePct = prev > 0 ? (change / prev) * 100 : 0;

    return {
      success: true, provider: "eodhd", symbol, translatedSymbol: translated,
      assetClass: assetClass ?? "unknown",
      price, change: Math.round(change * 100) / 100, changePercent: Math.round(changePct * 100) / 100,
      volume: Number(data.volume) || null,
      currency: null, exchange: String(data.exchange ?? data.code ?? ""),
      timestamp: data.timestamp ? Number(data.timestamp) * 1000 : Date.now(),
      delayed: false, dataMode: "eod",
    };
  } catch (e) {
    return { success: false, provider: "eodhd", symbol, translatedSymbol: translated, error: e instanceof Error ? e.message : "network error", reason: "network" };
  }
}

export async function getEodhdExchanges(): Promise<Array<{ Name: string; Code: string; Country: string; Currency: string; CountryISO2: string }>> {
  const key = getKey();
  if (!key) return [];
  try {
    const { res } = await timedFetch(`${BASE}/exchanges-list/?api_token=${encodeURIComponent(key)}&fmt=json`);
    if (!res.ok) return [];
    return (await res.json()) as Array<{ Name: string; Code: string; Country: string; Currency: string; CountryISO2: string }>;
  } catch { return []; }
}
