import { createFileRoute } from "@tanstack/react-router";
import { createPrediction } from "@/lib/ai/predictions/tracker";

export const Route = createFileRoute("/api/ai/predictions/create")({
  server: {
    handlers: {
      POST: async ({ request }) => new Response(JSON.stringify(await createPrediction(request), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
