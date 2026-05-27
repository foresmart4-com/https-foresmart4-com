import { MarketIntelligenceAgent } from "@/lib/ai/agents/MarketIntelligenceAgent";
import { getMacroFeed } from "@/lib/ai/feeds/macroFeed";
import { getNewsFeed } from "@/lib/ai/feeds/newsFeed";
import { getEconomicCalendar } from "@/lib/ai/feeds/economicCalendar";
import { applyKnowledge } from "@/lib/ai/knowledge";
import { addMemoryEvent } from "@/lib/ai/memory/store";
import { AI_SAFETY_FLAGS, safeRead } from "@/lib/ai/core/safety";

interface ResearchBrief {
  researchAgentVersion: "research-agent-v1";
  id: string;
  createdAt: string;
  dailyResearchBriefAr: string;
  topRisks: string[];
  topOpportunities: string[];
  importantEvents: unknown[];
  assetsAffected: string[];
  sourceCredibilityAverage: number;
  watchlist: string[];
  recommendedWatchlist: string[];
  researchConfidence: number;
  liveTrading: false;
  executionAgent: false;
  externalTransfersAllowed: false;
  fundMovementBlocked: true;
  secretsExposed: false;
}

const archive: ResearchBrief[] = [];

export async function runDailyResearchAgent(): Promise<ResearchBrief> {
  const [market, macro, news, calendar, knowledge] = await Promise.all([
    safeRead(() => new MarketIntelligenceAgent().analyze(), null),
    safeRead(() => getMacroFeed(), null),
    safeRead(() => getNewsFeed(), null),
    safeRead(() => getEconomicCalendar(), null),
    safeRead(() => applyKnowledge("AAPL"), null),
  ]);

  const topRisks = [
    ...(news?.topMarketRisks ?? []),
    ...(macro?.missingIndicators ?? []).slice(0, 3).map((item: { key: string }) => `مؤشر مفقود: ${item.key}`),
  ].slice(0, 8);
  const topOpportunities = [
    ...(news?.topOpportunities ?? []),
    ...(knowledge?.investmentPrinciples ?? []).slice(0, 3),
  ].slice(0, 8);
  const assetsAffected = [
    ...(market?.topDrivers ?? []).map((item: { symbol?: string }) => item.symbol).filter(Boolean),
    "AAPL",
    "BTCUSDT",
    "WTI",
  ].slice(0, 12) as string[];
  const sourceCredibilityAverage = Math.round(
    ((macro?.sourceCredibilityAverage ?? 0) + (news?.sourceCredibilityAverage ?? 0) + (knowledge?.confidence ?? 50)) / 3,
  );
  const researchConfidence = Math.max(20, Math.min(90, Math.round((sourceCredibilityAverage + (macro?.confidencePercent ?? 0)) / 2)));
  const watchlist = [...new Set(assetsAffected)].slice(0, 10);
  const brief: ResearchBrief = {
    researchAgentVersion: "research-agent-v1",
    id: `research-${Date.now()}`,
    createdAt: new Date().toISOString(),
    dailyResearchBriefAr: `ملخص بحث يومي: نظام السوق ${market?.marketRegime ?? "غير واضح"}، الماكرو ${macro?.macroRegime ?? "محدود"}، وأهم المخاطر ${topRisks[0] ?? "غير متاحة"}.`,
    topRisks,
    topOpportunities,
    importantEvents: calendar?.events ?? [],
    assetsAffected,
    sourceCredibilityAverage,
    watchlist,
    recommendedWatchlist: watchlist,
    researchConfidence,
    ...AI_SAFETY_FLAGS,
  };

  archive.unshift(brief);
  if (archive.length > 120) archive.length = 120;
  addMemoryEvent({
    type: "learning_event",
    title: "Daily research brief",
    summaryAr: brief.dailyResearchBriefAr,
    confidence: brief.researchConfidence,
    metadata: { researchId: brief.id, assetsAffected: brief.assetsAffected },
  });
  return brief;
}

export function getLatestResearchBrief() {
  return {
    researchAgentVersion: "research-agent-v1",
    latest: archive[0] ?? null,
    count: archive.length,
    messageAr: archive[0] ? "آخر تقرير بحثي متاح." : "لا يوجد تقرير بحثي محفوظ بعد.",
    ...AI_SAFETY_FLAGS,
  };
}

export function getResearchArchive() {
  return {
    researchAgentVersion: "research-agent-v1",
    count: archive.length,
    archive,
    ...AI_SAFETY_FLAGS,
  };
}
