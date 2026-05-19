// Shared types for the AI validation & performance layer.
export type Direction = "up" | "down" | "flat";
export type Action = "buy" | "sell" | "hold";

export interface RecommendationRecord {
  id: string;
  ts: number;
  symbol: string;
  agent: string;            // macro | technical | quant | sentiment | portfolio | strategy | global
  regime?: string;          // optional regime label
  action: Action;
  predictedDirection: Direction;
  confidence: number;       // 0..100
  entryPrice: number;
  horizonHrs: number;       // expected resolution window
  source?: string;          // free-text source (e.g. "decision-engine")
}

export interface OutcomeRecord {
  id: string;               // matches RecommendationRecord.id
  resolvedAt: number;
  exitPrice: number;
  realizedReturnPct: number; // signed
  actualDirection: Direction;
  correct: boolean;
  ageHrs: number;
}

export interface CombinedRecord extends RecommendationRecord {
  outcome?: OutcomeRecord;
}
