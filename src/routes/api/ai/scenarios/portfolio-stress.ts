import { createFileRoute } from "@tanstack/react-router";
import { runPortfolioStress } from "@/lib/ai/scenarios/scenarioEngine";

export const Route = createFileRoute("/api/ai/scenarios/portfolio-stress")({
  server: {
    handlers: {
      POST: async () => new Response(JSON.stringify(await runPortfolioStress(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
