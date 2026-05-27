export type AgentMode = "observation" | "advisory" | "execution_ready";
export type MarketRegime = "risk_on" | "risk_off" | "mixed" | "defensive" | "crisis";
export type ConfidenceTier = "reject" | "watch" | "cautious" | "confident" | "high_confidence" | "exceptional";
export type AgentId = "planner" | "research" | "market_data" | "risk" | "strategy" | "learning";

export interface AgentStatus {
  id: AgentId;
  name: string;
  nameAr: string;
  active: boolean;
  lastRunAt: string | null;
  health: "healthy" | "degraded" | "offline";
}

export interface DecisionConfidence {
  score: number;
  tier: ConfidenceTier;
  reasons: string[];
  sources: string[];
  riskApproval: boolean;
}

export interface AgentDecision {
  id: string;
  timestamp: string;
  symbol: string;
  action: "buy" | "sell" | "hold" | "watch" | "reduce";
  confidence: DecisionConfidence;
  factors: DecisionFactor[];
  regime: MarketRegime;
  agentMode: AgentMode;
  archived: boolean;
}

export interface DecisionFactor {
  source: string;
  signal: string;
  weight: number;
  direction: "bullish" | "bearish" | "neutral";
  confidence: number;
}

export interface AgentMemoryEntry {
  id: string;
  timestamp: string;
  type: "decision" | "lesson" | "pattern" | "failure" | "regime_change";
  symbol: string | null;
  content: string;
  outcome: "success" | "failure" | "pending" | null;
  tags: string[];
}

export interface ResearchSignal {
  source: string;
  category: "economic" | "news" | "crypto" | "commodities" | "central_bank" | "company" | "macro" | "analyst";
  sentiment: number;
  impact: number;
  credibility: number;
  headline: string;
  timestamp: string;
}

export interface RiskAssessment {
  drawdownRisk: number;
  exposureRisk: number;
  correlationRisk: number;
  volatilityRisk: number;
  positionSizeRecommended: number;
  stopLossLevel: number | null;
  credibilityThreshold: number;
  approved: boolean;
  reasons: string[];
}
