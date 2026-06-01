import { createFileRoute } from "@tanstack/react-router";
import { getGenesisArchive, getGenesisLearningState } from "@/lib/genesis100/engine";
import { analyzeLearningOutcomes } from "@/lib/genesis100/algorithms/learningEngine";
import { evaluateArchiveOutcomes, type LearningDecisionInput } from "@/lib/genesis100/learning/outcomeTracker";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

        // Knowledge base health stats
        const knowledgeBaseStats = await (async () => {
          try {
            const { data: kbRows } = await supabaseAdmin
              .from("genesis_knowledge_base")
              .select("category, title, created_at")
              .neq("category", "system_meta")
              .order("created_at", { ascending: false });

            if (!kbRows?.length) return null;

            const byCategory: Record<string, number> = {};
            for (const row of kbRows) {
              byCategory[row.category] = (byCategory[row.category] ?? 0) + 1;
            }

            const centralBankRows = kbRows.filter((r) => r.category === "central_bank");
            const lastFOMCEntry = centralBankRows[0]?.title ?? null;

            return {
              total: kbRows.length,
              byCategory,
              newestEntry: kbRows[0]?.created_at ?? null,
              oldestEntry: kbRows[kbRows.length - 1]?.created_at ?? null,
              lastFOMCEntry,
            };
          } catch {
            return null;
          }
        })();

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
              knowledgeBaseStats,
              connectedSources: {
                worldBank: true,
                imf: true,
                bis: true,
                fred: !!process.env.FRED_API_KEY,
                fmp: !!process.env.FMP_API_KEY,
                twelvedata: !!process.env.TWELVEDATA_API_KEY,
                newsApi: !!process.env.NEWS_API_KEY,
                secEdgar: true,
                fedResearch: true,
                bisResearch: true,
              },
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
