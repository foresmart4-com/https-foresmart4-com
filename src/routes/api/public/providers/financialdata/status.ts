import { createFileRoute } from "@tanstack/react-router";
import { getFinancialDataHealth } from "@/lib/market/providers/financialdata";

export const Route = createFileRoute("/api/public/providers/financialdata/status")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(await getFinancialDataHealth(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
