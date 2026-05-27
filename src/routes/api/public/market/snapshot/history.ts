import { createFileRoute } from "@tanstack/react-router";
import { getSnapshotHistory } from "@/lib/market/snapshots";

export const Route = createFileRoute("/api/public/market/snapshot/history")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const period = (url.searchParams.get("period") ?? "daily") as "daily" | "monthly";
        const history = getSnapshotHistory(period);
        return new Response(JSON.stringify({
          product: "ForeSmart",
          period,
          count: history.length,
          snapshots: history,
        }, null, 2), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
      },
    },
  },
});
