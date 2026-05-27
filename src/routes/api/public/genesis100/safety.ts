import { createFileRoute } from "@tanstack/react-router";
import { getGenesisSafety } from "@/lib/genesis100/engine";

export const Route = createFileRoute("/api/public/genesis100/safety")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(getGenesisSafety(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
