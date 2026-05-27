/**
 * FinancialData.net provider — server-side only.
 * Reads FINANCIALDATA_API_KEY from process.env. Never exposes the key.
 */

const BASE = "https://api.financialdata.net";
const AR_UNAVAILABLE = "مزود FinancialData غير متاح حالياً";

export interface FinancialDataQuote {
  success: true;
  provider: "financialdata";
  symbol: string;
  translatedSymbol: string;
  assetClass: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  timestamp: number;
  delayed: boolean;
  raw: unknown;
}

export interface FinancialDataError {
  success: false;
  provider: "financialdata";
  symbol: string;
  translatedSymbol: string;
  error: string;
  errorAr: string;
  reason: "missing_key" | "http_error" | "empty" | "rate_limited" | "network" | "unsupported";
  latencyMs?: number;
}

function getKey(): string | undefined {
  return process.env.FINANCIALDATA_API_KEY?.trim();
}

export function isFinancialDataConfigured(): boolean {
  return Boolean(getKey());
}

export function financialDataSupportedAssets() {
  return ["stocks", "ETFs", "forex", "crypto_if_supported", "commodities_if_supported", "company_profile_if_available"];
}

export function toFinancialDataSymbol(symbol: string, assetClass?: string): string {
  const s = symbol.trim().toUpperCase();
  if (assetClass === "crypto") return s.replace(/USDT$/, "USD");
  if (assetClass === "forex") return s.replace("/", "");
  return s;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickRow(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload)) return payload[0] && typeof payload[0] === "object" ? payload[0] as Record<string, unknown> : null;
  const obj = payload as Record<string, unknown>;
  for (const key of ["data", "quote", "result", "results"]) {
    const value = obj[key];
    if (Array.isArray(value)) return value[0] && typeof value[0] === "object" ? value[0] as Record<string, unknown> : null;
    if (value && typeof value === "object") return value as Record<string, unknown>;
  }
  return obj;
}

async function timedFetch(url: string, key: string, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${key}`,
        "X-API-Key": key,
      },
    });
    return { res, latencyMs: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}

export async function getFinancialDataQuote(symbol: string, assetClass?: string): Promise<FinancialDataQuote | FinancialDataError> {
  const key = getKey();
  const translated = toFinancialDataSymbol(symbol, assetClass);
  if (!key) return { success: false, provider: "financialdata", symbol, translatedSymbol: translated, error: "FINANCIALDATA_API_KEY not configured", errorAr: AR_UNAVAILABLE, reason: "missing_key" };

  const paths = [
    `${BASE}/v1/quote?symbol=${encodeURIComponent(translated)}&apikey=${encodeURIComponent(key)}`,
    `${BASE}/api/v1/quote?symbol=${encodeURIComponent(translated)}&apikey=${encodeURIComponent(key)}`,
    `${BASE}/api/quote/${encodeURIComponent(translated)}?apikey=${encodeURIComponent(key)}`,
  ];

  let last: FinancialDataError | null = null;
  for (const url of paths) {
    try {
      const { res, latencyMs } = await timedFetch(url, key);
      if (res.status === 429) return { success: false, provider: "financialdata", symbol, translatedSymbol: translated, error: "Rate limited", errorAr: AR_UNAVAILABLE, reason: "rate_limited", latencyMs };
      if (!res.ok) {
        last = { success: false, provider: "financialdata", symbol, translatedSymbol: translated, error: `HTTP ${res.status}`, errorAr: AR_UNAVAILABLE, reason: "http_error", latencyMs };
        continue;
      }

      const payload = await res.json();
      const row = pickRow(payload);
      const price = num(row?.price ?? row?.last ?? row?.close ?? row?.c);
      if (price == null || price <= 0) {
        last = { success: false, provider: "financialdata", symbol, translatedSymbol: translated, error: "Empty price", errorAr: AR_UNAVAILABLE, reason: "empty", latencyMs };
        continue;
      }

      const change = num(row?.change ?? row?.d);
      const changePercent = num(row?.changePercent ?? row?.changesPercentage ?? row?.dp);
      return {
        success: true,
        provider: "financialdata",
        symbol,
        translatedSymbol: translated,
        assetClass: assetClass ?? "unknown",
        price,
        change,
        changePercent,
        volume: num(row?.volume ?? row?.v),
        timestamp: num(row?.timestamp ?? row?.t) ? Number(row?.timestamp ?? row?.t) * 1000 : Date.now(),
        delayed: false,
        raw: row,
      };
    } catch (e) {
      last = { success: false, provider: "financialdata", symbol, translatedSymbol: translated, error: e instanceof Error ? e.message : "network error", errorAr: AR_UNAVAILABLE, reason: "network" };
    }
  }

  return last ?? { success: false, provider: "financialdata", symbol, translatedSymbol: translated, error: "No response", errorAr: AR_UNAVAILABLE, reason: "empty" };
}

export async function getFinancialDataHealth() {
  const start = Date.now();
  const configured = isFinancialDataConfigured();
  if (!configured) {
    return {
      provider: "financialdata",
      configured,
      connected: false,
      supportedAssets: financialDataSupportedAssets(),
      latencyMs: 0,
      lastError: AR_UNAVAILABLE,
      secretsExposed: false,
    };
  }
  const quote = await getFinancialDataQuote("AAPL", "us_stock");
  return {
    provider: "financialdata",
    configured,
    connected: quote.success === true,
    supportedAssets: financialDataSupportedAssets(),
    latencyMs: Date.now() - start,
    lastError: quote.success ? null : quote.errorAr,
    secretsExposed: false,
  };
}
