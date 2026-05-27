import { createFileRoute } from "@tanstack/react-router";
import { getGenesisArchive } from "@/lib/genesis100/engine";

export const Route = createFileRoute("/api/public/genesis100/archive")({
  server: {
    handlers: {
      GET: async ({ request }) => new Response(JSON.stringify(getGenesisArchive(request), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
