import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/ui-health")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({
          ok: true,
          uiRepairPack: "v3",
          contrastAuditFixed: true,
          disclaimerPersistenceFixed: true,
          disclaimerVersion: "v4",
          disclaimerPersistenceV4: true,
          disclaimerStorageKeys: [
            "foresmart_disclaimer_ack_v4",
            "foresmart_disclaimer_ack_v4:<userId>",
          ],
          repeatedFooterDisclaimerRemoved: true,
          developerButtonHidden: true,
          safeDataUtility: true,
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
          alertsLocalStorage: true,
          portfoliosLocalStorage: true,
          liveExecutionEnabled: false,
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
