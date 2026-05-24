import { getProviderConnected, getRouterDiagnostics, routeQuote } from "@/lib/market/router";
import { AI_CORE_VERSION, AI_SAFETY_FLAGS, AI_UNAVAILABLE_AR, safeArray, safeRead } from "@/lib/ai/core/safety";

const MARKET_SYMBOLS = ["AAPL", "BTCUSDT", "WTI", "BRENT", "XAUUSD", "EURUSD", "2222.SR"];

export class MarketIntelligenceAgent {
  async analyze() {
    const quotes = await Promise.all(MARKET_SYMBOLS.map((symbol) =>
      safeRead(() => routeQuote(symbol), null),
    ));
    const validQuotes = safeArray<typeof quotes[number]>(quotes).filter(Boolean);
    const connected = getProviderConnected();
    const diagnostics = safeRead(() => getRouterDiagnostics(), null);
    const liveCount = validQuotes.filter((q) => q?.success).length;
    const riskLevel = liveCount >= 5 ? "medium" : liveCount >= 2 ? "elevated" : "high";
    const marketRegime = liveCount >= 5 ? "mixed" : "defensive";

    return {
      aiCoreVersion: AI_CORE_VERSION,
      marketSummaryAr: liveCount
        ? `تم تحليل ${liveCount} أسواق متصلة. النظام الحالي ${marketRegime} ومستوى المخاطر ${riskLevel}.`
        : AI_UNAVAILABLE_AR,
      topDrivers: validQuotes.slice(0, 5).map((q) => ({
        symbol: q?.rawSymbol ?? q?.symbol,
        assetClass: q?.assetClass,
        provider: q?.provider,
        changePercent: q?.changePercent,
        success: q?.success,
      })),
      riskLevel,
      marketRegime,
      connectedMarkets: Object.entries(connected).filter(([, ok]) => ok).map(([name]) => name),
      providerStatus: {
        connected,
        diagnostics: await diagnostics,
      },
      ...AI_SAFETY_FLAGS,
    };
  }
}
