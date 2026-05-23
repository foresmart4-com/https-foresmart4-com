import { createFileRoute } from "@tanstack/react-router";
import { analyzeGenesisUniverse, getGenesisPositionSizing } from "@/lib/genesis100/engine";

export const Route = createFileRoute("/api/public/genesis100/position-sizing")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        let sizing = getGenesisPositionSizing(request);
        if (sizing.count === 0) {
          await analyzeGenesisUniverse();
          sizing = getGenesisPositionSizing(request);
        }
        return new Response(JSON.stringify(sizing, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
