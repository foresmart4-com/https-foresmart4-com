/**
 * Symbol mapping layer (Phase 10 hardening).
 *
 * Pure, stateless helpers — no module-level mutation. Maps user-facing
 * symbols (e.g. "XAUUSD", "BTC", "TASI") to provider-specific symbols.
 *
 * Keep this file dependency-free so it can be reused by router, history
 * router, and regression tests.
 */

export type ProviderKey =
  | "twelvedata"
  | "alphavantage"
  | "finnhub"
  | "binance"
  | "coingecko";

/** Canonical user input → provider-specific normalizations. */
const STATIC_MAP: Record<string, Partial<Record<ProviderKey, string>> & { canonical?: string }> = {
  // Metals
  XAUUSD:    { canonical: "XAU/USD", twelvedata: "XAU/USD", alphavantage: "XAU",      finnhub: "OANDA:XAU_USD" },
  XAGUSD:    { canonical: "XAG/USD", twelvedata: "XAG/USD", alphavantage: "XAG",      finnhub: "OANDA:XAG_USD" },
  XPTUSD:    { canonical: "XPT/USD", twelvedata: "XPT/USD", alphavantage: "XPT" },
  XPDUSD:    { canonical: "XPD/USD", twelvedata: "XPD/USD", alphavantage: "XPD" },
  GOLD:      { canonical: "XAU/USD", twelvedata: "XAU/USD" },
  SILVER:    { canonical: "XAG/USD", twelvedata: "XAG/USD" },

  // Crypto plain → USDT pair
  BTC:       { canonical: "BTCUSDT", binance: "BTCUSDT", coingecko: "bitcoin",  twelvedata: "BTC/USD" },
  ETH:       { canonical: "ETHUSDT", binance: "ETHUSDT", coingecko: "ethereum", twelvedata: "ETH/USD" },
  SOL:       { canonical: "SOLUSDT", binance: "SOLUSDT", coingecko: "solana",   twelvedata: "SOL/USD" },
  BNB:       { canonical: "BNBUSDT", binance: "BNBUSDT", coingecko: "binancecoin" },

  // Saudi indices
  TASI:      { canonical: "TASI.SR", twelvedata: "TASI" },
  "TASI.SR": { canonical: "TASI.SR", twelvedata: "TASI" },
};

/** Lookup the canonical (display) form for a raw symbol. */
export function canonicalSymbol(raw: string): string {
  const key = raw.trim().toUpperCase();
  return STATIC_MAP[key]?.canonical ?? key;
}

/** Lookup the provider-specific symbol for a raw symbol. */
export function mapForProvider(raw: string, provider: ProviderKey): string {
  const key = raw.trim().toUpperCase();
  const entry = STATIC_MAP[key];
  if (entry && entry[provider]) return entry[provider]!;
  // Saudi tickers stay as-is for TwelveData (e.g. "2222.SR")
  if (/\.SR$/i.test(key)) return key;
  return entry?.canonical ?? key;
}

/** Read-only snapshot for diagnostics / tests. */
export function listMappings(): Readonly<typeof STATIC_MAP> {
  return STATIC_MAP;
}
