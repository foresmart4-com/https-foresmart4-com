import { createFileRoute } from "@tanstack/react-router";
import { computeGovernedKnowledgeAcquisition } from "@/services/knowledge/governedKnowledgeAcquisition";

export const Route = createFileRoute("/api/public/genesis100/knowledge-acquisition")({
  server: {
    handlers: {
      GET: async () => {
        const result = computeGovernedKnowledgeAcquisition({
          credibilityScore: 75,
          hasCompetingFramework: true,
          evidenceDurability: "high",
          institutionalRelevance: "high",
          historicalImportance: true,
          ideologicalRisk: "low",
          popularityDriven: false,
          hasSocialMediaOrigin: false,
          amplifiesCertainty: false,
          existingCorpusDiversity: "diverse",
          sandboxCandidateCount: 0,
          governanceState: "coherent",
          firewallState: "cleared",
          ar: false,
        });
        return new Response(JSON.stringify({
          ...result,
          infrastructure: "phase_50a_governed_knowledge_acquisition",
          note: "No live acquisition. No crawling. No downloading. No automatic ingestion. All sources require explicit human governance review before any corpus entry.",
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
