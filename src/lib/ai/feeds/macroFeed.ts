import { routeQuote } from "@/lib/market/router";
import { AI_SAFETY_FLAGS, AI_UNAVAILABLE_AR, safeRead } from "@/lib/ai/core/safety";
import { getTrustedSourceHealth } from "@/lib/ai/sources/trustedSources";

export const MACRO_FEED_VERSION = "macro-feed-v2";

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
    TRADINGECONOMICS_API_KEY: Boolean(process.env.TRADINGECONOMICS_API_KEY || process.env.TRADING_ECONOMICS_KEY),
    COMMODITYPRICE_API_KEY: Boolean(process.env.COMMODITYPRICE_API_KEY || process.env.COMMODITYPRICEAPI_KEY),
  };
  const sourceHealth = getTrustedSourceHealth();

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
  const oil = availableIndicators.find((item) => item.key === "oil");
  const usd = availableIndicators.find((item) => item.key === "usd" || item.key === "forex");
  const riskImpact = confidencePercent >= 70 ? "moderate" : confidencePercent >= 35 ? "elevated" : "unknown";
  const recessionRisk = confidencePercent < 35 ? "unknown" : (usd?.changePercent ?? 0) > 0.5 ? "elevated" : "contained";
  const liquiditySignal = confidencePercent < 35 ? "unknown" : (oil?.changePercent ?? 0) > 1 ? "tightening_watch" : "neutral";
  const macroRegime = riskImpact === "unknown" ? "data_limited" : riskImpact === "elevated" ? "risk_watch" : "balanced_macro";

  return {
    macroFeedVersion: MACRO_FEED_VERSION,
    macroRegime,
    configuredProviders,
    availableIndicators,
    missingIndicators,
    recessionRisk,
    liquiditySignal,
    macroSummaryAr: availableIndicators.length
      ? `تمت قراءة ${availableIndicators.length} مؤشرات ماكرو موثوقة. نظام الماكرو ${macroRegime} وتأثير المخاطر ${riskImpact}.`
      : "تعذر قراءة مؤشرات الماكرو حالياً. " + AI_UNAVAILABLE_AR,
    riskImpact,
    confidencePercent,
    sourceCredibilityAverage: sourceHealth.sourceCredibilityAverage,
    trustedSourcesConnected: sourceHealth.trustedSourcesConnected,
    liveSourceCount: sourceHealth.liveSourceCount,
    fallbackSourceCount: sourceHealth.fallbackSourceCount,
    sourceWarningsAr: sourceHealth.sourceWarningsAr,
    ...AI_SAFETY_FLAGS,
  };
}
