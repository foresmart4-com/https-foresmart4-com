import { createAPIFileRoute } from "@tanstack/react-start/api";
import { fetchGdeltIntelligence, getGdeltFallback } from "@/lib/genesis100/intelligence/newsProviders/gdelt";

export const APIRoute = createAPIFileRoute("/api/public/genesis100/market-sentiment")({
  GET: async () => {
    try {
      const result = await fetchGdeltIntelligence();
      const byCat: Record<string, { count: number; avgSentiment: number; avgImpact: number }> = {};

      for (const article of result.articles) {
        if (!byCat[article.category]) {
          byCat[article.category] = { count: 0, avgSentiment: 0, avgImpact: 0 };
        }
        byCat[article.category].count++;
        byCat[article.category].avgSentiment += article.sentimentScore;
        byCat[article.category].avgImpact += article.marketImpactWeight;
      }

      for (const cat of Object.values(byCat)) {
        if (cat.count > 0) {
          cat.avgSentiment = Math.round((cat.avgSentiment / cat.count) * 100) / 100;
          cat.avgImpact = Math.round((cat.avgImpact / cat.count) * 1000) / 1000;
        }
      }

      const overallSentiment = result.articles.length > 0
        ? result.articles.reduce((sum, a) => sum + a.sentimentScore, 0) / result.articles.length
        : 0;

      return Response.json({
        product: "ForeSmart Genesis 100",
        gdeltActive: result.gdeltActive,
        overallSentiment: Math.round(overallSentiment * 100) / 100,
        overallDirection: overallSentiment > 0.1 ? "positive" : overallSentiment < -0.1 ? "negative" : "neutral",
        categoryBreakdown: byCat,
        totalArticles: result.articles.length,
        fetchedAt: result.fetchedAt,
        liveExecutionEnabled: false,
      });
    } catch {
      const fallback = getGdeltFallback();
      return Response.json({
        product: "ForeSmart Genesis 100",
        gdeltActive: false,
        overallSentiment: 0,
        overallDirection: "neutral",
        categoryBreakdown: {},
        totalArticles: 0,
        fetchedAt: fallback.fetchedAt,
        liveExecutionEnabled: false,
      });
    }
  },
});
