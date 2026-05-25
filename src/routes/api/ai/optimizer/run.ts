import { createFileRoute } from "@tanstack/react-router";
import { runPortfolioOptimizer } from "@/lib/ai/optimizer/portfolioOptimizer";

export const Route = createFileRoute("/api/ai/optimizer/run")({
  server: {
    handlers: {
      POST: async () => new Response(JSON.stringify(await runPortfolioOptimizer(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
