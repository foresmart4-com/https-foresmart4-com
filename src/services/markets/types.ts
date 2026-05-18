/** Unified market interface — all connectors normalize to this shape. */
export type AssetClass = "crypto" | "forex" | "stocks" | "gold" | "oil" | "indices";

export interface NormalizedQuote {
  symbol: string;
  assetClass: AssetClass;
  price: number;
  bid?: number;
  ask?: number;
  changePct?: number;
  volume?: number;
  ts: number;
  source: string;
  latencyMs?: number;
}

export interface MarketConnector {
  assetClass: AssetClass;
  name: string;
  fetchQuotes(symbols: string[]): Promise<NormalizedQuote[]>;
}
