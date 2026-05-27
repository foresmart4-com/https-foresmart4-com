import { createFileRoute } from "@tanstack/react-router";
import { getSourceCredibilityReport } from "@/lib/ai/credibility/sourceCredibility";

export const Route = createFileRoute("/api/ai/credibility/sources")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(getSourceCredibilityReport(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
