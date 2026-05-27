export type DebateStance = "bullish" | "bearish" | "neutral" | "risk_watch";

export interface DebateAgentResult {
  agent: string;
  stance: DebateStance;
  argumentsAr: string[];
  confidencePercent: number;
  riskWarnings: string[];
  evidenceSources: string[];
  uncertainty: string;
}
