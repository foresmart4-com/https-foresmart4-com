import { createFileRoute } from "@tanstack/react-router";
import { testRiskTwinDecision } from "@/lib/ai/riskTwin/riskTwinEngine";

export const Route = createFileRoute("/api/ai/risk-twin/test-decision")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const input = await request.json().catch(() => ({}));
        return new Response(JSON.stringify(await testRiskTwinDecision(input), null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
