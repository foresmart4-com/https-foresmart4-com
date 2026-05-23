import { createAPIFileRoute } from "@tanstack/react-start/api";
import { fetchGdeltIntelligence, getGdeltFallback } from "@/lib/genesis100/intelligence/newsProviders/gdelt";

export const APIRoute = createAPIFileRoute("/api/public/genesis100/intelligence")({
  GET: async () => {
    try {
      const result = await fetchGdeltIntelligence();
      const avgSentiment = result.articles.length > 0
        ? result.articles.reduce((sum, a) => sum + a.sentimentScore, 0) / result.articles.length
        : 0;

      return Response.json({
        product: "ForeSmart Genesis 100",
        status: result.gdeltActive ? "live" : "fallback",
        gdeltActive: result.gdeltActive,
        newsCount: result.articles.length,
        averageSentiment: Math.round(avgSentiment * 100) / 100,
        categoryBreakdown: result.categoryBreakdown,
        topHeadlines: result.articles.slice(0, 10).map((a) => ({
          title: a.title,
          sentiment: a.sentimentScore,
          source: a.source,
          category: a.category,
          impact: a.marketImpactWeight,
          credibility: a.sourceCredibilityPercent,
        })),
        fetchedAt: result.fetchedAt,
        liveExecutionEnabled: false,
      });
    } catch {
      const fallback = getGdeltFallback();
      return Response.json({
        product: "ForeSmart Genesis 100",
        status: "fallback",
        gdeltActive: false,
        newsCount: 0,
        averageSentiment: 0,
        categoryBreakdown: fallback.categoryBreakdown,
        topHeadlines: [],
        fetchedAt: fallback.fetchedAt,
        liveExecutionEnabled: false,
      });
    }
  },
});
