// Symbol normalization across providers and asset classes.
// Strategy: build canonical "BASE-QUOTE" or "TICKER" with asset class tag.
import type { AssetClass } from "./types";

const CRYPTO_QUOTES = ["USDT", "USDC", "USD", "BUSD", "EUR", "BTC", "ETH"];
const FOREX_PAIRS = new Set([
  "EURUSD", "USDJPY", "GBPUSD", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD",
  "EURJPY", "EURGBP", "GBPJPY", "XAUUSD", "XAGUSD",
]);
const COMMODITY_ALIASES: Record<string, string> = {
  XAUUSD: "GOLD-USD", GOLD: "GOLD-USD",
  XAGUSD: "SILVER-USD", SILVER: "SILVER-USD",
  WTI: "OIL-WTI", USOIL: "OIL-WTI", BRENT: "OIL-BRENT", UKOIL: "OIL-BRENT",
  NATGAS: "NATGAS", NG: "NATGAS",
};
const ETF_TICKERS = new Set(["SPY", "QQQ", "IWM", "DIA", "VTI", "EEM", "GLD", "SLV", "USO", "TLT", "HYG"]);

export interface NormalizedSymbol {
  canonical: string;
  base?: string;
  quote?: string;
  assetClass: AssetClass;
}

function clean(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s_/.:]+/g, "");
}

export function normalizeSymbol(raw: string, hint?: AssetClass): NormalizedSymbol {
  const s = clean(raw);

  if (COMMODITY_ALIASES[s]) {
    const canonical = COMMODITY_ALIASES[s];
    return { canonical, assetClass: "commodity" };
  }
  if (hint === "forex" || FOREX_PAIRS.has(s)) {
    if (s.length === 6) {
      const base = s.slice(0, 3), quote = s.slice(3);
      return { canonical: `${base}-${quote}`, base, quote, assetClass: "forex" };
    }
  }
  if (hint === "crypto" || s.endsWith("USDT") || s.endsWith("USDC") || s.endsWith("BUSD")) {
    for (const q of CRYPTO_QUOTES) {
      if (s.endsWith(q) && s.length > q.length) {
        const base = s.slice(0, s.length - q.length);
        const quote = q === "USDT" || q === "USDC" || q === "BUSD" ? "USD" : q;
        return { canonical: `${base}-${quote}`, base, quote, assetClass: "crypto" };
      }
    }
  }
  if (hint === "etf" || ETF_TICKERS.has(s)) {
    return { canonical: s, assetClass: "etf" };
  }
  // default: equity ticker
  return { canonical: s, assetClass: hint ?? "equity" };
}

export function providerSymbol(canonical: string, provider: string): string {
  const [base, quote] = canonical.split("-");
  if (provider === "commodityprice") {
    if (canonical === "SILVER-USD") return "XAG";
    if (canonical === "OIL-WTI") return "WTI";
    if (canonical === "OIL-BRENT") return "BRENT";
    if (canonical === "NATGAS") return "NATGAS";
    return canonical;
  }
  if (!quote) return canonical;
  switch (provider) {
    case "binance":      return `${base}${quote === "USD" ? "USDT" : quote}`;
    case "coinbase":     return `${base}-${quote}`;
    case "oanda":
    case "fxcm":         return `${base}${quote}`;
    case "polygon":
    case "iex":
    case "alpaca":       return base;
    default:             return canonical;
  }
}
