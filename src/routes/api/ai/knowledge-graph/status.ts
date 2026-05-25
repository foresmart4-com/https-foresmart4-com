import { createFileRoute } from "@tanstack/react-router";
import { getKnowledgeGraphStatus } from "@/lib/ai/knowledgeGraph/knowledgeGraphEngine";

export const Route = createFileRoute("/api/ai/knowledge-graph/status")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(getKnowledgeGraphStatus(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
