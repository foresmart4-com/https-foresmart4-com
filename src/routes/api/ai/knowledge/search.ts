import { createFileRoute } from "@tanstack/react-router";
import { searchKnowledge } from "@/lib/ai/knowledge";

export const Route = createFileRoute("/api/ai/knowledge/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        return new Response(JSON.stringify(searchKnowledge(url.searchParams.get("q")), null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
