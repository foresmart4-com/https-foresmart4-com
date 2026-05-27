import { createFileRoute } from "@tanstack/react-router";
import { listScenarios } from "@/lib/ai/scenarios/scenarioEngine";

export const Route = createFileRoute("/api/ai/scenarios/list")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(listScenarios(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
