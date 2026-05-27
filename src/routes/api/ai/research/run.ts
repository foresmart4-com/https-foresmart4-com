import { createFileRoute } from "@tanstack/react-router";
import { runDailyResearchAgent } from "@/lib/ai/researchAgent/researchAgent";

export const Route = createFileRoute("/api/ai/research/run")({
  server: {
    handlers: {
      POST: async () => new Response(JSON.stringify(await runDailyResearchAgent(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
