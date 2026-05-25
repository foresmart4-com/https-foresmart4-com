import { runDebate } from "@/lib/ai/agents/debate";
import { AI_SAFETY_FLAGS } from "@/lib/ai/core/safety";
import type { DebateAgentResult } from "@/lib/ai/agents/debate/types";

export type ConsensusActionBias = "watch" | "hold" | "increase_candidate" | "reduce_candidate" | "avoid";

function avg(items: number[]) {
  return Math.round(items.reduce((a, b) => a + b, 0) / Math.max(1, items.length));
}

export function buildConsensus(symbol: string, debate: DebateAgentResult[]) {
  const bullishScore = avg(debate.filter((d) => d.stance === "bullish").map((d) => d.confidencePercent));
  const bearishScore = avg(debate.filter((d) => d.stance === "bearish").map((d) => d.confidencePercent));
  const riskScore = avg(debate.filter((d) => d.agent.includes("Risk") || d.stance === "risk_watch").map((d) => d.confidencePercent));
  const macroScore = debate.find((d) => d.agent === "MacroAgent")?.confidencePercent ?? 0;
  const valuationScore = debate.find((d) => d.agent === "ValuationAgent")?.confidencePercent ?? 0;
  const sentimentScore = debate.find((d) => d.agent === "SentimentAgent")?.confidencePercent ?? 0;
  const knowledgeScore = debate.find((d) => d.agent === "KnowledgeAgent")?.confidencePercent ?? 0;
  const confidencePercent = avg(debate.map((d) => d.confidencePercent));

  let actionBias: ConsensusActionBias = "watch";
  if (riskScore >= 75 && bearishScore >= bullishScore) actionBias = "avoid";
  else if (bearishScore > bullishScore + 10) actionBias = "reduce_candidate";
  else if (bullishScore > bearishScore + 15 && confidencePercent >= 60) actionBias = "increase_candidate";
  else if (confidencePercent >= 50) actionBias = "hold";

  return {
    symbol,
    bullishScore,
    bearishScore,
    riskScore,
    macroScore,
    valuationScore,
    sentimentScore,
    knowledgeScore,
    finalConsensus: `إجماع ${symbol}: ${actionBias} بثقة ${confidencePercent}%. لا يوجد تنفيذ أو أوامر حقيقية.`,
    confidencePercent,
    actionBias,
    ...AI_SAFETY_FLAGS,
  };
}

export async function runConsensus(symbol: string) {
  const debate = await runDebate(symbol);
  return {
    debate,
    consensus: buildConsensus(symbol, debate),
  };
}
