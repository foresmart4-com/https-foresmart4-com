import { createFileRoute } from "@tanstack/react-router";
import { getGenesisArchive } from "@/lib/genesis100/engine";
import { analyzeLearningOutcomes } from "@/lib/genesis100/algorithms/learningEngine";

export const Route = createFileRoute(
  "/api/public/genesis100/learning-insights"
)({
  server: {
    handlers: {
      GET: async () => {
        const { archive } = getGenesisArchive();
        const outcomes = archive.map((d) => ({
          decisionId: d.id,
          symbol: d.symbol,
          action: d.recommendation,
          entryDate: new Date(d.timestamp).getTime(),
          entryPrice: 0,
          predictedDirection: (
            d.newRecommendation === "strong_buy" ||
            d.newRecommendation === "buy" ||
            d.newRecommendation === "accumulate"
              ? "up"
              : d.newRecommendation === "reduce" ||
                d.newRecommendation === "exit"
              ? "down"
              : "neutral"
          ) as "up" | "down" | "neutral",
          predictedConfidence: d.finalApprovalPercent ?? 50,
          stopLossPrice: 0,
          targetPrice: 0,
          wasCorrect: undefined,
          schoolScoresAtDecision: {},
          dominantSchoolAtDecision: "unknown",
          regimeAtDecision: "unknown",
        }));
        const insights = analyzeLearningOutcomes(outcomes);
        return new Response(JSON.stringify(insights, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
