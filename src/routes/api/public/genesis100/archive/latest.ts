import { createFileRoute } from "@tanstack/react-router";
import { getLatestGenesisArchiveDecision } from "@/lib/genesis100/engine";

export const Route = createFileRoute("/api/public/genesis100/archive/latest")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(getLatestGenesisArchiveDecision(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
