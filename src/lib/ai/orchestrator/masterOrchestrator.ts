import { MarketIntelligenceAgent } from "@/lib/ai/agents/MarketIntelligenceAgent";
import { getMacroFeed } from "@/lib/ai/feeds/macroFeed";
import { getNewsFeed } from "@/lib/ai/feeds/newsFeed";
import { applyKnowledge } from "@/lib/ai/knowledge";
import { runConsensus } from "@/lib/ai/consensus/consensusEngine";
import { runGenesisBacktest } from "@/lib/ai/backtesting/backtestEngine";
import { getPredictionAccuracy } from "@/lib/ai/predictions/tracker";
import { runPortfolioStress } from "@/lib/ai/scenarios/scenarioEngine";
import { getRiskTwinReport } from "@/lib/ai/riskTwin/riskTwinEngine";
import { getStrategyRecommendation } from "@/lib/ai/strategyLab/strategyLab";
import { getGenesisArchiveSummary } from "@/lib/genesis100/engine";
import { addMemoryEvent } from "@/lib/ai/memory/store";
import { runDailyResearchAgent } from "@/lib/ai/researchAgent/researchAgent";
import { runPortfolioOptimizer } from "@/lib/ai/optimizer/portfolioOptimizer";
import { queryKnowledgeGraph } from "@/lib/ai/knowledgeGraph/knowledgeGraphEngine";
import { runAltDataLayer } from "@/lib/ai/altdata/altDataEngine";
import { AI_SAFETY_FLAGS, safeRead } from "@/lib/ai/core/safety";

const ORCHESTRATOR_SYMBOLS = ["AAPL", "BTCUSDT", "WTI", "2222.SR"];

export async function getMasterOrchestratorStatus() {
  const [market, macro, news, archive] = await Promise.all([
    safeRead(() => new MarketIntelligenceAgent().analyze(), null),
    safeRead(() => getMacroFeed(), null),
    safeRead(() => getNewsFeed(), null),
    safeRead(() => getGenesisArchiveSummary(), null),
  ]);

  return {
    orchestratorVersion: "master-orchestrator-v1",
    ready: true,
    modules: {
      marketIntelligence: Boolean(market),
      macroFeed: Boolean(macro),
      newsFeed: Boolean(news),
      genesisArchive: Boolean(archive),
      debate: true,
      backtesting: true,
      predictionTracker: true,
      scenarios: true,
      riskTwin: true,
      strategyLab: true,
      researchAgent: true,
    },
    systemHealth: {
      marketRegime: market?.marketRegime ?? macro?.macroRegime ?? "unknown",
      macroFeedConnected: Boolean(macro?.availableIndicators?.length),
      newsFeedConnected: Boolean(news?.items?.length),
      genesisArchiveCount: archive?.count ?? 0,
    },
    executionEnabled: false,
    externalTransfersAllowed: false,
    fundMovementBlocked: true,
    ...AI_SAFETY_FLAGS,
  };
}

export async function runMasterOrchestrator() {
  const cycleId = `master-${Date.now()}`;
  const [market, macro, news, knowledge, consensusResults, backtest, predictions, stress, riskTwin, strategy, research, optimizer, graph, altdata, archive] = await Promise.all([
    safeRead(() => new MarketIntelligenceAgent().analyze(), null),
    safeRead(() => getMacroFeed(), null),
    safeRead(() => getNewsFeed(), null),
    safeRead(() => applyKnowledge("AAPL"), null),
    Promise.all(ORCHESTRATOR_SYMBOLS.map((symbol) => safeRead(() => runConsensus(symbol), null))),
    safeRead(() => runGenesisBacktest("90d"), null),
    safeRead(() => getPredictionAccuracy(), null),
    safeRead(() => runPortfolioStress(), null),
    safeRead(() => getRiskTwinReport(), null),
    safeRead(() => getStrategyRecommendation(), null),
    safeRead(() => runDailyResearchAgent(), null),
    safeRead(() => runPortfolioOptimizer(), null),
    safeRead(() => queryKnowledgeGraph(), null),
    safeRead(() => runAltDataLayer(), null),
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
    ...((riskTwin?.rejectedCount ?? 0) > 0 ? [`Risk Twin رفض ${riskTwin?.rejectedCount} قرارات`] : []),
  ].slice(0, 8);
  const topOpportunities = [
    ...(news?.topOpportunities ?? []),
    ...(research?.topOpportunities ?? []),
    ...(altdata?.altSignals ?? []).slice(0, 2).map((signal: { source: string; signal: string }) => `${signal.source}: ${signal.signal}`),
    ...(knowledge?.investmentPrinciples ?? []).slice(0, 2),
  ].slice(0, 8);
  const confidenceInputs = [
    market?.topDrivers?.length ? 60 : 35,
    macro?.confidencePercent ?? 0,
    strategy?.bestStrategy?.confidencePercent ?? 0,
    research?.researchConfidence ?? 0,
    predictions?.overallAccuracy ?? 0,
    riskTwin?.approvedCount || riskTwin?.rejectedCount ? 55 : 35,
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
    researchSummaryAr: research?.dailyResearchBriefAr ?? `تم تنسيق السوق والماكرو والأخبار والمعرفة وGenesis archive. أفضل استراتيجية: ${strategy?.bestStrategy?.nameAr ?? "غير محددة"}.`,
    learningEventsAdded: event ? 2 : 1,
    overallConfidencePercent,
    systemHealth: {
      macroFeedConnected: Boolean(macro),
      newsFeedConnected: Boolean(news),
      backtestReady: Boolean(backtest?.ready),
      riskTwinReady: Boolean(riskTwin),
      optimizerReady: Boolean(optimizer),
      knowledgeGraphReady: Boolean(graph),
      altDataReady: Boolean(altdata),
      archiveCount: archive?.count ?? 0,
    },
    executionEnabled: false,
    liveTrading: false,
    externalTransfersAllowed: false,
    fundMovementBlocked: true,
    secretsExposed: false,
    ...AI_SAFETY_FLAGS,
  };
}
