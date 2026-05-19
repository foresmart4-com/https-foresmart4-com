// Global Intelligence — shared type system.
export type Region = "US" | "EU" | "MENA" | "ASIA" | "GLOBAL" | "LATAM";
export type AssetClass = "equity" | "crypto" | "fx" | "commodity" | "bond" | "index";
export type Severity = "low" | "medium" | "high" | "critical";
export type Bias = "bullish" | "bearish" | "neutral";

export interface RawSignal {
  source: string;            // "binance" | "coingecko" | "newsapi" | "noaa" | ...
  category: "market" | "geopolitical" | "economic" | "weather" | "commodity" | "crypto" | "news" | "social";
  region?: Region;
  symbol?: string;
  title: string;
  payload: Record<string, unknown>;
  timestamp: number;
  reliability: number;       // 0..1 source-level reliability
}

export interface GeoEvent {
  id: string;
  kind: "war" | "sanctions" | "election" | "cb_speech" | "opec" | "instability" | "trade";
  region: Region;
  headline: string;
  severity: Severity;
  marketImpact: Bias;
  affected: string[];        // asset keys: oil, gold, sp500, usd...
  confidence: number;        // 0..1
  ts: number;
}

export interface EconEvent {
  id: string;
  indicator: "CPI" | "GDP" | "UNEMPLOYMENT" | "RATE" | "OIL_INV" | "BOND_10Y" | "INFLATION";
  region: Region;
  value: number;
  prior?: number;
  surprise?: number;         // value - consensus
  marketImpact: Bias;
  ts: number;
}

export interface WeatherEvent {
  id: string;
  kind: "hurricane" | "flood" | "drought" | "heatwave" | "freeze";
  region: Region;
  severity: Severity;
  supplyChainRisk: number;   // 0..1
  affectedCommodities: string[]; // "oil","wheat","natgas"...
  ts: number;
}

export interface Opportunity {
  id: string;
  asset: string;
  assetName: string;
  kind: "breakout" | "mean_revert" | "macro_tailwind" | "event_driven" | "supply_shock";
  bias: Bias;
  confidence: number;        // 0..1 calibrated
  expectedReturn: number;    // % horizon
  risk: number;              // 0..1
  horizonHrs: number;
  drivers: string[];         // human-readable
  scenarios: Array<{ label: string; probability: number; payoff: number }>;
  ts: number;
}

export interface AgentVote {
  agent: "macro" | "geo" | "weather" | "technical" | "sentiment" | "quant" | "portfolio";
  bias: Bias;
  confidence: number;
  weight: number;
  rationale: string;
}

export interface ConsensusDecision {
  symbol: string;
  bias: Bias;
  score: number;            // weighted, -1..1
  confidence: number;       // 0..1 calibrated
  uncertainty: number;      // 0..1 entropy
  votes: AgentVote[];
  conflict: number;         // 0..1 disagreement
}

export interface ExplainPacket {
  summary: string;
  drivers: { market: string[]; geo: string[]; econ: string[]; weather: string[] };
  risks: string[];
  scenarios: Array<{ label: string; probability: number; payoff: number; narrative: string }>;
  confidence: number;
}

export interface AccuracyMetrics {
  hitRate: number;
  brier: number;
  drift: number;             // 0..1
  hallucinationRate: number; // 0..1
  sampleSize: number;
}

export interface GlobalIntelSnapshot {
  generatedAt: number;
  ingestion: { sources: number; eventsLastHour: number; latencyMs: number };
  geoEvents: GeoEvent[];
  econEvents: EconEvent[];
  weatherEvents: WeatherEvent[];
  opportunities: Opportunity[];
  consensus: ConsensusDecision[];
  accuracy: AccuracyMetrics;
}
