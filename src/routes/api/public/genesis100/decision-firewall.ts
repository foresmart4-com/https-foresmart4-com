import { createFileRoute } from "@tanstack/react-router";
import { analyzeGenesisUniverse, getGenesisDecisionFirewall } from "@/lib/genesis100/engine";

export const Route = createFileRoute("/api/public/genesis100/decision-firewall")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await analyzeGenesisUniverse();
        return new Response(JSON.stringify(getGenesisDecisionFirewall(request), null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
