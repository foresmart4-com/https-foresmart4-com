// Shared types for the global opportunity scanner.
export type AssetClass = "equities" | "crypto" | "forex" | "commodities";
export type EventClass = "macro" | "geopolitical" | "weather" | "earnings" | "cb_speech" | "breaking_news";
export type Bias = "bullish" | "bearish" | "neutral";

export interface RawFeed {
  id: string;
  ts: number;
  source: string;
  category: AssetClass | EventClass;
  symbol?: string;
  headline: string;
  payload?: Record<string, number | string | boolean>;
  importance: number;     // 0..1
  bias: Bias;
}

export interface Scenario { label: string; probability: number; payoff: number; }

export interface FlowSignal {
  symbol: string;
  netFlow: number;        // -1..1 (negative = outflow)
  conviction: number;     // 0..1
  drivers: string[];
}

export interface CorrelationLink {
  symbol: string;
  partner: string;
  correlation: number;    // -1..1
  meaning: string;
}

export interface OpportunityCard {
  id: string;
  assetClass: AssetClass;
  symbol: string;
  assetName: string;
  bias: Bias;
  urgency: number;            // 0..100
  confidence: number;         // 0..100
  expectedReturn: number;     // % over horizon
  riskScore: number;          // 0..100
  riskAdjustedScore: number;  // 0..100
  horizonHrs: number;
  drivers: string[];
  scenarios: Scenario[];
  impactForecast: { window: "1h" | "1d" | "1w"; magnitude: number; direction: Bias }[];
  correlations: CorrelationLink[];
  flowAlignment: FlowSignal | null;
  portfolioFit: {
    diversifies: boolean;
    concentrationRisk: number; // 0..1
    suggestedAllocPct: number; // 0..100
  };
  reasoning: string;
  ts: number;
}

export interface ProactiveAlert {
  id: string;
  ts: number;
  severity: "info" | "watch" | "high" | "critical";
  title: string;
  detail: string;
  symbols: string[];
  source: "anomaly" | "flow" | "correlation" | "geopolitical" | "macro" | "weather" | "news";
}

export interface ScannerSnapshot {
  generatedAt: number;
  opportunities: OpportunityCard[];
  alerts: ProactiveAlert[];
  feedsSummary: { source: string; events: number }[];
  metrics: {
    feedCount: number;
    highUrgency: number;
    riskAdjustedAvg: number;
    bullish: number;
    bearish: number;
    neutral: number;
  };
}
