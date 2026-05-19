// Unified Financial Data Fusion — shared types
export type AssetClass = "equity" | "crypto" | "forex" | "commodity" | "etf";
export type SourceKind = "websocket" | "polling";
export type RegimeName = "trending_bull" | "trending_bear" | "ranging" | "volatile" | "panic" | "recovery" | "euphoria";
export type VolatilityState = "compressed" | "normal" | "elevated" | "explosive";

export interface Quote {
  symbol: string;            // normalized symbol e.g. "BTC-USD"
  provider: string;
  price: number;
  bid?: number;
  ask?: number;
  volume?: number;
  ts: number;                // epoch ms
  assetClass: AssetClass;
}

export interface OHLC {
  symbol: string;
  ts: number;
  o: number; h: number; l: number; c: number; v: number;
}

export interface ProviderHealth {
  provider: string;
  up: boolean;
  latencyMs: number;
  lastTickAgoMs: number;
  errorRate: number;        // 0..1
  confidence: number;       // 0..1
  stale: boolean;
}

export interface FusedQuote extends Quote {
  consensusPrice: number;
  spread: number;           // max-min across providers
  contributingProviders: string[];
  confidence: number;       // 0..1 — quality of fused datum
  anomalyScore: number;     // 0..1
}

export interface MacroOverlay {
  dxy: number;              // dollar index proxy
  yields10y: number;        // 10y yield %
  vix: number;
  oilBrent: number;
  inflationProxy: number;   // YoY %
  riskOn: number;           // -1..1
  updatedAt: number;
}

export interface RegimeSnapshot {
  symbol: string;
  regime: RegimeName;
  volatility: VolatilityState;
  trendStrength: number;    // -1..1
  confidence: number;       // 0..1
  updatedAt: number;
}

export type FusionEvent =
  | { type: "quote"; quote: FusedQuote }
  | { type: "provider:health"; health: ProviderHealth }
  | { type: "provider:failover"; from: string; to: string; symbol: string }
  | { type: "anomaly"; symbol: string; score: number; reason: string }
  | { type: "regime"; snapshot: RegimeSnapshot }
  | { type: "macro"; overlay: MacroOverlay }
  | { type: "stale"; provider: string; symbol: string };
