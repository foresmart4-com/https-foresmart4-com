import { createFileRoute } from "@tanstack/react-router";
import { runMarketSnapshot } from "@/lib/market/snapshots";

export const Route = createFileRoute("/api/public/market/snapshot/run")({
  server: {
    handlers: {
      POST: async () => {
        const snapshot = await runMarketSnapshot();
        return new Response(JSON.stringify({
          product: "ForeSmart",
          snapshot,
          success: snapshot.symbols.filter((s) => s.success).length,
          failed: snapshot.symbols.filter((s) => !s.success).length,
          total: snapshot.symbols.length,
        }, null, 2), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
      },
    },
  },
});
