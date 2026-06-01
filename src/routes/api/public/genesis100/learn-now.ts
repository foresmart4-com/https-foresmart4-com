import { createFileRoute } from "@tanstack/react-router";
import { fetchAndLearn, getLastLearningTime } from "@/lib/genesis100/knowledge/knowledgeFetcher";

export const Route = createFileRoute("/api/public/genesis100/learn-now")({
  server: {
    handlers: {
      GET: async () => {
        const before = await getLastLearningTime();
        const result = await fetchAndLearn();
        const after  = await getLastLearningTime();
        return new Response(
          JSON.stringify(
            {
              success: true,
              processed: result.processed,
              saved: result.saved,
              errors: result.errors,
              lastRefreshBefore: before?.toISOString() ?? null,
              lastRefreshAfter:  after?.toISOString()  ?? null,
              connectedSources: {
                worldBank:          true,
                imf:                true,
                bis:                true,
                fred:               !!process.env.FRED_API_KEY,
                newsApi:            !!process.env.NEWS_API_KEY,
                secEdgar:           true,
                centralBankFeeds:   true,
                academicResearch:   true,
                energyData:         true,
                saudiGCC:           true,
                financialStability: true,
                foodAgriculture:    true,
                fmp:                !!process.env.FMP_API_KEY,
                twelvedata:         !!process.env.TWELVEDATA_API_KEY,
              },
              totalSources: 14,
            },
            null,
            2,
          ),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
