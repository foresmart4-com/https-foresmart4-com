import { createFileRoute } from "@tanstack/react-router";
import { getMacroFeed } from "@/lib/ai/feeds/macroFeed";

export const Route = createFileRoute("/api/ai/feeds/macro")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(await getMacroFeed(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
