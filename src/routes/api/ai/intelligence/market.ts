import { createFileRoute } from "@tanstack/react-router";
import { MarketIntelligenceAgent } from "@/lib/ai/intelligence";
import { AI_SAFETY_FLAGS, AI_UNAVAILABLE_AR } from "@/lib/ai/core/safety";

export const Route = createFileRoute("/api/ai/intelligence/market")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const data = await new MarketIntelligenceAgent().analyze();
          return new Response(JSON.stringify(data, null, 2), {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        } catch {
          return new Response(JSON.stringify({ marketSummaryAr: AI_UNAVAILABLE_AR, ...AI_SAFETY_FLAGS }, null, 2), {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }
      },
    },
  },
});
