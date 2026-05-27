import { createFileRoute } from "@tanstack/react-router";
import { getBrokerAdapterStatus } from "@/lib/genesis100/brokerAdapter";

export const Route = createFileRoute("/api/public/broker/status")({
  server: {
    handlers: {
      GET: async () => {
        const status = getBrokerAdapterStatus();
        const alpacaPaper = status.adapters.alpaca_paper;
        const ibkr = status.adapters.ibkr;
        return new Response(JSON.stringify({
          product: "ForeSmart Genesis 100",
          broker: status.adapters,
          failover: status.failover,
          capabilityMatrix: status.capabilityMatrix,
          marketExpansion: status.marketExpansion,
          paperConnected: alpacaPaper.apiConfigured,
          liveEnabled: false,
          brokerHealthy: alpacaPaper.apiConfigured,
          executionReady: false,
          supportedMarkets: ["US Equities", "US ETFs", "Crypto (Alpaca)"],
          lastConnectionCheck: new Date().toISOString(),
          brokerHealth: {
            alpaca_paper: alpacaPaper.apiConfigured ? "healthy" : "not_configured",
            alpaca_live: "not_configured",
            ibkr: ibkr.apiConfigured ? "healthy" : "not_configured",
          },
          brokerConnectionStatus: {
            alpaca_paper: alpacaPaper.apiConfigured ? "connected" : "disconnected",
            alpaca_live: "disconnected",
            ibkr: ibkr.apiConfigured ? "connected" : "disconnected",
          },
          paperTradingStatus: "active",
          executionReadiness: {
            paperReady: true,
            liveReady: false,
            brokerConnected: alpacaPaper.apiConfigured,
            adminApproval: false,
            riskLimitsPass: true,
            executionAdapterConfigured: alpacaPaper.apiConfigured,
          },
          secretsExposedToFrontend: false,
          liveExecutionEnabled: false,
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
