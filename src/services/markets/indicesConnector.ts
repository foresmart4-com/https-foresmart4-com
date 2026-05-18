import type { MarketConnector, NormalizedQuote } from "./types";

export const indicesConnector: MarketConnector = {
  assetClass: "indices",
  name: "Indices-Aggregate",
  async fetchQuotes(symbols) {
    const list = symbols.length ? symbols : ["SPX","NDX","DJI","DAX","FTSE","N225"];
    const t0 = Date.now();
    return list.map((s, i) => ({
      symbol: s, assetClass: "indices",
      price: 4000 + i * 500 + Math.cos(Date.now()/1e5 + i) * 25,
      changePct: Math.cos(Date.now()/8e4 + i) * 0.6,
      ts: Date.now(), source: "stub", latencyMs: Date.now() - t0,
    }));
  },
};

export const oilConnector: MarketConnector = {
  assetClass: "oil",
  name: "Energy-Aggregate",
  async fetchQuotes() {
    const t0 = Date.now();
    return [
      { symbol: "WTI", assetClass: "oil", price: 78 + Math.sin(Date.now()/1e5)*1.5,
        ts: Date.now(), source: "stub", latencyMs: Date.now() - t0 },
      { symbol: "BRENT", assetClass: "oil", price: 82 + Math.cos(Date.now()/1e5)*1.5,
        ts: Date.now(), source: "stub", latencyMs: Date.now() - t0 },
    ];
  },
};
