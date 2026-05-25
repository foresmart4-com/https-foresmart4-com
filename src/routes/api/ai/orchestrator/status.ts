import { createFileRoute } from "@tanstack/react-router";
import { getMasterOrchestratorStatus } from "@/lib/ai/orchestrator/masterOrchestrator";

export const Route = createFileRoute("/api/ai/orchestrator/status")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(await getMasterOrchestratorStatus(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
