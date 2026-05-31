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
              ...result,
              lastRefreshBefore: before?.toISOString() ?? null,
              lastRefreshAfter:  after?.toISOString()  ?? null,
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
