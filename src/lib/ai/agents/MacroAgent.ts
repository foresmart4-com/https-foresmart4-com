import { routeQuote } from "@/lib/market/router";
import { AI_CORE_VERSION, AI_SAFETY_FLAGS, AI_UNAVAILABLE_AR, safeRead } from "@/lib/ai/core/safety";
import { getMacroFeed } from "@/lib/ai/feeds/macroFeed";
import { getNewsFeed } from "@/lib/ai/feeds/newsFeed";
import { getAIMemoryStatus } from "@/lib/ai/memory/store";
import { getSourceCredibilityReport } from "@/lib/ai/credibility/sourceCredibility";

const MACRO_SYMBOLS = ["WTI", "BRENT", "EURUSD", "DXY", "US10Y", "XAUUSD"];

export class MacroAgent {
  async analyze() {
    const quotes = await Promise.all(MACRO_SYMBOLS.map((symbol) => safeRead(() => routeQuote(symbol), null)));
    const [macroFeed, newsFeed, memory, sourceCredibility] = await Promise.all([
      safeRead(() => getMacroFeed(), null),
      safeRead(() => getNewsFeed(), null),
      safeRead(() => getAIMemoryStatus(), null),
      safeRead(() => getSourceCredibilityReport(), null),
    ]);
    const available = quotes.filter((q) => q?.success);
    const avgChange = available.length
      ? available.reduce((sum, q) => sum + (q?.changePercent ?? 0), 0) / available.length
      : 0;
    const oil = quotes.find((q) => q?.rawSymbol === "WTI" || q?.rawSymbol === "BRENT");
    const gold = quotes.find((q) => q?.rawSymbol === "XAUUSD");
    const riskOnRiskOff = avgChange > 0.35 ? "Risk On" : avgChange < -0.35 ? "Risk Off" : "Neutral";
    const macroSignals = [
      riskOnRiskOff,
      (oil?.changePercent ?? 0) > 1 ? "Inflationary" : "Inflation Watch",
      avgChange < -1 ? "Recession Risk" : "Recession Risk Low",
      (gold?.changePercent ?? 0) > 0.5 ? "Liquidity Expansion" : "Liquidity Neutral",
    ];

    return {
      aiCoreVersion: AI_CORE_VERSION,
      macroRegime: macroSignals,
      riskOnRiskOff,
      confidenceScore: available.length ? Math.min(90, 40 + available.length * 8) : 20,
      explanationAr: available.length
        ? `قراءة الماكرو تشير إلى ${riskOnRiskOff}. تم استخدام النفط، العملات، الذهب، والعوائد عند توفرها.`
        : AI_UNAVAILABLE_AR,
      inputs: quotes.map((q, index) => ({
        symbol: MACRO_SYMBOLS[index],
        success: Boolean(q?.success),
        provider: q?.provider ?? null,
        changePercent: q?.changePercent ?? null,
      })),
      macroFeedConnected: Boolean(macroFeed?.availableIndicators?.length),
      newsFeedConnected: Boolean(newsFeed?.items?.length),
      memoryConnected: Boolean(memory?.memoryConnected),
      sourceCredibilityConnected: Boolean(sourceCredibility?.sources?.length),
      learningCycleReady: Boolean(memory?.learningReady),
      ...AI_SAFETY_FLAGS,
    };
  }
}
