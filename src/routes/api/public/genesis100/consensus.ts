import { createFileRoute } from "@tanstack/react-router";
import { runInstitutionalConsensus } from "@/lib/ai/consensus/consensusEngine";

export const Route = createFileRoute("/api/public/genesis100/consensus")({
  server: {
    handlers: {
      GET: async () => {
        const result = await runInstitutionalConsensus("AAPL");
        return new Response(JSON.stringify({ symbol: "AAPL", ...result }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
