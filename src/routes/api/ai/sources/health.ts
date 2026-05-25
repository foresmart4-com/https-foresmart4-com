import { createFileRoute } from "@tanstack/react-router";
import { getTrustedSourceHealth } from "@/lib/ai/sources/trustedSources";

export const Route = createFileRoute("/api/ai/sources/health")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(getTrustedSourceHealth(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
