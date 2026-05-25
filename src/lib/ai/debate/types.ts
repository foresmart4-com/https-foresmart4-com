export type InstitutionalStance = "bullish" | "bearish" | "neutral" | "uncertain";

export interface InstitutionalAgentOpinion {
  agentId: string;
  stance: InstitutionalStance;
  confidencePercent: number;
  bullishScore: number;
  bearishScore: number;
  riskScore: number;
  reasoningAr: string;
  supportingEvidence: string[];
  warnings: string[];
  dataQuality: "high" | "medium" | "low";
  sourceCredibility: number;
}
