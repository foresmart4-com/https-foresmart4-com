import { createFileRoute } from "@tanstack/react-router";
import { getResearchArchive } from "@/lib/ai/researchAgent/researchAgent";

export const Route = createFileRoute("/api/ai/research/archive")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(getResearchArchive(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
