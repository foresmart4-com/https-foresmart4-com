import { createFileRoute } from "@tanstack/react-router";
import { getTreasuryStatus } from "@/lib/treasury/treasury";

export const Route = createFileRoute("/api/public/treasury/status")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({
          product: "ForeSmart",
          ...getTreasuryStatus(),
          liveExecutionEnabled: false,
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
