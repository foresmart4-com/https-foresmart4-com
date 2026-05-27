import { AI_SAFETY_FLAGS } from "@/lib/ai/core/safety";
import { getSourceCredibilityReport } from "@/lib/ai/credibility/sourceCredibility";
import { getTrustedSourceHealth } from "@/lib/ai/sources/trustedSources";

export const NEWS_FEED_VERSION = "news-feed-v1";

const categories = [
  "market_news",
  "company_news",
  "macro_news",
  "oil_news",
  "metals_news",
  "crypto_news",
  "central_bank_news",
  "saudi_market_news",
];

export async function getNewsFeed() {
  const configuredProviders = {
    NEWS_API_KEY: Boolean(process.env.NEWS_API_KEY || process.env.NEWSAPI_KEY),
    FINNHUB_API_KEY: Boolean(process.env.FINNHUB_API_KEY),
    FMP_API_KEY: Boolean(process.env.FMP_API_KEY),
    BENZINGA_API_KEY: Boolean(process.env.BENZINGA_API_KEY),
    REUTERS_API_KEY: Boolean(process.env.REUTERS_API_KEY),
    GDELT_ENABLED: process.env.GDELT_ENABLED === "true",
  };
  const sourceCredibility = getSourceCredibilityReport();
  const sourceHealth = getTrustedSourceHealth();
  const providerCount = Object.values(configuredProviders).filter(Boolean).length;
  const items = providerCount > 0
    ? categories.slice(0, providerCount + 2).map((category, index) => ({
      id: `news-${category}`,
      title: `ForeSmart ${category} feed framework`,
      category,
      publishedAt: new Date(Date.now() - index * 3600_000).toISOString(),
      headlineAr: `إطار أخبار ${category} جاهز للربط والتحليل.`,
      source: index % 2 === 0 ? "financial_news" : "market_news",
      credibilityScore: index % 2 === 0 ? 68 : 64,
      marketImpactScore: 50 + index,
      sentimentScore: 50,
      affectedAssets: category.includes("oil") ? ["WTI", "BRENT"] : category.includes("crypto") ? ["BTCUSDT", "ETHUSDT"] : ["AAPL", "SPY"],
      summaryAr: `ملخص عربي: ${category} متاح كإطار قراءة آمن بدون تداول مباشر.`,
      url: null,
    }))
    : [];

  return {
    newsFeedVersion: NEWS_FEED_VERSION,
    configuredProviders,
    categories,
    items,
    sourceCredibility,
    summaryAr: items.length
      ? `تم تجهيز ${items.length} فئات أخبار للتحليل. لا توجد توصيات نسخ اجتماعي أو تداول مباشر.`
      : "مصادر الأخبار الحية غير مهيأة حالياً، والإطار جاهز عند توفر المزود.",
    topMarketRisks: items.length ? ["تقلب الأخبار الكلية", "تغير مفاجئ في توقعات الفائدة"] : ["المصدر غير متاح حالياً"],
    topOpportunities: items.length ? ["تحسين توقيت المتابعة", "ربط الأخبار مع جودة القرار"] : [],
    sourceCredibilityAverage: sourceHealth.sourceCredibilityAverage,
    trustedSourcesConnected: sourceHealth.trustedSourcesConnected,
    liveSourceCount: sourceHealth.liveSourceCount,
    fallbackSourceCount: sourceHealth.fallbackSourceCount,
    sourceWarningsAr: sourceHealth.sourceWarningsAr,
    noSocialCopyTrading: true,
    noDirectInfluencerTrading: true,
    ...AI_SAFETY_FLAGS,
  };
}
