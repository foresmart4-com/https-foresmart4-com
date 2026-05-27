/**
 * CommodityPriceAPI normalized adapter (router-shape envelope).
 *
 * Server-only. Reads COMMODITYPRICE_API_KEY (preferred) and falls back to
 * COMMODITYPRICEAPI_KEY for backwards compatibility.
 *
 * Symbol coverage:
 *   XAGUSD / XAG / SILVER       → XAG  (metal)
 *   XAUUSD / XAU / GOLD         → XAU  (metal)
 *   WTI / USOIL / CL            → WTI  (commodity)
 *   BRENT / UKOIL               → BRENT (commodity)
 *   NATGAS / NG / NATURAL_GAS   → NG   (commodity)
 *
 * Returns a router-aligned envelope. Never throws — all failures surface as
 * { success: false, error }. Synthetic prices are NEVER reported as "live".
 */

const ENDPOINT = "https://api.commoditypriceapi.com/v2/rates/latest";

const SYMBOL_MAP: Record<string, { code: string; apiCode: string; assetClass: "metal" | "commodity" }> = {
  XAGUSD: { code: "XAG", apiCode: "XAG", assetClass: "metal" },
  XAG: { code: "XAG", apiCode: "XAG", assetClass: "metal" },
  SILVER: { code: "XAG", apiCode: "XAG", assetClass: "metal" },
  XAUUSD: { code: "XAU", apiCode: "XAU", assetClass: "metal" },
  XAU: { code: "XAU", apiCode: "XAU", assetClass: "metal" },
  GOLD: { code: "XAU", apiCode: "XAU", assetClass: "metal" },
  WTI: { code: "WTI", apiCode: "WTIOIL-FUT", assetClass: "commodity" },
  USOIL: { code: "WTI", apiCode: "WTIOIL-FUT", assetClass: "commodity" },
  CL: { code: "WTI", apiCode: "WTIOIL-FUT", assetClass: "commodity" },
  BRENT: { code: "BRENT", apiCode: "BRENTOIL-FUT", assetClass: "commodity" },
  UKOIL: { code: "BRENT", apiCode: "BRENTOIL-FUT", assetClass: "commodity" },
  NATGAS: { code: "NATGAS", apiCode: "NG-FUT", assetClass: "commodity" },
  NG: { code: "NATGAS", apiCode: "NG-FUT", assetClass: "commodity" },
  NATURAL_GAS: { code: "NATGAS", apiCode: "NG-FUT", assetClass: "commodity" },
};

export interface CommodityPriceQuote {
  success: true;
  provider: "commodityprice";
  mode: "live" | "delayed";
  price: number;
  change: number | null;
  changePercent: number | null;
  volume: null;
  timestamp: number;
  delayed: boolean;
  symbol: string;
  translatedSymbol: string;
  assetClass: "metal" | "commodity";
  fallbackUsed: false;
  latencyMs: number;
}

export interface CommodityPriceError {
  success: false;
  provider: "commodityprice";
  error: string;
  reason:
    | "missing_key"
    | "unsupported_symbol"
    | "rate_limited"
    | "http_error"
    | "invalid_response"
    | "network"
    | "empty";
  httpStatus?: number;
  latencyMs?: number;
  translatedSymbol?: string;
}

function getKey(): string | null {
  const k = process.env.COMMODITYPRICE_API_KEY ?? process.env.COMMODITYPRICEAPI_KEY;
  return k && k.trim() ? k.trim() : null;
}

