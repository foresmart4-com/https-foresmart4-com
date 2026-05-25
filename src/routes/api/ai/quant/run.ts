import { createFileRoute } from "@tanstack/react-router";
import { runQuantModels } from "@/lib/ai/quant/quantEngine";

export const Route = createFileRoute("/api/ai/quant/run")({
  server: {
    handlers: {
      POST: async () => new Response(JSON.stringify(await runQuantModels(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
