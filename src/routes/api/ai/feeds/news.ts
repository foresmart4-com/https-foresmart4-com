import { createFileRoute } from "@tanstack/react-router";
import { getNewsFeed } from "@/lib/ai/feeds/newsFeed";

export const Route = createFileRoute("/api/ai/feeds/news")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(await getNewsFeed(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
