import { createFileRoute } from "@tanstack/react-router";
import { getLearningCycleStatus } from "@/lib/ai/learning/cycle";

export const Route = createFileRoute("/api/ai/learning/status")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(await getLearningCycleStatus(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
