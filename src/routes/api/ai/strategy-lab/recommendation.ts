import { createFileRoute } from "@tanstack/react-router";
import { getStrategyRecommendation } from "@/lib/ai/strategyLab/strategyLab";

export const Route = createFileRoute("/api/ai/strategy-lab/recommendation")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(await getStrategyRecommendation(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
