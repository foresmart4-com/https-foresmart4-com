import { createFileRoute } from "@tanstack/react-router";
import { getGenesisDecisions } from "@/lib/genesis100/engine";

export const Route = createFileRoute("/api/public/genesis100/decisions")({
  server: {
    handlers: {
      GET: async ({ request }) => new Response(JSON.stringify(getGenesisDecisions(request), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
