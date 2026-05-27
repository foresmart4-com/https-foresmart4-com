import { createFileRoute } from "@tanstack/react-router";
import { updateKnowledgeGraph } from "@/lib/ai/knowledgeGraph/knowledgeGraphEngine";

export const Route = createFileRoute("/api/ai/knowledge-graph/update")({
  server: {
    handlers: {
      POST: async () => new Response(JSON.stringify(await updateKnowledgeGraph(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
