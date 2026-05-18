import type { MarketConnector, NormalizedQuote } from "./types";

const FX_PAIRS = ["EURUSD","GBPUSD","USDJPY","AUDUSD","USDCAD","USDCHF","NZDUSD"];

export const forexConnector: MarketConnector = {
  assetClass: "forex",
  name: "FX-Aggregate",
  async fetchQuotes(symbols) {
    const list = symbols.length ? symbols : FX_PAIRS;
    const t0 = Date.now();
    try {
      const res = await fetch("https://api.exchangerate.host/latest?base=USD", { cache: "no-store" });
      const json: any = await res.json();
      const rates = json?.rates ?? {};
      const out: NormalizedQuote[] = [];
      for (const p of list) {
        const base = p.slice(0,3), quote = p.slice(3,6);
        const b = rates[base], q = rates[quote];
        if (!b || !q) continue;
        out.push({ symbol: p, assetClass: "forex", price: q / b, ts: Date.now(),
          source: "exchangerate.host", latencyMs: Date.now() - t0 });
      }
      return out;
    } catch {
      return list.map((s) => ({ symbol: s, assetClass: "forex", price: 1, ts: Date.now(), source: "fallback" }));
    }
  },
};
