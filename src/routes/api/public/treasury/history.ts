import { createFileRoute } from "@tanstack/react-router";
import { getTreasuryHistory } from "@/lib/treasury/treasury";

export const Route = createFileRoute("/api/public/treasury/history")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({
          product: "ForeSmart",
          ...getTreasuryHistory(),
          liveExecutionEnabled: false,
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
