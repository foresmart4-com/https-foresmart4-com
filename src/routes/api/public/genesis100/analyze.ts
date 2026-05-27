import { createFileRoute } from "@tanstack/react-router";
import { analyzeGenesisUniverse, getGenesisEntitlement, getGenesisSafety } from "@/lib/genesis100/engine";

export const Route = createFileRoute("/api/public/genesis100/analyze")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const entitlement = getGenesisEntitlement(request);
        const scores = await analyzeGenesisUniverse();
        return new Response(JSON.stringify({
          product: "ForeSmart Genesis 100",
          liveExecutionEnabled: false,
          entitlement,
          planRequired: entitlement.planRequired,
          planActive: entitlement.planActive,
          featureLocked: entitlement.featureLocked,
          safety: getGenesisSafety().safety,
          count: scores.length,
          scores,
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
