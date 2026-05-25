import { routeQuote } from "@/lib/market/router";
import { AI_SAFETY_FLAGS, AI_UNAVAILABLE_AR, safeRead } from "@/lib/ai/core/safety";

export const MACRO_FEED_VERSION = "macro-feed-v1";

const indicators = [
  { key: "oil", symbol: "WTI", providerEnv: "FMP_API_KEY" },
  { key: "forex", symbol: "EURUSD", providerEnv: "ALPHAVANTAGE_API_KEY" },
  { key: "treasury_yields", symbol: "US10Y", providerEnv: "FRED_API_KEY" },
  { key: "usd", symbol: "DXY", providerEnv: "FMP_API_KEY" },
  { key: "inflation_proxy", symbol: "XAUUSD", providerEnv: "FRED_API_KEY" },
  { key: "unemployment", symbol: "UNEMPLOYMENT", providerEnv: "FRED_API_KEY" },
];

export async function getMacroFeed() {
  const configuredProviders = {
    FRED_API_KEY: Boolean(process.env.FRED_API_KEY),
    ALPHAVANTAGE_API_KEY: Boolean(process.env.ALPHAVANTAGE_API_KEY),
    FMP_API_KEY: Boolean(process.env.FMP_API_KEY),
  };

  const reads = await Promise.all(indicators.map(async (item) => {
    const quote = await safeRead(() => routeQuote(item.symbol), null);
    return { ...item, quote };
  }));
  const availableIndicators = reads.filter((item) => item.quote?.success).map((item) => ({
    key: item.key,
    symbol: item.symbol,
    provider: item.quote?.provider ?? null,
    value: item.quote?.price ?? null,
    changePercent: item.quote?.changePercent ?? null,
  }));
  const missingIndicators = reads.filter((item) => !item.quote?.success).map((item) => ({
    key: item.key,
    symbol: item.symbol,
    reasonAr: AI_UNAVAILABLE_AR,
  }));
  const confidencePercent = Math.round((availableIndicators.length / indicators.length) * 100);
  const riskImpact = confidencePercent >= 70 ? "moderate" : confidencePercent >= 35 ? "elevated" : "unknown";

  return {
    macroFeedVersion: MACRO_FEED_VERSION,
    configuredProviders,
    availableIndicators,
    missingIndicators,
    macroSummaryAr: availableIndicators.length
      ? `تمت قراءة ${availableIndicators.length} مؤشرات ماكرو. تأثير المخاطر الحالي ${riskImpact}.`
      : "تعذر قراءة مؤشرات الماكرو حالياً. " + AI_UNAVAILABLE_AR,
    riskImpact,
    confidencePercent,
    ...AI_SAFETY_FLAGS,
  };
}
