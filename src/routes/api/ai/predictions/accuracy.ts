import { createFileRoute } from "@tanstack/react-router";
import { getPredictionAccuracy } from "@/lib/ai/predictions/tracker";

export const Route = createFileRoute("/api/ai/predictions/accuracy")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(getPredictionAccuracy(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
