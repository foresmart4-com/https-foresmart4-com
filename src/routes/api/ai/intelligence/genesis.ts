import { createFileRoute } from "@tanstack/react-router";
import { GenesisPortfolioAgent } from "@/lib/ai/intelligence";

export const Route = createFileRoute("/api/ai/intelligence/genesis")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const data = await new GenesisPortfolioAgent().analyze();
          return new Response(JSON.stringify(data, null, 2), {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        } catch {
          return new Response(JSON.stringify({ summaryAr: "لا توجد بيانات كافية", liveTrading: false }, null, 2), {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }
      },
    },
  },
});
