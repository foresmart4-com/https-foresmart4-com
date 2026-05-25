import { getRouterDiagnostics } from "@/lib/market/router";
import { getGenesisArchiveSummary, getGenesisIntelligence } from "@/lib/genesis100/engine";
import { MarketIntelligenceAgent } from "@/lib/ai/agents/MarketIntelligenceAgent";
import { getMacroFeed } from "@/lib/ai/feeds/macroFeed";
import { getNewsFeed } from "@/lib/ai/feeds/newsFeed";
import { getAIMemoryStatus, addMemoryEvent, updateSourceReliability } from "@/lib/ai/memory/store";
import { getSourceCredibilityReport } from "@/lib/ai/credibility/sourceCredibility";
import { AI_INSUFFICIENT_HISTORY_AR, AI_SAFETY_FLAGS, safeRead } from "@/lib/ai/core/safety";

export async function getLearningCycleStatus() {
  const memory = getAIMemoryStatus();
  const sourceCredibility = getSourceCredibilityReport();
  return {
    learningCycleVersion: "learning-cycle-v1",
    learningReady: memory.learningReady,
    reasonAr: memory.learningReady ? "دورة التعلم جاهزة." : AI_INSUFFICIENT_HISTORY_AR,
    memoryConnected: memory.memoryConnected,
    memorySize: memory.memorySize,
    sourceCredibilityConnected: sourceCredibility.sources.length > 0,
    ...AI_SAFETY_FLAGS,
  };
}

export async function runLearningCycle() {
  const cycleId = `learn-${Date.now()}`;
  const [market, macro, news, genesis, router, archive] = await Promise.all([
    safeRead(() => new MarketIntelligenceAgent().analyze(), null),
    safeRead(() => getMacroFeed(), null),
    safeRead(() => getNewsFeed(), null),
    safeRead(() => getGenesisIntelligence(), null),
    safeRead(() => getRouterDiagnostics(), null),
    safeRead(() => getGenesisArchiveSummary(), null),
  ]);

  const evidenceCount = [
    market?.topDrivers?.length ?? 0,
    macro?.availableIndicators?.length ?? 0,
    news?.items?.length ?? 0,
    archive?.count ?? 0,
    router?.metrics ? Object.keys(router.metrics).length : 0,
  ].reduce((a, b) => a + b, 0);
  const learningReady = evidenceCount >= 10;

  if (!learningReady) {
    const event = addMemoryEvent({
      type: "learning_event",
      title: "Learning cycle insufficient data",
      summaryAr: AI_INSUFFICIENT_HISTORY_AR,
      confidence: 20,
      metadata: { cycleId, evidenceCount },
    });
    return {
      cycleId,
      learningReady: false,
      reasonAr: AI_INSUFFICIENT_HISTORY_AR,
      memoryEventsAdded: 1,
      sourceReliabilityUpdated: 0,
      marketRegime: market?.marketRegime ?? "unknown",
      confidenceCalibration: 20,
      learningSummaryAr: AI_INSUFFICIENT_HISTORY_AR,
      event,
      ...AI_SAFETY_FLAGS,
    };
  }

  const updated = [
    updateSourceReliability("market_router", "regulated_market_data", 84),
    updateSourceReliability("macro_feed", "official_economic_sources", macro?.confidencePercent ?? 50),
    updateSourceReliability("news_feed", "financial_news", news?.items?.length ? 64 : 35),
  ];
  const event = addMemoryEvent({
    type: "learning_event",
    title: "AI learning cycle completed",
    summaryAr: "اكتملت دورة التعلم اليدوية وتم تحديث موثوقية المصادر وذاكرة السوق.",
    confidence: Math.min(95, 50 + evidenceCount),
    metadata: { cycleId, evidenceCount, marketRegime: market?.marketRegime },
  });

  return {
    cycleId,
    learningReady: true,
    memoryEventsAdded: 1,
    sourceReliabilityUpdated: updated.length,
    marketRegime: market?.marketRegime ?? genesis?.marketRegime ?? "mixed",
    confidenceCalibration: Math.min(95, 50 + evidenceCount),
    learningSummaryAr: "اكتملت دورة التعلم اليدوية وتم ربط السوق والماكرو والأخبار وذاكرة Genesis.",
    event,
    ...AI_SAFETY_FLAGS,
  };
}
