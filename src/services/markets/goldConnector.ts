import type { MarketConnector, NormalizedQuote } from "./types";

export const goldConnector: MarketConnector = {
  assetClass: "gold",
  name: "Metals-Aggregate",
  async fetchQuotes() {
    const t0 = Date.now();
    try {
      const res = await fetch("https://api.exchangerate.host/latest?base=XAU&symbols=USD", { cache: "no-store" });
      const json: any = await res.json();
      const px = json?.rates?.USD;
      const xagRes = await fetch("https://api.exchangerate.host/latest?base=XAG&symbols=USD", { cache: "no-store" });
      const xagJson: any = await xagRes.json();
      const out: NormalizedQuote[] = [];
      if (px) out.push({ symbol: "XAUUSD", assetClass: "gold", price: px, ts: Date.now(),
        source: "exchangerate.host", latencyMs: Date.now() - t0 });
      const ag = xagJson?.rates?.USD;
      if (ag) out.push({ symbol: "XAGUSD", assetClass: "gold", price: ag, ts: Date.now(),
        source: "exchangerate.host", latencyMs: Date.now() - t0 });
      return out;
    } catch {
      return [{ symbol: "XAUUSD", assetClass: "gold", price: 2300, ts: Date.now(), source: "fallback" }];
    }
  },
};
