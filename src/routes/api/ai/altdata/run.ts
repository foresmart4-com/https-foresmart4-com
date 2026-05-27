import { createFileRoute } from "@tanstack/react-router";
import { runAltDataLayer } from "@/lib/ai/altdata/altDataEngine";

export const Route = createFileRoute("/api/ai/altdata/run")({
  server: {
    handlers: {
      POST: async () => new Response(JSON.stringify(await runAltDataLayer(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
