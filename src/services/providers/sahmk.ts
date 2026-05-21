/**
 * SAHMK — Saudi market data provider adapter.
 *
 * Server-only. Reads SAHMK_API_KEY from process.env (never exposed to client).
 * Translates internal Saudi symbols (e.g. "2222.SR") to SAHMK form ("2222").
 */

const BASE_URL = "https://app.sahmk.sa/api/v1";

export interface SahmkQuoteRaw {
  price?: number | string;
  change_percent?: number | string;
  volume?: number | string;
  is_delayed?: boolean;
  [k: string]: unknown;
}

export interface SahmkQuote {
  symbol: string;          // SAHMK form (e.g. "2222")
  translatedSymbol: string;
  endpoint: string;
  price: number;
  changePercent: number | null;
  volume: number | null;
  delayed: boolean;
  latencyMs: number;
  raw: SahmkQuoteRaw;
}

export interface SahmkError {
  ok: false;
  reason: "missing_key" | "http_error" | "rate_limited" | "empty" | "network" | "not_implemented";
  message: string;
  httpStatus?: number;
  latencyMs?: number;
  endpoint?: string;
  translatedSymbol?: string;
}

function getKey(): string | null {
  const k = process.env.SAHMK_API_KEY;
  return k && k.trim().length > 0 ? k.trim() : null;
}

/** Convert "2222.SR" → "2222". Any non-.SR symbol returned unchanged (trimmed). */
export function toSahmkSymbol(input: string): string {
  return (input ?? "").trim().toUpperCase().replace(/\.SR$/i, "");
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function timedFetch(url: string, init: RequestInit, timeoutMs = 7000): Promise<{ res: Response; latencyMs: number }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    return { res, latencyMs: Date.now() - start };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Fetch a single SAHMK quote.
 * Returns SahmkQuote on success or SahmkError otherwise. Never throws.
 */
export async function getSahmkQuote(symbol: string): Promise<SahmkQuote | SahmkError> {
  const key = getKey();
  const translated = toSahmkSymbol(symbol);
  const endpoint = `${BASE_URL}/quote/${encodeURIComponent(translated)}/`;

  if (!key) {
    return { ok: false, reason: "missing_key", message: "SAHMK_API_KEY not configured", endpoint, translatedSymbol: translated };
  }
  if (!translated) {
    return { ok: false, reason: "empty", message: "empty symbol", endpoint, translatedSymbol: translated };
  }

  try {
    const { res, latencyMs } = await timedFetch(endpoint, {
      headers: { "X-API-Key": key, Accept: "application/json" },
    });
    if (res.status === 429) {
      return { ok: false, reason: "rate_limited", message: "SAHMK rate limit", httpStatus: 429, latencyMs, endpoint, translatedSymbol: translated };
    }
    if (!res.ok) {
      return { ok: false, reason: "http_error", message: `SAHMK HTTP ${res.status}`, httpStatus: res.status, latencyMs, endpoint, translatedSymbol: translated };
    }
    const j = (await res.json()) as SahmkQuoteRaw;
    const price = num(j.price);
    if (price == null) {
      return { ok: false, reason: "empty", message: "SAHMK empty quote", httpStatus: res.status, latencyMs, endpoint, translatedSymbol: translated };
    }
    return {
      symbol: translated,
      translatedSymbol: translated,
      endpoint,
      price,
      changePercent: num(j.change_percent),
      volume: num(j.volume),
      delayed: j.is_delayed === true,
      latencyMs,
      raw: j,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "network error";
    return { ok: false, reason: "network", message, endpoint, translatedSymbol: translated };
  }
}

/**
 * Placeholder for historical candles. SAHMK plan tier may not include this —
 * we expose the endpoint shape but return "not_implemented" by default so
 * the router can fall through to TwelveData history.
 */
export async function getSahmkHistory(symbol: string): Promise<SahmkError> {
  const translated = toSahmkSymbol(symbol);
  const endpoint = `${BASE_URL}/historical/${encodeURIComponent(translated)}/`;
  return {
    ok: false,
    reason: "not_implemented",
    message: "SAHMK historical not enabled on current plan",
    endpoint,
    translatedSymbol: translated,
  };
}
