import { AI_SAFETY_FLAGS } from "@/lib/ai/core/safety";
import { getSourceCredibilityReport } from "@/lib/ai/credibility/sourceCredibility";

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
  };
  const sourceCredibility = getSourceCredibilityReport();
  const providerCount = Object.values(configuredProviders).filter(Boolean).length;
  const items = providerCount > 0
    ? categories.slice(0, providerCount + 2).map((category, index) => ({
      id: `news-${category}`,
      category,
      headlineAr: `إطار أخبار ${category} جاهز للربط والتحليل.`,
      source: index % 2 === 0 ? "financial_news" : "market_news",
      sourceScore: index % 2 === 0 ? 68 : 64,
      sentiment: "neutral",
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
    noSocialCopyTrading: true,
    noDirectInfluencerTrading: true,
    ...AI_SAFETY_FLAGS,
  };
}
