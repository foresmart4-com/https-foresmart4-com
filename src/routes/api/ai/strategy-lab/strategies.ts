import { createFileRoute } from "@tanstack/react-router";
import { listStrategies } from "@/lib/ai/strategyLab/strategyLab";

export const Route = createFileRoute("/api/ai/strategy-lab/strategies")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(listStrategies(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
