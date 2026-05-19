// Strategy Intelligence Agent — orchestrator. Combines every specialised
// agent into one risk-adjusted, confidence-scored institutional view.
import type { AgentContext, AgentSignal, Bias } from "./types";
import { runMacroAgent } from "./macroAgent";
import { runTechnicalAgent } from "./technicalAgent";
import { runQuantAgent } from "./quantAgent";
import { runSentimentAgent } from "./sentimentAgent";
import { runPortfolioAgent } from "./portfolioAgent";
import { buildReasoningTree, buildScenarios, explainConfidence } from "./explainability";
import { runObservability } from "./observability";
import { memoryAgent } from "./memoryAgent";

export interface InstitutionalView {
  generatedAt: number;
  agents: AgentSignal[];
  composite: { bias: Bias; score: number; confidence: number; reason: string };
  recommendations: Array<{
    asset: string;
    action: "BUY" | "SELL" | "HOLD" | "TRIM" | "ADD";
    sizePct: number;          // suggested portfolio % to hold
    rationale: string;
    confidence: number;
  }>;
  reasoningTree: ReturnType<typeof buildReasoningTree>;
  scenarios: ReturnType<typeof buildScenarios>;
  observability: ReturnType<typeof runObservability>;
  userRiskAppetite: ReturnType<typeof memoryAgent.getProfile>["riskAppetite"];
}

export function runInstitutionalStrategy(ctx: AgentContext): InstitutionalView {
  const macro = runMacroAgent(ctx);
  const technical = runTechnicalAgent(ctx);
  const quant = runQuantAgent(ctx);
  const sentiment = runSentimentAgent(ctx);
  const portfolio = runPortfolioAgent(ctx);

  const agents: AgentSignal[] = [macro, technical, quant, sentiment, portfolio];

  const totalW = agents.reduce((s, a) => s + a.weight, 0) || 1;
  const compositeScore = agents.reduce((s, a) => s + a.score * a.weight, 0) / totalW;
  const { confidence, reason } = explainConfidence(agents);

  // Adapt confidence by historical user-side track record
  const adjConfidence = Math.round(confidence * memoryAgent.confidenceModifier());
  const bias: Bias = compositeScore > 8 ? "bullish" : compositeScore < -8 ? "bearish" : "neutral";

  // Risk-adjusted recommendations per asset
  const profile = memoryAgent.getProfile();
  const aggression = profile.riskAppetite === "aggressive" ? 1.2
    : profile.riskAppetite === "conservative" ? 0.7 : 1;

  const recommendations = ctx.intel.signals.map((sig) => {
    const qm = quant.metrics.perAsset.find((m) => m.symbol === sig.asset);
    const portRow = portfolio.allocation.find((a) => a.asset === sig.asset);
    const current = portRow?.current ?? 0;
    const target = portRow?.suggested ?? sig.confidence / 100 * 20;

    let action: "BUY" | "SELL" | "HOLD" | "TRIM" | "ADD" = sig.action;
    if (bias === "bearish" && sig.action === "BUY") action = "HOLD";
    if (current && target > current + 3) action = "ADD";
    else if (current && target < current - 3) action = "TRIM";

    const sizePct = Math.max(2, Math.min(35, target * aggression));
    const rationale = [
      `${sig.assetName}: ${sig.reason}`,
      qm ? `Risk profile — Sharpe ${qm.sharpe}, β ${qm.beta}, VaR(95) ${(qm.var95 * 100).toFixed(2)}%, MC p50 ${(qm.monteCarlo.p50 * 100).toFixed(1)}%.` : null,
      `Composite bias ${bias} (${compositeScore.toFixed(1)}); risk-appetite ${profile.riskAppetite}.`,
    ].filter(Boolean).join(" ");

    return {
      asset: sig.asset, action, sizePct: +sizePct.toFixed(1),
      rationale,
      confidence: Math.min(95, Math.round(sig.confidence * 0.6 + adjConfidence * 0.4)),
    };
  });

  // Record recommendations into memory for later accuracy tracking
  for (const r of recommendations.slice(0, 3)) {
    memoryAgent.recordRecommendation({
      asset: r.asset,
      bias: r.action === "BUY" || r.action === "ADD" ? "bullish"
        : r.action === "SELL" || r.action === "TRIM" ? "bearish" : "neutral",
      confidence: r.confidence,
    });
  }

  return {
    generatedAt: Date.now(),
    agents,
    composite: { bias, score: +compositeScore.toFixed(2), confidence: adjConfidence, reason },
    recommendations,
    reasoningTree: buildReasoningTree(agents),
    scenarios: buildScenarios(agents),
    observability: runObservability(agents),
    userRiskAppetite: profile.riskAppetite,
  };
}
