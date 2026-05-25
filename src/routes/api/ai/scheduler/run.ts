import { createFileRoute } from "@tanstack/react-router";
import { MarketIntelligenceAgent } from "@/lib/ai/agents/MarketIntelligenceAgent";
import { getMacroFeed } from "@/lib/ai/feeds/macroFeed";
import { getNewsFeed } from "@/lib/ai/feeds/newsFeed";
import { runLearningCycle } from "@/lib/ai/learning/cycle";
import { analyzeGenesisUniverse, getGenesisIntelligence } from "@/lib/genesis100/engine";
import { AI_SAFETY_FLAGS } from "@/lib/ai/core/safety";

export const Route = createFileRoute("/api/ai/scheduler/run")({
  server: {
    handlers: {
      POST: async () => {
        const completedSteps: string[] = [];
        const failedSteps: string[] = [];
        let cycleId: string | null = null;

        const step = async (name: string, fn: () => Promise<unknown>) => {
          try {
            const result = await fn();
            if (name === "learning_cycle" && result && typeof result === "object" && "cycleId" in result) {
              cycleId = String((result as { cycleId: unknown }).cycleId);
            }
            completedSteps.push(name);
          } catch {
            failedSteps.push(name);
          }
        };

        await step("market_intelligence", () => new MarketIntelligenceAgent().analyze());
        await step("macro_feed", () => getMacroFeed());
        await step("news_feed", () => getNewsFeed());
        await step("learning_cycle", () => runLearningCycle());
        await step("genesis_intelligence_refresh", async () => {
          await analyzeGenesisUniverse();
          return getGenesisIntelligence();
        });

        return new Response(JSON.stringify({
          ok: failedSteps.length === 0,
          cycleId,
          completedSteps,
          failedSteps,
          summaryAr: failedSteps.length
            ? `اكتملت ${completedSteps.length} خطوات وفشلت ${failedSteps.length} خطوات.`
            : "اكتملت دورة الجدولة اليدوية بنجاح.",
          ...AI_SAFETY_FLAGS,
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
