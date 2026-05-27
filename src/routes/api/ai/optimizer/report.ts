import { createFileRoute } from "@tanstack/react-router";
import { getOptimizerReport } from "@/lib/ai/optimizer/portfolioOptimizer";

export const Route = createFileRoute("/api/ai/optimizer/report")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(await getOptimizerReport(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
