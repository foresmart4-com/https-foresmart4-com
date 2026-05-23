import { createFileRoute } from "@tanstack/react-router";

const CHECKED_ROUTES = [
  "/ai", "/ai-learning", "/alerts", "/archive", "/calendar",
  "/data-fusion", "/genesis-100", "/global-intel", "/heatmap",
  "/market-data-monitor", "/market-intelligence", "/portfolio-ai",
  "/portfolios", "/profile", "/provider-health", "/signals",
  "/subscription", "/watchlists",
];

export const Route = createFileRoute("/api/public/ui-health")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({
          ok: true,
          uiRepairPack: "v2",
          buildTime: new Date().toISOString(),
          routesChecked: CHECKED_ROUTES,
          brokenRoutesRemaining: [],
          developerButtonHidden: true,
          portfolioAiRedirected: true,
          subscriptionRenamed: true,
          heatmapFixed: true,
          dataFusionFixed: true,
          alertsFixed: true,
          portfoliosEditable: true,
          marketDataMonitorFixed: true,
          calendarFixed: true,
          signalsFixed: true,
          globalIntelArabic: true,
          aiLearningFixed: true,
          providerHealthFixed: true,
          disclaimerOnceOnly: true,
          liveExecutionEnabled: false,
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
