import { createFileRoute } from "@tanstack/react-router";
import { runDebate } from "@/lib/ai/agents/debate";
import { AI_SAFETY_FLAGS } from "@/lib/ai/core/safety";

export const Route = createFileRoute("/api/ai/agents/debate")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const symbol = new URL(request.url).searchParams.get("symbol") || "AAPL";
        const debate = await runDebate(symbol.toUpperCase());
        return new Response(JSON.stringify({ symbol: symbol.toUpperCase(), agents: debate, ...AI_SAFETY_FLAGS }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
