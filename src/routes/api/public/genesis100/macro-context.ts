import { createFileRoute } from "@tanstack/react-router";
import { fetchRealMacroContext, getCachedMacroContext } from "@/lib/genesis100/macro/macroDataService";

export const Route = createFileRoute("/api/public/genesis100/macro-context")({
  server: {
    handlers: {
      GET: async () => {
        const cached = getCachedMacroContext();
        const macro = cached ?? await fetchRealMacroContext();
        const hasFred = Boolean(process.env.FRED_API_KEY);
        return new Response(
          JSON.stringify(
            {
              fredConnected: hasFred,
              dataSource: hasFred ? "fred_api" : "neutral_fallback",
              note: hasFred
                ? "Real FRED macro indicators (6h cache)"
                : "FRED_API_KEY not configured — neutral fallback in use",
              macro,
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
