// Orchestrator — turns a MarketIntel snapshot into a DecisionPacket with
// consensus, calibration, scenarios, explainability and lifecycle-aware
// recommendations sized against the user's risk profile and portfolio mix.
import type { MarketIntel } from "@/services/analysis";
import { runMacroAgent } from "@/services/agents/macroAgent";
import { runTechnicalAgent } from "@/services/agents/technicalAgent";
import { runQuantAgent } from "@/services/agents/quantAgent";
import { runSentimentAgent } from "@/services/agents/sentimentAgent";
import { runPortfolioAgent } from "@/services/agents/portfolioAgent";
import { memoryAgent } from "@/services/agents/memoryAgent";
import { adaptWeights } from "./regimeAdaptation";
import { computeConsensus } from "./consensus";
import { calibrateConfidence, uncertainty } from "./calibration";
import { buildScenarioTree } from "./scenarios";
import { buildExplainGraph } from "./explainGraph";
import { persistBatch, reconcileLifecycle, agingScore } from "./lifecycle";
import type {
  DecisionPacket, Recommendation, Regime, DecisionAction,
} from "./types";

export interface RunOptions {
  ttlMinutes?: number;       // recommendation TTL
  maxRecommendations?: number;
}

const HORIZON_TTL: Record<string, number> = {
  short: 60 * 6,    // 6h
  medium: 60 * 24,  // 24h
  long: 60 * 24 * 5,
};

export function runDecisionEngine(
  intel: MarketIntel,
  language: "ar" | "en",
  opts: RunOptions = {},
): DecisionPacket {
  const ctx = { intel, language };
  const baseAgents = [
    runMacroAgent(ctx),
    runTechnicalAgent(ctx),
    runQuantAgent(ctx),
    runSentimentAgent(ctx),
    runPortfolioAgent(ctx),
  ];

  const regime = (intel.regime?.regime ?? "Sideways") as Regime;
  const agents = adaptWeights(baseAgents, regime);
  const consensus = computeConsensus(agents);
  const calib = calibrateConfidence(agents, consensus.agreement);
  const unc = uncertainty(agents);
  const scenarios = buildScenarioTree(consensus.score, unc, language);
  const explain = buildExplainGraph(agents, regime, { score: consensus.score, confidence: calib.confidence });

  // Build per-asset recommendations using portfolio + quant context + memory.
  const profile = memoryAgent.getProfile();
  const aggression =
    profile.riskAppetite === "aggressive" ? 1.2 :
    profile.riskAppetite === "conservative" ? 0.7 : 1;

  const quant = baseAgents.find((a) => a.id === "quant");
  const portfolio = baseAgents.find((a) => a.id === "portfolio");
  const portRows: Array<{ asset: string; current: number; suggested: number }> =
    // @ts-expect-error portfolioAgent injects allocation onto its signal payload
    portfolio?.allocation ?? [];
  // @ts-expect-error quantAgent attaches metrics array
  const qmList: Array<{ symbol: string; sharpe: number; beta: number; var95: number; monteCarlo: { p50: number } }>
    // @ts-expect-error see above
    = quant?.metrics?.perAsset ?? [];

  const maxRecs = opts.maxRecommendations ?? 8;
  const now = Date.now();

  const recommendations: Recommendation[] = intel.signals.slice(0, maxRecs).map((sig): Recommendation => {
    const portRow = portRows.find((p) => p.asset === sig.asset);
    const qm = qmList.find((m) => m.symbol === sig.asset);
    const current = portRow?.current ?? 0;
    const suggested = portRow?.suggested ?? sig.confidence / 100 * 20;

    let action: DecisionAction = sig.action as DecisionAction;
    if (consensus.bias === "bearish" && action === "BUY") action = "HOLD";
    if (consensus.bias === "bullish" && action === "SELL") action = "HOLD";
    if (current && suggested > current + 3) action = "ADD";
    else if (current && suggested < current - 3) action = "TRIM";

    // Dynamic risk adjustment — shrink size when uncertainty / conflicts high.
    const conflictPenalty = 1 - Math.min(0.4, consensus.conflicts.length * 0.1);
    const uncertaintyPenalty = 1 - unc.entropy * 0.35;
    const sizePct = Math.max(2, Math.min(35,
      suggested * aggression * conflictPenalty * uncertaintyPenalty,
    ));

    const horizon = (sig.horizon ?? "short").toString();
    const ttlMin = opts.ttlMinutes ?? HORIZON_TTL[horizon] ?? HORIZON_TTL.short;
    const expiresAt = now + ttlMin * 60_000;

    const rationaleParts = [
      `${sig.assetName ?? sig.asset}: ${sig.reason ?? action}`,
      qm ? `Risk · Sharpe ${qm.sharpe}, β ${qm.beta}, VaR(95) ${(qm.var95 * 100).toFixed(2)}%, MC p50 ${(qm.monteCarlo.p50 * 100).toFixed(1)}%.` : null,
      `Composite ${consensus.bias} ${consensus.score.toFixed(1)} · agreement ${(consensus.agreement * 100).toFixed(0)}% · regime ${regime}.`,
      `Calibration: ${calib.rationale}`,
    ].filter(Boolean).join(" ");

    const rec: Recommendation = {
      id: crypto.randomUUID(),
      createdAt: now,
      expiresAt,
      asset: sig.asset,
      assetName: sig.assetName,
      action,
      sizePct: +sizePct.toFixed(1),
      entryHint: sig.entry ?? undefined,
      stopHint: sig.stop ?? undefined,
      targetHint: sig.target ?? undefined,
      confidence: Math.min(95, Math.round(sig.confidence * 0.4 + calib.confidence * 0.6)),
      rawConfidence: calib.rawConfidence,
      uncertainty: unc,
      rationale: rationaleParts,
      regime,
      status: "active",
      agingScore: 1,
    };
    rec.agingScore = agingScore(rec, now);
    return rec;
  });

  // Persist + reconcile lifecycle so stats include this batch.
  persistBatch(recommendations);
  reconcileLifecycle();

  return {
    generatedAt: now,
    language,
    regime,
    composite: {
      bias: consensus.bias, score: consensus.score,
      confidence: calib.confidence, rationale: calib.rationale,
    },
    uncertainty: unc,
    consensus: consensus.breakdown,
    conflicts: consensus.conflicts,
    scenarios,
    explain,
    recommendations,
    raw: { agents },
  };
}
