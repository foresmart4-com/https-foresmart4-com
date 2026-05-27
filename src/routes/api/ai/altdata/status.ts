import { createFileRoute } from "@tanstack/react-router";
import { getAltDataStatus } from "@/lib/ai/altdata/altDataEngine";

export const Route = createFileRoute("/api/ai/altdata/status")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(getAltDataStatus(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
