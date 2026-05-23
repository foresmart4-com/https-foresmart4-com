import { createAPIFileRoute } from "@tanstack/react-start/api";
import { getSourceRegistry } from "@/lib/genesis100/intelligence/newsProviders/gdelt";

export const APIRoute = createAPIFileRoute("/api/public/genesis100/source-registry")({
  GET: async () => {
    const registry = getSourceRegistry();
    return Response.json({
      product: "ForeSmart Genesis 100",
      providers: registry,
      count: registry.length,
      liveCount: registry.filter((p) => p.status === "live").length,
      pendingCount: registry.filter((p) => p.status !== "live").length,
      liveExecutionEnabled: false,
    });
  },
});
