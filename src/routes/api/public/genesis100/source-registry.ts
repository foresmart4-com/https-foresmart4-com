import { createFileRoute } from "@tanstack/react-router";
import { getGenesisSourceRegistry } from "@/lib/genesis100/engine";

export const Route = createFileRoute("/api/public/genesis100/source-registry")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(getGenesisSourceRegistry(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
