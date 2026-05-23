import { createFileRoute } from "@tanstack/react-router";
import { getCredibilityReport } from "@/lib/genesis100/intelligence/newsProviders/gdelt";

export const Route = createFileRoute("/api/public/genesis100/credibility")({
  server: {
    handlers: {
      GET: async () => {
        const report = getCredibilityReport();
        return new Response(JSON.stringify({
          product: "ForeSmart Genesis 100",
          ...report,
          liveExecutionEnabled: false,
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
