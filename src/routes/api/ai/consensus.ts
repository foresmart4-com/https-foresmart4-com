import { createFileRoute } from "@tanstack/react-router";
import { runInstitutionalConsensus } from "@/lib/ai/consensus/consensusEngine";

export const Route = createFileRoute("/api/ai/consensus")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const symbol = (new URL(request.url).searchParams.get("symbol") || "AAPL").toUpperCase();
        const result = await runInstitutionalConsensus(symbol);
        return new Response(JSON.stringify({ symbol, ...result }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
