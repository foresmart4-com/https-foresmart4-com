import { createFileRoute } from "@tanstack/react-router";
import { getLatestResearchBrief } from "@/lib/ai/researchAgent/researchAgent";

export const Route = createFileRoute("/api/ai/research/latest")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(getLatestResearchBrief(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
