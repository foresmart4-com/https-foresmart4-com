import { AI_SAFETY_FLAGS } from "@/lib/ai/core/safety";

export const TRUSTED_SOURCES_VERSION = "trusted-sources-v1";

export type TrustedSourceCategory =
  | "official_economic_sources"
  | "central_banks"
  | "financial_news"
  | "market_news"
  | "company_news"
  | "commodity_news"
  | "crypto_news"
  | "regulated_market_data";

export interface TrustedSource {
  id: string;
  name: string;
  category: TrustedSourceCategory;
  credibilityScore: number;
  requiresKey: boolean;
  configured: boolean;
  enabled: boolean;
  lastError: string | null;
  priority: number;
}

function hasEnv(...names: string[]): boolean {
  return names.some((name) => Boolean(process.env[name]?.trim()));
}

export function getTrustedSources(): TrustedSource[] {
  const gdeltEnabled = process.env.GDELT_ENABLED === "true";
  return [
    { id: "fred", name: "FRED", category: "official_economic_sources", credibilityScore: 96, requiresKey: true, configured: hasEnv("FRED_API_KEY"), enabled: hasEnv("FRED_API_KEY"), lastError: null, priority: 100 },
    { id: "federal_reserve", name: "Federal Reserve", category: "central_banks", credibilityScore: 99, requiresKey: false, configured: true, enabled: true, lastError: null, priority: 99 },
    { id: "ecb", name: "European Central Bank", category: "central_banks", credibilityScore: 98, requiresKey: false, configured: true, enabled: true, lastError: null, priority: 97 },
    { id: "boe", name: "Bank of England", category: "central_banks", credibilityScore: 97, requiresKey: false, configured: true, enabled: true, lastError: null, priority: 96 },
    { id: "bis", name: "Bank for International Settlements", category: "official_economic_sources", credibilityScore: 96, requiresKey: false, configured: true, enabled: true, lastError: null, priority: 95 },
    { id: "imf", name: "International Monetary Fund", category: "official_economic_sources", credibilityScore: 95, requiresKey: false, configured: true, enabled: true, lastError: null, priority: 94 },
    { id: "world_bank", name: "World Bank", category: "official_economic_sources", credibilityScore: 94, requiresKey: false, configured: true, enabled: true, lastError: null, priority: 93 },
    { id: "sama", name: "Saudi Central Bank", category: "central_banks", credibilityScore: 95, requiresKey: false, configured: true, enabled: true, lastError: null, priority: 92 },
    { id: "finnhub_news", name: "Finnhub News", category: "market_news", credibilityScore: 84, requiresKey: true, configured: hasEnv("FINNHUB_API_KEY"), enabled: hasEnv("FINNHUB_API_KEY"), lastError: null, priority: 85 },
    { id: "fmp_news", name: "FMP News", category: "financial_news", credibilityScore: 82, requiresKey: true, configured: hasEnv("FMP_API_KEY"), enabled: hasEnv("FMP_API_KEY"), lastError: null, priority: 82 },
    { id: "newsapi", name: "NewsAPI", category: "financial_news", credibilityScore: 76, requiresKey: true, configured: hasEnv("NEWS_API_KEY", "NEWSAPI_KEY"), enabled: hasEnv("NEWS_API_KEY", "NEWSAPI_KEY"), lastError: null, priority: 78 },
    { id: "alphavantage", name: "AlphaVantage", category: "regulated_market_data", credibilityScore: 80, requiresKey: true, configured: hasEnv("ALPHAVANTAGE_API_KEY"), enabled: hasEnv("ALPHAVANTAGE_API_KEY"), lastError: null, priority: 80 },
    { id: "eodhd", name: "EODHD", category: "regulated_market_data", credibilityScore: 78, requiresKey: true, configured: hasEnv("EODHD_API_KEY"), enabled: hasEnv("EODHD_API_KEY"), lastError: null, priority: 77 },
    { id: "marketstack", name: "Marketstack", category: "regulated_market_data", credibilityScore: 76, requiresKey: true, configured: hasEnv("MARKETSTACK_API_KEY"), enabled: hasEnv("MARKETSTACK_API_KEY"), lastError: null, priority: 76 },
    { id: "commodityprice", name: "CommodityPrice", category: "commodity_news", credibilityScore: 82, requiresKey: true, configured: hasEnv("COMMODITYPRICE_API_KEY", "COMMODITYPRICEAPI_KEY"), enabled: hasEnv("COMMODITYPRICE_API_KEY", "COMMODITYPRICEAPI_KEY"), lastError: null, priority: 81 },
    { id: "tradingeconomics", name: "TradingEconomics", category: "official_economic_sources", credibilityScore: 88, requiresKey: true, configured: hasEnv("TRADINGECONOMICS_API_KEY", "TRADING_ECONOMICS_KEY"), enabled: hasEnv("TRADINGECONOMICS_API_KEY", "TRADING_ECONOMICS_KEY"), lastError: null, priority: 88 },
    { id: "benzinga", name: "Benzinga", category: "financial_news", credibilityScore: 72, requiresKey: true, configured: hasEnv("BENZINGA_API_KEY"), enabled: hasEnv("BENZINGA_API_KEY"), lastError: null, priority: 70 },
    { id: "reuters", name: "Reuters", category: "financial_news", credibilityScore: 90, requiresKey: true, configured: hasEnv("REUTERS_API_KEY"), enabled: hasEnv("REUTERS_API_KEY"), lastError: null, priority: 90 },
    { id: "gdelt", name: "GDELT", category: "market_news", credibilityScore: 70, requiresKey: false, configured: gdeltEnabled, enabled: gdeltEnabled, lastError: gdeltEnabled ? null : "GDELT_ENABLED is not true", priority: 65 },
  ];
}

export function getTrustedSourceHealth() {
  const sources = getTrustedSources();
  const configured = sources.filter((source) => source.configured);
  const enabled = sources.filter((source) => source.enabled);
  const sourceCredibilityAverage = Math.round(enabled.reduce((sum, source) => sum + source.credibilityScore, 0) / Math.max(1, enabled.length));
  const macroReady = enabled.some((source) => ["fred", "tradingeconomics", "fmp_news", "alphavantage"].includes(source.id));
  const newsReady = enabled.some((source) => ["finnhub_news", "fmp_news", "newsapi", "benzinga", "reuters", "gdelt"].includes(source.id));
  const calendarReady = enabled.some((source) => ["fmp_news", "tradingeconomics"].includes(source.id)) || true;
  const missingKeys = sources.filter((source) => source.requiresKey && !source.configured).map((source) => source.id);

  return {
    trustedSourcesVersion: TRUSTED_SOURCES_VERSION,
    sources,
    configuredCount: configured.length,
    enabledCount: enabled.length,
    missingKeys,
    macroReady,
    newsReady,
    calendarReady,
    trustedSourcesConnected: enabled.length > 0,
    sourceCredibilityAverage,
    liveSourceCount: enabled.filter((source) => source.configured).length,
    fallbackSourceCount: enabled.filter((source) => !source.requiresKey).length,
    sourceWarningsAr: missingKeys.length
      ? [`بعض مفاتيح المصادر غير مهيأة: ${missingKeys.slice(0, 6).join(", ")}`]
      : [],
    warningsAr: missingKeys.length
      ? [`بعض مفاتيح المصادر غير مهيأة: ${missingKeys.slice(0, 6).join(", ")}`]
      : [],
    ...AI_SAFETY_FLAGS,
  };
}
