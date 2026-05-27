import { createFileRoute } from "@tanstack/react-router";
import { getKnowledgeTopics } from "@/lib/ai/knowledge";

export const Route = createFileRoute("/api/ai/knowledge/topics")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(getKnowledgeTopics(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
