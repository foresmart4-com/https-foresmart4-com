import { createFileRoute } from "@tanstack/react-router";
import { runInstitutionalDebate } from "@/lib/ai/debate/debateEngine";
import { AI_SAFETY_FLAGS } from "@/lib/ai/core/safety";

export const Route = createFileRoute("/api/ai/debate")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const symbol = (new URL(request.url).searchParams.get("symbol") || "AAPL").toUpperCase();
        const agents = await runInstitutionalDebate(symbol);
        return new Response(JSON.stringify({ symbol, agents, ...AI_SAFETY_FLAGS }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
