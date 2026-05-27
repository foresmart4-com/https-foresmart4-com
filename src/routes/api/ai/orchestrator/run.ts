import { createFileRoute } from "@tanstack/react-router";
import { runMasterOrchestrator } from "@/lib/ai/orchestrator/masterOrchestrator";

export const Route = createFileRoute("/api/ai/orchestrator/run")({
  server: {
    handlers: {
      POST: async () => new Response(JSON.stringify(await runMasterOrchestrator(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
