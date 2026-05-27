import { createFileRoute } from "@tanstack/react-router";
import { runLearningCycle } from "@/lib/ai/learning/cycle";

export const Route = createFileRoute("/api/ai/learning/run-cycle")({
  server: {
    handlers: {
      POST: async () => new Response(JSON.stringify(await runLearningCycle(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
