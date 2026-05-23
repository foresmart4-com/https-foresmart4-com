import { createFileRoute } from "@tanstack/react-router";
import { getGenesisUniverse } from "@/lib/genesis100/engine";

export const Route = createFileRoute("/api/public/genesis100/universe")({
  server: {
    handlers: {
      GET: async ({ request }) => new Response(JSON.stringify(getGenesisUniverse(request), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
