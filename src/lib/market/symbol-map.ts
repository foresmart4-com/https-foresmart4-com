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
  | "tradingview"
  | "sahmk"
  | "fmp"
  | "commodityprice"
  | "fred"
  | "yahoo";


interface SymbolEntry extends Partial<Record<ProviderKey, string>> {
  canonical?: string;
}

/** Canonical user input → provider-specific normalizations. */
const STATIC_MAP: Record<string, SymbolEntry> = {
  // ---------- Metals ----------
  XAUUSD: { canonical: "XAU/USD", twelvedata: "XAU/USD", finnhub: "OANDA:XAU_USD", alphavantage: "XAUUSD", tradingview: "OANDA:XAUUSD", commodityprice: "XAU" },
  XAGUSD: { canonical: "XAG/USD", twelvedata: "XAG/USD", finnhub: "OANDA:XAG_USD", alphavantage: "XAGUSD", tradingview: "OANDA:XAGUSD", commodityprice: "XAG" },
  XPTUSD: { canonical: "XPT/USD", twelvedata: "XPT/USD", alphavantage: "XPTUSD", tradingview: "TVC:PLATINUM", commodityprice: "XPT" },
  XPDUSD: { canonical: "XPD/USD", twelvedata: "XPD/USD", alphavantage: "XPDUSD", tradingview: "TVC:PALLADIUM", commodityprice: "XPD" },
  GOLD:   { canonical: "XAU/USD", twelvedata: "XAU/USD", finnhub: "OANDA:XAU_USD", alphavantage: "XAUUSD", tradingview: "OANDA:XAUUSD", commodityprice: "XAU" },
  SILVER: { canonical: "XAG/USD", twelvedata: "XAG/USD", finnhub: "OANDA:XAG_USD", alphavantage: "XAGUSD", tradingview: "OANDA:XAGUSD", commodityprice: "XAG" },

  // ---------- Oil / commodities ----------
  USOIL:  { canonical: "USOIL",   twelvedata: "CL=F",    finnhub: "OANDA:BCO_USD",   alphavantage: "WTI",         tradingview: "TVC:USOIL", commodityprice: "WTI" },
  WTI:    { canonical: "USOIL",   twelvedata: "CL=F",    finnhub: "OANDA:WTICO_USD", alphavantage: "WTI",         tradingview: "TVC:USOIL", commodityprice: "WTI" },
  BRENT:  { canonical: "BRENT",   twelvedata: "BZ=F",    finnhub: "OANDA:BCO_USD",   alphavantage: "BRENT",       tradingview: "TVC:UKOIL", commodityprice: "BRENT" },
  UKOIL:  { canonical: "BRENT",   twelvedata: "BZ=F",    finnhub: "OANDA:BCO_USD",   alphavantage: "BRENT",       tradingview: "TVC:UKOIL", commodityprice: "BRENT" },
  NATGAS: { canonical: "NATGAS",  twelvedata: "NG=F",    alphavantage: "NATURAL_GAS", tradingview: "NYMEX:NG1!",  commodityprice: "NATGAS" },
  NG:     { canonical: "NATGAS",  twelvedata: "NG=F",    alphavantage: "NATURAL_GAS", tradingview: "NYMEX:NG1!",  commodityprice: "NATGAS" },
  COPPER: { canonical: "COPPER",  twelvedata: "HG=F",    alphavantage: "COPPER",      tradingview: "COMEX:HG1!" },

  // ---------- Crypto ----------
  BTC: { canonical: "BTCUSDT", binance: "BTCUSDT", coingecko: "bitcoin",     twelvedata: "BTC/USD", tradingview: "BINANCE:BTCUSDT" },
  ETH: { canonical: "ETHUSDT", binance: "ETHUSDT", coingecko: "ethereum",    twelvedata: "ETH/USD", tradingview: "BINANCE:ETHUSDT" },
  SOL: { canonical: "SOLUSDT", binance: "SOLUSDT", coingecko: "solana",      twelvedata: "SOL/USD", tradingview: "BINANCE:SOLUSDT" },
  BNB: { canonical: "BNBUSDT", binance: "BNBUSDT", coingecko: "binancecoin", tradingview: "BINANCE:BNBUSDT" },
  XRP: { canonical: "XRPUSDT", binance: "XRPUSDT", coingecko: "ripple",      tradingview: "BINANCE:XRPUSDT" },
  ADA: { canonical: "ADAUSDT", binance: "ADAUSDT", coingecko: "cardano",     tradingview: "BINANCE:ADAUSDT" },
  DOGE:{ canonical: "DOGEUSDT",binance: "DOGEUSDT",coingecko: "dogecoin",    tradingview: "BINANCE:DOGEUSDT" },
  AVAX:{ canonical: "AVAXUSDT",binance: "AVAXUSDT",coingecko: "avalanche-2", tradingview: "BINANCE:AVAXUSDT" },
  MATIC:{canonical: "MATICUSDT",binance:"MATICUSDT",coingecko:"matic-network",tradingview: "BINANCE:MATICUSDT" },
  DOT: { canonical: "DOTUSDT", binance: "DOTUSDT", coingecko: "polkadot",    tradingview: "BINANCE:DOTUSDT" },
  LTC: { canonical: "LTCUSDT", binance: "LTCUSDT", coingecko: "litecoin",    tradingview: "BINANCE:LTCUSDT" },
  LINK:{ canonical: "LINKUSDT",binance: "LINKUSDT",coingecko: "chainlink",   tradingview: "BINANCE:LINKUSDT" },

  // ---------- Saudi indices ----------
  TASI:      { canonical: "TASI.SR", twelvedata: "TASI", alphavantage: "TASI.SR", tradingview: "TVC:TASI" },
  "TASI.SR": { canonical: "TASI.SR", twelvedata: "TASI", alphavantage: "TASI.SR", tradingview: "TVC:TASI" },
  // ---------- Hong Kong ----------
  "0700.HK": { canonical: "0700.HK", fmp: "0700.HK", twelvedata: "0700.HK", alphavantage: "0700.HK" },
  "700.HK": { canonical: "0700.HK", fmp: "0700.HK", twelvedata: "0700.HK", alphavantage: "0700.HK" },
  "9988.HK": { canonical: "9988.HK", fmp: "9988.HK", twelvedata: "9988.HK", alphavantage: "9988.HK" },
  "1299.HK": { canonical: "1299.HK", fmp: "1299.HK", twelvedata: "1299.HK", alphavantage: "1299.HK" },
  "0005.HK": { canonical: "0005.HK", fmp: "0005.HK", twelvedata: "0005.HK", alphavantage: "0005.HK" },

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
    if (provider === "sahmk") return key.replace(/\.SR$/i, "");
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
