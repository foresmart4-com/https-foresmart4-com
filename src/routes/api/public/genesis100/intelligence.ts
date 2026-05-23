import { createFileRoute } from "@tanstack/react-router";
import { analyzeGenesisUniverse, getGenesisIntelligence } from "@/lib/genesis100/engine";

export const Route = createFileRoute("/api/public/genesis100/intelligence")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await analyzeGenesisUniverse();
        return new Response(JSON.stringify(getGenesisIntelligence(request), null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
