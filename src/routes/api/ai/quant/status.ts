import { createFileRoute } from "@tanstack/react-router";
import { getQuantStatus } from "@/lib/ai/quant/quantEngine";

export const Route = createFileRoute("/api/ai/quant/status")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(getQuantStatus(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
