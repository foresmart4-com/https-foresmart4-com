import { createFileRoute } from "@tanstack/react-router";
import { getGenesisArchive, getGenesisLearningState } from "@/lib/genesis100/engine";
import { analyzeLearningOutcomes } from "@/lib/genesis100/algorithms/learningEngine";
import { evaluateArchiveOutcomes, type LearningDecisionInput } from "@/lib/genesis100/learning/outcomeTracker";

export const Route = createFileRoute(
  "/api/public/genesis100/learning-insights"
)({
  server: {
    handlers: {
      GET: async () => {
        const { archive } = getGenesisArchive();
        const { learnedConsensusWeights } = getGenesisLearningState();

        // Build slim inputs for outcome evaluator
        const archiveForLearning: LearningDecisionInput[] = archive.map((d) => ({
          id: d.id,
          symbol: d.symbol,
          timestamp: d.timestamp,
          newRecommendation: d.newRecommendation,
          finalApprovalPercent: d.finalApprovalPercent ?? 50,
          quoteSnapshot: { price: d.quoteSnapshot.price },
          schoolScoresAtDecision: d.schoolScoresAtDecision ?? {},
          dominantSchoolAtDecision: d.dominantSchoolAtDecision ?? "unknown",
          assetClass: d.assetClass,
        }));

        // Evaluate against current market prices (no pre-fetched map here — uses routeQuote)
        const outcomes = await evaluateArchiveOutcomes(archiveForLearning).catch(() => []);
        const insights = analyzeLearningOutcomes(outcomes);

        const evaluated = outcomes.length;
        const correct = outcomes.filter((o) => o.wasCorrect === true).length;
        const incorrect = outcomes.filter((o) => o.wasCorrect === false).length;
        const pending = archive.length - evaluated;

        return new Response(
          JSON.stringify(
            {
              insights,
              evaluatedDecisions: evaluated,
              correctPredictions: correct,
              incorrectPredictions: incorrect,
              pendingEvaluation: pending,
              totalArchived: archive.length,
              learnedWeights: learnedConsensusWeights,
              arabicLearningReport: insights.arabicLearningReport,
              note: "Decisions evaluated after 7+ days. wasCorrect requires actual market data.",
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
