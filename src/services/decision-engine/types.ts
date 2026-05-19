// Institutional Decision Engine — shared types.
import type { AgentSignal, Bias } from "@/services/agents/types";

export type DecisionAction = "BUY" | "SELL" | "HOLD" | "ADD" | "TRIM";
export type LifecycleStatus = "active" | "expired" | "triggered" | "stopped" | "resolved" | "superseded";
export type Regime =
  | "Trending Bullish" | "Trending Bearish" | "Risk-On" | "Risk-Off"
  | "High Volatility" | "Panic" | "Sideways";

export interface ConsensusBreakdown {
  agentId: string;
  label: string;
  bias: Bias;
  score: number;        // -100..100
  confidence: number;   // 0..100
  weight: number;       // adapted weight 0..1
  contribution: number; // signed contribution to composite
  agreement: boolean;   // agrees with composite direction
}

export interface ConflictReport {
  pair: [string, string];
  delta: number;        // |score_a - score_b|
  resolution: string;
  winner: string;
}

export interface UncertaintyBand {
  mean: number;
  stdev: number;
  low: number;          // bear-case score
  high: number;         // bull-case score
  entropy: number;      // 0..1, higher = more uncertain
}

export interface ScenarioNode {
  id: string;
  label: string;
  probability: number;   // 0..1
  expectedReturnPct: number;
  trigger: string;
  defence: string;
  children?: ScenarioNode[];
}

export interface ExplainNode {
  id: string;
  label: string;
  kind: "root" | "agent" | "driver" | "regime" | "portfolio" | "calibration";
  weight: number;        // 0..1
  contribution: number;  // signed
  detail: string;
}
export interface ExplainEdge { from: string; to: string; weight: number }
export interface ExplainGraph { nodes: ExplainNode[]; edges: ExplainEdge[] }

export interface Recommendation {
  id: string;
  createdAt: number;
  expiresAt: number;
  asset: string;
  assetName?: string;
  action: DecisionAction;
  sizePct: number;
  entryHint?: number;
  stopHint?: number;
  targetHint?: number;
  confidence: number;       // calibrated 0..100
  rawConfidence: number;    // pre-calibration
  uncertainty: UncertaintyBand;
  rationale: string;
  regime: Regime;
  status: LifecycleStatus;
  agingScore: number;       // 0..1 (1 = fresh, 0 = fully aged)
  triggeredAt?: number;
  resolvedAt?: number;
  realizedReturnPct?: number;
}

export interface DecisionPacket {
  generatedAt: number;
  language: "ar" | "en";
  regime: Regime;
  composite: { bias: Bias; score: number; confidence: number; rationale: string };
  uncertainty: UncertaintyBand;
  consensus: ConsensusBreakdown[];
  conflicts: ConflictReport[];
  scenarios: ScenarioNode[];
  explain: ExplainGraph;
  recommendations: Recommendation[];
  raw: { agents: AgentSignal[] };
}
