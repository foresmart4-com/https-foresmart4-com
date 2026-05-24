import { createFileRoute } from "@tanstack/react-router";
import { getKnowledgeStatus } from "@/lib/ai/knowledge";

export const Route = createFileRoute("/api/ai/knowledge/status")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(getKnowledgeStatus(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
