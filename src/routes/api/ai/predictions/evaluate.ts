import { createFileRoute } from "@tanstack/react-router";
import { evaluatePredictions } from "@/lib/ai/predictions/tracker";

export const Route = createFileRoute("/api/ai/predictions/evaluate")({
  server: {
    handlers: {
      POST: async ({ request }) => new Response(JSON.stringify(await evaluatePredictions(request), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
