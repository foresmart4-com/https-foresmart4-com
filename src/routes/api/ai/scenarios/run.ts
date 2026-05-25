import { createFileRoute } from "@tanstack/react-router";
import { runScenarioFromRequest } from "@/lib/ai/scenarios/scenarioEngine";

export const Route = createFileRoute("/api/ai/scenarios/run")({
  server: {
    handlers: {
      POST: async ({ request }) => new Response(JSON.stringify(await runScenarioFromRequest(request), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
