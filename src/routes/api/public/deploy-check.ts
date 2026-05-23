import { createFileRoute } from "@tanstack/react-router";

const BUILD_TIME = new Date().toISOString();

export const Route = createFileRoute("/api/public/deploy-check")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({
          gitCommit: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? "local",
          buildTime: BUILD_TIME,
          routePackVersion: "raneem-treasury-broker-v1",
          uiBugFixPack: "v1",
          uiRepairPack: "v2",
          pagesSafeMode: true,
          providerHealthFixed: true,
          developerButtonHidden: true,
          portfolioAiRedirected: true,
          heatmapFixed: true,
          calendarFixed: true,
          companyProfileRoute: true,
          treasuryRoute: true,
          brokerRoute: true,
          executionRoute: true,
          governanceRoute: true,
          liveExecutionEnabled: false,
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
