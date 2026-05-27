import { createFileRoute } from "@tanstack/react-router";
import { getEconomicCalendar } from "@/lib/ai/feeds/economicCalendar";

export const Route = createFileRoute("/api/ai/feeds/economic-calendar")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify(await getEconomicCalendar(), null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
    },
  },
});
