import { createFileRoute } from "@tanstack/react-router";
import { getLatestSnapshot } from "@/lib/market/snapshots";

export const Route = createFileRoute("/api/public/market/snapshot/")({
  server: {
    handlers: {
      GET: async () => {
        const snap = getLatestSnapshot();
        return new Response(JSON.stringify({
          product: "ForeSmart",
          snapshot: snap,
          hasData: !!snap,
          message: snap ? null : "لا توجد لقطات بعد — شغّل POST /api/public/market/snapshot/run",
        }, null, 2), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
      },
    },
  },
});
