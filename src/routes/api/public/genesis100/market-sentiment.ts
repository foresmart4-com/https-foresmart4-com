import { createFileRoute } from "@tanstack/react-router";
import { analyzeGenesisUniverse, getGenesisMarketSentiment } from "@/lib/genesis100/engine";

export const Route = createFileRoute("/api/public/genesis100/market-sentiment")({
  server: {
    handlers: {
      GET: async () => {
        const scores = await analyzeGenesisUniverse();
        return new Response(JSON.stringify({
          product: "ForeSmart Genesis 100",
          intelligenceVersion: "genesis-intelligence-v2",
          ...getGenesisMarketSentiment(scores),
          liveExecutionEnabled: false,
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
