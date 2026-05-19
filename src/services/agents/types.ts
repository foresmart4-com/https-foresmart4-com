// Shared types for the institutional multi-agent intelligence layer.
import type { MarketIntel } from "@/services/analysis";

export type AgentId =
  | "macro" | "technical" | "quant" | "sentiment" | "portfolio" | "strategy";

export type Bias = "bullish" | "bearish" | "neutral";
export type Severity = "info" | "watch" | "warn" | "critical";

export interface AgentSignal {
  id: AgentId;
  label: string;
  bias: Bias;
  score: number;        // -100..100 directional
  confidence: number;   // 0..100
  weight: number;       // relative trust in this agent (0..1)
  headline: string;
  drivers: string[];    // bullet drivers used by explainability
  flags?: string[];     // anomalies / cautions
}

export interface AgentContext {
  intel: MarketIntel;
  language: "ar" | "en";
}

export interface ReasoningNode {
  id: string;
  label: string;
  contribution: number; // -100..100, sign indicates direction, abs indicates weight
  detail: string;
  children?: ReasoningNode[];
}

export interface Scenario {
  name: string;
  probability: number; // 0..100
  expectedReturnPct: number;
  trigger: string;
  defence: string;
}
