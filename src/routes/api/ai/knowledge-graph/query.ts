import { createFileRoute } from "@tanstack/react-router";
import { queryKnowledgeGraph } from "@/lib/ai/knowledgeGraph/knowledgeGraphEngine";

export const Route = createFileRoute("/api/ai/knowledge-graph/query")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(queryKnowledgeGraph(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
