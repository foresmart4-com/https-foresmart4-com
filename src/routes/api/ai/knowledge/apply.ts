import { createFileRoute } from "@tanstack/react-router";
import { applyKnowledge } from "@/lib/ai/knowledge";

export const Route = createFileRoute("/api/ai/knowledge/apply")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const result = await applyKnowledge(url.searchParams.get("symbol"));
        return new Response(JSON.stringify(result, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
