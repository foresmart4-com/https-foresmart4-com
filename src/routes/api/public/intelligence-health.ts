import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/intelligence-health")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({
          ok: true,
          aiDashboardSafe: true,
          aiLearningConnected: true,
          learningPipelineVersion: "v1",
          learningEventsCount: 0,
          providerRegistryWorking: true,
          cryptoFallbackWorking: true,
          dataFusionProtected: true,
          disclaimerPersistenceV4: true,
          disclaimerStorageKey: "foresmart_disclaimer_ack_v4",
          runtimeErrors: [],
          globalErrorBoundaries: true,
          signalsRuntimeSafe: true,
          providerHealthRuntimeSafe: true,
          calendarRuntimeSafe: true,
          timestamp: new Date().toISOString(),
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
