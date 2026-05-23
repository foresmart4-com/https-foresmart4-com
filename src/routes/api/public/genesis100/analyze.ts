import { createFileRoute } from "@tanstack/react-router";
import { analyzeGenesisUniverse } from "@/lib/genesis100/engine";

export const Route = createFileRoute("/api/public/genesis100/analyze")({
  server: {
    handlers: {
      GET: async () => {
        const scores = await analyzeGenesisUniverse();
        return new Response(JSON.stringify({
          product: "ForeSmart Genesis 100",
          liveExecutionEnabled: false,
          count: scores.length,
          scores,
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
