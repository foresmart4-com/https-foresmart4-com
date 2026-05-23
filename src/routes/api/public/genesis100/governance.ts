import { createFileRoute } from "@tanstack/react-router";
import { getCorporateGovernance } from "@/lib/genesis100/governance";
import { getBrokerSafetyReport } from "@/lib/genesis100/brokerAdapter";

export const Route = createFileRoute("/api/public/genesis100/governance")({
  server: {
    handlers: {
      GET: async () => {
        const governance = getCorporateGovernance();
        const broker = getBrokerSafetyReport();
        return new Response(JSON.stringify({
          ...governance,
          broker,
          liveExecutionEnabled: false,
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
