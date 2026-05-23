import { createFileRoute } from "@tanstack/react-router";
import { getSourceRegistry } from "@/lib/genesis100/intelligence/newsProviders/gdelt";

export const Route = createFileRoute("/api/public/genesis100/source-registry")({
  server: {
    handlers: {
      GET: async () => {
        const registry = getSourceRegistry();
        return new Response(JSON.stringify({
          product: "ForeSmart Genesis 100",
          providers: registry,
          count: registry.length,
          liveCount: registry.filter((p) => p.status === "live").length,
          pendingCount: registry.filter((p) => p.status !== "live").length,
          liveExecutionEnabled: false,
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
