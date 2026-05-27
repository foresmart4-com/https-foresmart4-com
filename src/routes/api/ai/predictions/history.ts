import { createFileRoute } from "@tanstack/react-router";
import { getPredictionHistory } from "@/lib/ai/predictions/tracker";

export const Route = createFileRoute("/api/ai/predictions/history")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const symbol = new URL(request.url).searchParams.get("symbol");
        return new Response(JSON.stringify(getPredictionHistory(symbol), null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
