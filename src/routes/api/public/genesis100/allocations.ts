import { createFileRoute } from "@tanstack/react-router";
import { getGenesisAllocations } from "@/lib/genesis100/engine";

export const Route = createFileRoute("/api/public/genesis100/allocations")({
  server: {
    handlers: {
      GET: async ({ request }) => new Response(JSON.stringify(getGenesisAllocations(request), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
