import { createFileRoute } from "@tanstack/react-router";
import { buildRealEconomicForecast } from "@/lib/genesis100/forecasting/fredHistorical";
import { getRealSectorRotation } from "@/lib/genesis100/forecasting/sectorRotationReal";

export const Route = createFileRoute("/api/public/genesis100/real-forecast")({
  server: {
    handlers: {
      GET: async () => {
        let forecast = null;
        let forecastError: string | null = null;
        try {
          forecast = await buildRealEconomicForecast();
          if (forecast.dataSource === "macro_cache_fallback") {
            console.warn("[real-forecast] FRED returned 0 series — using macro cache fallback. Check FRED_API_KEY in Railway env.");
          } else {
            console.info(`[real-forecast] forecast ready: source=${forecast.dataSource} confidence=${forecast.dataConfidence}%`);
          }
        } catch (err) {
          forecastError = err instanceof Error ? err.message : String(err);
          console.error("[real-forecast] buildRealEconomicForecast threw:", forecastError);
        }

        let sectors = null;
        let sectorsError: string | null = null;
        try {
          sectors = await getRealSectorRotation();
          if (!sectors) console.warn("[real-forecast] getRealSectorRotation returned null — check ALPHAVANTAGE_API_KEY");
        } catch (err) {
          sectorsError = err instanceof Error ? err.message : String(err);
          console.error("[real-forecast] getRealSectorRotation threw:", sectorsError);
        }

        return new Response(
          JSON.stringify(
            {
              forecast,
              sectors,
              generatedAt: new Date().toISOString(),
              errors: {
                forecast: forecastError,
                sectors:  sectorsError,
              },
            },
            null,
            2,
          ),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
