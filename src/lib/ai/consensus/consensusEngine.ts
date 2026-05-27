import { runDebate } from "@/lib/ai/agents/debate";
import { AI_SAFETY_FLAGS } from "@/lib/ai/core/safety";
import type { DebateAgentResult } from "@/lib/ai/agents/debate/types";
import { runInstitutionalDebate } from "@/lib/ai/debate/debateEngine";
import type { InstitutionalAgentOpinion } from "@/lib/ai/debate/types";

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

export function buildInstitutionalConsensus(symbol: string, opinions: InstitutionalAgentOpinion[]) {
  const avg = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) / Math.max(1, values.length));
  const bullishConsensus = avg(opinions.map((o) => o.bullishScore));
  const bearishConsensus = avg(opinions.map((o) => o.bearishScore));
  const riskConsensus = avg(opinions.map((o) => o.riskScore));
  const confidenceConsensus = avg(opinions.map((o) => o.confidencePercent));
  const bullishCount = opinions.filter((o) => o.stance === "bullish").length;
  const bearishCount = opinions.filter((o) => o.stance === "bearish").length;
  const neutralCount = opinions.filter((o) => o.stance === "neutral").length;
  const uncertainCount = opinions.filter((o) => o.stance === "uncertain").length;
  const maxAgreement = Math.max(bullishCount, bearishCount, neutralCount, uncertainCount);
  const agreementPercent = Math.round((maxAgreement / Math.max(1, opinions.length)) * 100);
  const disagreementPercent = 100 - agreementPercent;
  const dominantView = bullishCount === maxAgreement ? "bullish" : bearishCount === maxAgreement ? "bearish" : uncertainCount === maxAgreement ? "uncertain" : "neutral";
  let decisionBias: ConsensusActionBias = "watch";
  if (riskConsensus >= 75 || dominantView === "uncertain") decisionBias = "avoid";
  else if (bearishConsensus > bullishConsensus + 10) decisionBias = "reduce_candidate";
  else if (bullishConsensus > bearishConsensus + 12 && confidenceConsensus >= 60) decisionBias = "increase_candidate";
  else if (confidenceConsensus >= 50) decisionBias = "hold";

  return {
    consensusVersion: "genesis-consensus-v1",
    symbol,
    bullishConsensus,
    bearishConsensus,
    riskConsensus,
    confidenceConsensus,
    agreementPercent,
    disagreementPercent,
    dominantView,
    decisionBias,
    finalConsensusAr: `إجماع ${symbol}: ${decisionBias}، الرأي الغالب ${dominantView}، الثقة ${confidenceConsensus}%. لا يوجد تنفيذ.`,
    ...AI_SAFETY_FLAGS,
  };
}

export async function runInstitutionalConsensus(symbol: string) {
  const debate = await runInstitutionalDebate(symbol);
  return {
    debate,
    consensus: buildInstitutionalConsensus(symbol, debate),
  };
}
