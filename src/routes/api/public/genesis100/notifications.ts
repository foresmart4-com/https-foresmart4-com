import { createFileRoute } from "@tanstack/react-router";
import { getGenesisNotifications } from "@/lib/genesis100/engine";

export const Route = createFileRoute("/api/public/genesis100/notifications")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(getGenesisNotifications(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
