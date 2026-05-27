import { createFileRoute } from "@tanstack/react-router";
import { getGenesisArchiveSummary } from "@/lib/genesis100/engine";

export const Route = createFileRoute("/api/public/genesis100/archive/summary")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(getGenesisArchiveSummary(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
