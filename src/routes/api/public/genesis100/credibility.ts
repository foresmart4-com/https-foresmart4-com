import { createFileRoute } from "@tanstack/react-router";
import { analyzeGenesisUniverse, getGenesisCredibility } from "@/lib/genesis100/engine";

export const Route = createFileRoute("/api/public/genesis100/credibility")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await analyzeGenesisUniverse();
        return new Response(JSON.stringify(getGenesisCredibility(request), null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
