import { AI_SAFETY_FLAGS } from "@/lib/ai/core/safety";

export const SOURCE_CREDIBILITY_VERSION = "source-credibility-v1";

const sources = [
  { source: "central_banks", category: "central_banks", credibility: 96, tier: "high" },
  { source: "official_economic_sources", category: "official_economic_sources", credibility: 94, tier: "high" },
  { source: "exchange_data", category: "regulated_market_data", credibility: 91, tier: "high" },
  { source: "finnhub", category: "regulated_market_data", credibility: 84, tier: "high" },
  { source: "fmp", category: "regulated_market_data", credibility: 82, tier: "high" },
  { source: "alphavantage", category: "regulated_market_data", credibility: 80, tier: "high" },
  { source: "financial_news", category: "financial_news", credibility: 68, tier: "medium" },
  { source: "analyst_commentary", category: "analyst_commentary", credibility: 60, tier: "medium" },
  { source: "social_media", category: "social_media", credibility: 25, tier: "low" },
  { source: "unverified_commentary", category: "unverified_commentary", credibility: 20, tier: "low" },
];

export function getSourceCredibilityReport() {
  const averageCredibility = Math.round(sources.reduce((sum, item) => sum + item.credibility, 0) / sources.length);
  return {
    sourceCredibilityVersion: SOURCE_CREDIBILITY_VERSION,
    sources,
    averageCredibility,
    warningsAr: [
      "لا يتم استخدام وسائل التواصل أو التعليقات غير الموثقة كإشارة تداول مباشرة.",
      "المصادر الرسمية والبنوك المركزية ومزودو البيانات المنظمون أعلى موثوقية.",
    ],
    ...AI_SAFETY_FLAGS,
  };
}
