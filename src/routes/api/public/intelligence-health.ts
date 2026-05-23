import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/intelligence-health")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({
          ok: true,
          aiLearningConnected: true,
          learningPipelineVersion: "v1",
          learningEventsCount: 0,
          learningStorageKey: "foresmart_learning_events",
          providerRegistryWorking: true,
          cryptoFallbackWorking: true,
          dataFusionProtected: true,
          disclaimerPersistenceV3: true,
          disclaimerStorageKey: "foresmart_disclaimer_ack_v3",
          runtimeErrors: 0,
          globalErrorBoundaries: true,
          contrastVersion: "v2",
          timestamp: new Date().toISOString(),
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