export function toCommodityPriceSymbol(input: string): { code: string; apiCode: string; assetClass: "metal" | "commodity" } | null {
  const s = (input ?? "").trim().toUpperCase();
  return SYMBOL_MAP[s] ?? null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function getCommodityQuote(
  symbol: string,
): Promise<CommodityPriceQuote | CommodityPriceError> {
  const key = getKey();
  const mapped = toCommodityPriceSymbol(symbol);

  if (!key) {
    return {
      success: false,
      provider: "commodityprice",
      reason: "missing_key",
      error: "COMMODITYPRICE_API_KEY not configured",
    };
  }
  if (!mapped) {
    return {
      success: false,
      provider: "commodityprice",
      reason: "unsupported_symbol",
      error: `unsupported symbol: ${symbol}`,
    };
  }

  const url = `${ENDPOINT}?symbols=${encodeURIComponent(mapped.apiCode)}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "x-api-key": key },
    });
    const latencyMs = Date.now() - start;

    if (res.status === 429) {
      return {
        success: false,
        provider: "commodityprice",
        reason: "rate_limited",
        error: "rate limited",
        httpStatus: 429,
        latencyMs,
        translatedSymbol: mapped.code,
      };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        provider: "commodityprice",
        reason: "missing_key",
        error: `auth failed (HTTP ${res.status})`,
        httpStatus: res.status,
        latencyMs,
        translatedSymbol: mapped.code,
      };
    }

    const ctype = res.headers.get("content-type") || "";
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      return {
        success: false,
        provider: "commodityprice",
        reason: "http_error",
        error: `HTTP ${res.status}`,
        httpStatus: res.status,
        latencyMs,
        translatedSymbol: mapped.code,
      };
    }
    if (!ctype.includes("application/json") && !text.trim().startsWith("{")) {
      return {
        success: false,
        provider: "commodityprice",
        reason: "invalid_response",
        error: "non-json response",
        latencyMs,
        translatedSymbol: mapped.code,
      };
    }

    let j: {
      success?: boolean;
      timestamp?: number;
      rates?: Record<string, number>;
      data?: Record<string, { price?: number; change?: number; change_percent?: number }>;
      error?: { message?: string };
    };
    try {
      j = JSON.parse(text);
    } catch {
      return {
        success: false,
        provider: "commodityprice",
        reason: "invalid_response",
        error: "json parse failed",
        latencyMs,
        translatedSymbol: mapped.code,
      };
    }

    let price: number | null = null;
    let change: number | null = null;
    let changePercent: number | null = null;
    if (j.rates && typeof j.rates[mapped.apiCode] === "number") {
      price = j.rates[mapped.apiCode];
    }
    if (j.data && j.data[mapped.apiCode]) {
      price = price ?? num(j.data[mapped.apiCode].price);
      change = num(j.data[mapped.apiCode].change);
      changePercent = num(j.data[mapped.apiCode].change_percent);
    }

    if (price == null || !Number.isFinite(price) || price <= 0) {
      return {
        success: false,
        provider: "commodityprice",
        reason: "empty",
        error: j.error?.message ?? "empty quote",
        latencyMs,
        translatedSymbol: mapped.code,
      };
    }

    // Commodities REST snapshots are intraday delayed; never claim "live".
    const delayed = true;
    return {
      success: true,
      provider: "commodityprice",
      mode: delayed ? "delayed" : "live",
      price,
      change,
      changePercent,
      volume: null,
      timestamp: j.timestamp ? j.timestamp * 1000 : Date.now(),
      delayed,
      symbol: symbol.toUpperCase(),
      translatedSymbol: mapped.code,
      assetClass: mapped.assetClass,
      fallbackUsed: false,
      latencyMs,
    };
  } catch (e) {
    return {
      success: false,
      provider: "commodityprice",
      reason: "network",
      error: e instanceof Error ? e.message : "network error",
      latencyMs: Date.now() - start,
      translatedSymbol: mapped.code,
    };
  } finally {
    clearTimeout(t);
  }
}

export const getCommodityPriceQuote = getCommodityQuote;

export function providerHealth() {
  const configured = !!getKey();
  return {
    provider: "commodityprice" as const,
    status: configured ? "healthy" as const : "down" as const,
    errorRate: 0,
    rateLimited: 0,
    avgLatencyMs: null,
    endpoints: [],
    configured,
    failoverScore: configured ? 0.75 : 0,
    quoteConfidence: configured ? 0.7 : 0.1,
    role: "commodity-metals" as const,
    generatedAt: Date.now(),
  };
}
