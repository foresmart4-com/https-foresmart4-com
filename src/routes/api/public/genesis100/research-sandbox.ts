import { createFileRoute } from "@tanstack/react-router";
import { computeResearchSandbox } from "@/services/research/researchSandbox";

export const Route = createFileRoute("/api/public/genesis100/research-sandbox")({
  server: {
    handlers: {
      GET: async () => {
        const result = computeResearchSandbox({
          thesisCount: 0,
          competingTheses: false,
          scenarioSpread: "narrow",
          frameworkConflict: false,
          historicalAnalogActive: false,
          uncertaintyLevel: "low",
          debateBalance: "inconclusive",
          governanceState: "coherent",
          learningGovernance: "learning_active",
          firewallState: "cleared",
          ar: false,
        });
        return new Response(JSON.stringify({
          ...result,
          infrastructure: "phase_49_research_sandbox",
          note: "Sandbox is exploratory only. No execution. No trading. No governance override. No auto-ingestion.",
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
