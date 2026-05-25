import { createFileRoute } from "@tanstack/react-router";
import { getRiskTwinStatus } from "@/lib/ai/riskTwin/riskTwinEngine";

export const Route = createFileRoute("/api/ai/risk-twin/status")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(await getRiskTwinStatus(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
