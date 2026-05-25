import { MarketIntelligenceAgent } from "@/lib/ai/agents/MarketIntelligenceAgent";
import { getMacroFeed } from "@/lib/ai/feeds/macroFeed";
import { getNewsFeed } from "@/lib/ai/feeds/newsFeed";
import { applyKnowledge } from "@/lib/ai/knowledge";
import { runConsensus } from "@/lib/ai/consensus/consensusEngine";
import { runGenesisBacktest } from "@/lib/ai/backtesting/backtestEngine";
import { getPredictionAccuracy } from "@/lib/ai/predictions/tracker";
import { runPortfolioStress } from "@/lib/ai/scenarios/scenarioEngine";
import { getStrategyRecommendation } from "@/lib/ai/strategyLab/strategyLab";
import { getGenesisArchiveSummary } from "@/lib/genesis100/engine";
import { addMemoryEvent } from "@/lib/ai/memory/store";
import { AI_SAFETY_FLAGS, safeRead } from "@/lib/ai/core/safety";

const ORCHESTRATOR_SYMBOLS = ["AAPL", "BTCUSDT", "WTI", "2222.SR"];

export async function runMasterOrchestrator() {
  const cycleId = `master-${Date.now()}`;
  const [market, macro, news, knowledge, consensusResults, backtest, predictions, stress, strategy, archive] = await Promise.all([
    safeRead(() => new MarketIntelligenceAgent().analyze(), null),
    safeRead(() => getMacroFeed(), null),
    safeRead(() => getNewsFeed(), null),
    safeRead(() => applyKnowledge("AAPL"), null),
    Promise.all(ORCHESTRATOR_SYMBOLS.map((symbol) => safeRead(() => runConsensus(symbol), null))),
    safeRead(() => runGenesisBacktest("90d"), null),
    safeRead(() => getPredictionAccuracy(), null),
    safeRead(() => runPortfolioStress(), null),
    safeRead(() => getStrategyRecommendation(), null),
    safeRead(() => getGenesisArchiveSummary(), null),
  ]);

  const consensusDecisions = consensusResults
    .filter(Boolean)
    .map((item, index) => ({
      symbol: ORCHESTRATOR_SYMBOLS[index],
      actionBias: item?.consensus.actionBias ?? "watch",
      confidencePercent: item?.consensus.confidencePercent ?? 0,
      finalConsensus: item?.consensus.finalConsensus ?? "لا يوجد إجماع كاف.",
    }));
  const blockedDecisions = consensusDecisions.filter((d) => d.actionBias === "avoid" || d.confidencePercent < 51);
  const approvedWatchlist = consensusDecisions.filter((d) => !blockedDecisions.includes(d));
  const topRisks = [
    ...(news?.topMarketRisks ?? []),
    ...(stress?.results ?? []).slice(0, 3).map((r: { nameAr: string; riskLevel: string }) => `${r.nameAr}: ${r.riskLevel}`),
  ].slice(0, 8);
  const topOpportunities = [
    ...(news?.topOpportunities ?? []),
    ...(knowledge?.investmentPrinciples ?? []).slice(0, 3),
  ].slice(0, 8);
  const confidenceInputs = [
    market?.topDrivers?.length ? 60 : 35,
    macro?.confidencePercent ?? 0,
    strategy?.bestStrategy?.confidencePercent ?? 0,
    predictions?.overallAccuracy ?? 0,
  ];
  const overallConfidencePercent = Math.round(confidenceInputs.reduce((a, b) => a + b, 0) / confidenceInputs.length);
  const event = addMemoryEvent({
    type: "learning_event",
    title: "Master orchestrator cycle",
    summaryAr: "اكتملت دورة تنسيق رئيسية بين وكلاء الذكاء الاصطناعي دون تنفيذ أوامر.",
    confidence: overallConfidencePercent,
    metadata: { cycleId, archiveCount: archive?.count ?? 0, backtestReady: backtest?.ready ?? false },
  });

  return {
    cycleId,
    marketRegime: market?.marketRegime ?? macro?.macroRegime ?? "mixed",
    topRisks,
    topOpportunities,
    consensusDecisions,
    blockedDecisions,
    approvedWatchlist,
    strategyRecommendation: strategy?.bestStrategy ?? null,
    researchSummaryAr: `تم تنسيق السوق والماكرو والأخبار والمعرفة وGenesis archive. أفضل استراتيجية: ${strategy?.bestStrategy?.nameAr ?? "غير محددة"}.`,
    learningEventsAdded: event ? 1 : 0,
    overallConfidencePercent,
    executionEnabled: false,
    externalTransfersAllowed: false,
    fundMovementBlocked: true,
    ...AI_SAFETY_FLAGS,
  };
}
