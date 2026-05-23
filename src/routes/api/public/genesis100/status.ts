import { createFileRoute } from "@tanstack/react-router";
import { getGenesisStatus } from "@/lib/genesis100/engine";

export const Route = createFileRoute("/api/public/genesis100/status")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(getGenesisStatus(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
