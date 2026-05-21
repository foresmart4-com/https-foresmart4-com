/**
 * Provider Symbol Translation Layer.
 *
 * Pure, stateless helpers — no module-level mutation. Maps internal/canonical
 * user-facing symbols (e.g. "XAUUSD", "BTC", "2222.SR", "USOIL") to the exact
 * string each provider's API expects.
 *
 * Contract:
 *  - `translateSymbol(symbol, provider)` ALWAYS returns a non-empty string.
 *    If no explicit mapping exists, the canonical form (or the raw input) is
 *    returned — never throws, never returns "". This guarantees the router
 *    can fall through to the next provider without the translation layer
 *    itself failing the whole request.
 *
 * Keep this file dependency-free so it can be reused by router, history
 * router, regression tests, and the public diagnostics endpoint.
 */

export type ProviderKey =
  | "twelvedata"
  | "alphavantage"
  | "finnhub"
  | "binance"
  | "coingecko"
  | "alpaca"
  | "tradingview";

interface SymbolEntry extends Partial<Record<ProviderKey, string>> {
  canonical?: string;
}

/** Canonical user input → provider-specific normalizations. */
const STATIC_MAP: Record<string, SymbolEntry> = {
  // ---------- Metals ----------
  XAUUSD: { canonical: "XAU/USD", twelvedata: "XAU/USD", finnhub: "OANDA:XAU_USD", alphavantage: "XAUUSD" },
  XAGUSD: { canonical: "XAG/USD", twelvedata: "XAG/USD", finnhub: "OANDA:XAG_USD", alphavantage: "XAGUSD" },
  XPTUSD: { canonical: "XPT/USD", twelvedata: "XPT/USD", alphavantage: "XPTUSD" },
  XPDUSD: { canonical: "XPD/USD", twelvedata: "XPD/USD", alphavantage: "XPDUSD" },
  GOLD:   { canonical: "XAU/USD", twelvedata: "XAU/USD", finnhub: "OANDA:XAU_USD", alphavantage: "XAUUSD" },
  SILVER: { canonical: "XAG/USD", twelvedata: "XAG/USD", finnhub: "OANDA:XAG_USD", alphavantage: "XAGUSD" },

  // ---------- Oil / commodities ----------
  USOIL:  { canonical: "USOIL",   twelvedata: "CL=F",    finnhub: "OANDA:BCO_USD", alphavantage: "WTI" },
  WTI:    { canonical: "USOIL",   twelvedata: "CL=F",    finnhub: "OANDA:WTICO_USD", alphavantage: "WTI" },
  BRENT:  { canonical: "BRENT",   twelvedata: "BZ=F",    finnhub: "OANDA:BCO_USD", alphavantage: "BRENT" },
  NATGAS: { canonical: "NATGAS",  twelvedata: "NG=F",    alphavantage: "NATURAL_GAS" },
  COPPER: { canonical: "COPPER",  twelvedata: "HG=F",    alphavantage: "COPPER" },

  // ---------- Crypto ----------
  BTC: { canonical: "BTCUSDT", binance: "BTCUSDT", coingecko: "bitcoin",     twelvedata: "BTC/USD" },
  ETH: { canonical: "ETHUSDT", binance: "ETHUSDT", coingecko: "ethereum",    twelvedata: "ETH/USD" },
  SOL: { canonical: "SOLUSDT", binance: "SOLUSDT", coingecko: "solana",      twelvedata: "SOL/USD" },
  BNB: { canonical: "BNBUSDT", binance: "BNBUSDT", coingecko: "binancecoin" },
  XRP: { canonical: "XRPUSDT", binance: "XRPUSDT", coingecko: "ripple" },
  ADA: { canonical: "ADAUSDT", binance: "ADAUSDT", coingecko: "cardano" },
  DOGE:{ canonical: "DOGEUSDT",binance: "DOGEUSDT",coingecko: "dogecoin" },
  AVAX:{ canonical: "AVAXUSDT",binance: "AVAXUSDT",coingecko: "avalanche-2" },
  MATIC:{canonical: "MATICUSDT",binance:"MATICUSDT",coingecko:"matic-network" },
  DOT: { canonical: "DOTUSDT", binance: "DOTUSDT", coingecko: "polkadot" },
  LTC: { canonical: "LTCUSDT", binance: "LTCUSDT", coingecko: "litecoin" },
  LINK:{ canonical: "LINKUSDT",binance: "LINKUSDT",coingecko: "chainlink" },

  // ---------- Saudi indices ----------
  TASI:      { canonical: "TASI.SR", twelvedata: "TASI",    alphavantage: "TASI.SR" },
  "TASI.SR": { canonical: "TASI.SR", twelvedata: "TASI",    alphavantage: "TASI.SR" },
};

/** Lookup the canonical (display) form for a raw symbol. */
export function canonicalSymbol(raw: string): string {
  const key = (raw ?? "").trim().toUpperCase();
  if (!key) return "";
  return STATIC_MAP[key]?.canonical ?? key;
}

/**
 * Translate a user/internal symbol to the exact form a provider's API expects.
 *
 * Never throws and never returns "". Falls back to canonical → raw input so
 * a missing mapping degrades gracefully and the router can still try the
 * provider (or fail it cleanly and move on to the next one).
 */
export function translateSymbol(symbol: string, provider: ProviderKey): string {
  const raw = (symbol ?? "").trim();
  if (!raw) return "";
  const key = raw.toUpperCase();
  const entry = STATIC_MAP[key];

  if (entry?.[provider]) return entry[provider]!;

  // Saudi tickers (e.g. "2222.SR")
  if (/\.SR$/i.test(key)) {
    if (provider === "twelvedata") return key.replace(/\.SR$/i, ":SAU");
    return key; // AlphaVantage uses .SR; others stay as-is
  }

  // Crypto pair like "BTCUSDT" → coingecko id where possible
  const cryptoPair = key.match(/^([A-Z0-9]{2,8})(USDT|USDC|BUSD|USD)$/);
  if (cryptoPair) {
    const base = cryptoPair[1];
    const baseEntry = STATIC_MAP[base];
    if (baseEntry?.[provider]) return baseEntry[provider]!;
    if (provider === "binance") return `${base}USDT`;
  }

  // Forex pair like "EURUSD" → "EUR/USD" for twelvedata
  if (/^[A-Z]{6}$/.test(key) && provider === "twelvedata") {
    return `${key.slice(0, 3)}/${key.slice(3)}`;
  }

  return entry?.canonical ?? raw;
}

/** Back-compat alias kept for existing callers. */
export function mapForProvider(raw: string, provider: ProviderKey): string {
  return translateSymbol(raw, provider);
}

/** Read-only snapshot for diagnostics / tests. */
export function listMappings(): Readonly<typeof STATIC_MAP> {
  return STATIC_MAP;
}
