import { createFileRoute } from "@tanstack/react-router";
import { LearningAgent } from "@/lib/ai/intelligence";
import { AI_INSUFFICIENT_HISTORY_AR } from "@/lib/ai/core/safety";

export const Route = createFileRoute("/api/ai/intelligence/learning")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const data = await new LearningAgent().analyze();
          return new Response(JSON.stringify(data, null, 2), {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        } catch {
          return new Response(JSON.stringify({ learningReady: false, learningStatus: AI_INSUFFICIENT_HISTORY_AR, liveTrading: false }, null, 2), {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }
      },
    },
  },
});
