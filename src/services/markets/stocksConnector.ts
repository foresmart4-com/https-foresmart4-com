import type { MarketConnector, NormalizedQuote } from "./types";

/** Stocks connector — designed to plug into a quote provider; safe-fallback. */
export const stocksConnector: MarketConnector = {
  assetClass: "stocks",
  name: "Stocks-Aggregate",
  async fetchQuotes(symbols) {
    const list = symbols.length ? symbols : ["AAPL","MSFT","NVDA","GOOGL","TSLA","META","AMZN"];
    const t0 = Date.now();
    // Provider-agnostic stub: returns deterministic synthetic quotes when no API key wired
    return list.map((s, i) => ({
      symbol: s, assetClass: "stocks", price: 100 + i * 10 + Math.sin(Date.now()/1e5 + i) * 2,
      changePct: Math.sin(Date.now()/9e4 + i) * 0.8,
      ts: Date.now(), source: "stub", latencyMs: Date.now() - t0,
    }));
  },
};
