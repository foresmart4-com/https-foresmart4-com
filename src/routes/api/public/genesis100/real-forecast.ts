import { createFileRoute } from "@tanstack/react-router";
import { buildRealEconomicForecast } from "@/lib/genesis100/forecasting/fredHistorical";
import { getRealSectorRotation } from "@/lib/genesis100/forecasting/sectorRotationReal";

export const Route = createFileRoute("/api/public/genesis100/real-forecast")({
  server: {
    handlers: {
      GET: async () => {
        const [forecast, sectors] = await Promise.all([
          buildRealEconomicForecast().catch(() => null),
          getRealSectorRotation().catch(() => null),
        ]);

        return new Response(
          JSON.stringify({ forecast, sectors, generatedAt: new Date().toISOString() }, null, 2),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
