import { createFileRoute } from "@tanstack/react-router";
import { runConsensus } from "@/lib/ai/consensus/consensusEngine";

export const Route = createFileRoute("/api/ai/agents/consensus")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const symbol = new URL(request.url).searchParams.get("symbol") || "AAPL";
        const result = await runConsensus(symbol.toUpperCase());
        return new Response(JSON.stringify({ symbol: symbol.toUpperCase(), ...result }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
