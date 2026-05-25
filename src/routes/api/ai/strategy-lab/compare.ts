import { createFileRoute } from "@tanstack/react-router";
import { compareStrategies } from "@/lib/ai/strategyLab/strategyLab";

export const Route = createFileRoute("/api/ai/strategy-lab/compare")({
  server: {
    handlers: {
      POST: async () => new Response(JSON.stringify(await compareStrategies(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
