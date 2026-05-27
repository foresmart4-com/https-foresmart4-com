import { createFileRoute } from "@tanstack/react-router";
import { getRiskTwinReport } from "@/lib/ai/riskTwin/riskTwinEngine";

export const Route = createFileRoute("/api/ai/risk-twin/report")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(await getRiskTwinReport(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
