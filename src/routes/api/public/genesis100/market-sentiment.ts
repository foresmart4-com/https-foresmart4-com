import { createFileRoute } from "@tanstack/react-router";
import { fetchGdeltIntelligence, getGdeltFallback } from "@/lib/genesis100/intelligence/newsProviders/gdelt";

export const Route = createFileRoute("/api/public/genesis100/market-sentiment")({
  server: {
    handlers: {
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

          return new Response(JSON.stringify({
            product: "ForeSmart Genesis 100",
            gdeltActive: result.gdeltActive,
            overallSentiment: Math.round(overallSentiment * 100) / 100,
            overallDirection: overallSentiment > 0.1 ? "positive" : overallSentiment < -0.1 ? "negative" : "neutral",
            categoryBreakdown: byCat,
            totalArticles: result.articles.length,
            fetchedAt: result.fetchedAt,
            liveExecutionEnabled: false,
          }, null, 2), {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        } catch {
          const fallback = getGdeltFallback();
          return new Response(JSON.stringify({
            product: "ForeSmart Genesis 100",
            gdeltActive: false,
            overallSentiment: 0,
            overallDirection: "neutral",
            categoryBreakdown: {},
            totalArticles: 0,
            fetchedAt: fallback.fetchedAt,
            liveExecutionEnabled: false,
          }, null, 2), {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }
      },
    },
  },
});
