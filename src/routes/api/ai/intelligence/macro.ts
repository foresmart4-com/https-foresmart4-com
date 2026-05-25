import { createFileRoute } from "@tanstack/react-router";
import { MacroAgent } from "@/lib/ai/intelligence";
import { AI_SAFETY_FLAGS, AI_UNAVAILABLE_AR } from "@/lib/ai/core/safety";

export const Route = createFileRoute("/api/ai/intelligence/macro")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const data = await new MacroAgent().analyze();
          return new Response(JSON.stringify(data, null, 2), {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        } catch {
          return new Response(JSON.stringify({ explanationAr: AI_UNAVAILABLE_AR, confidenceScore: 0, ...AI_SAFETY_FLAGS }, null, 2), {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }
      },
    },
  },
});
