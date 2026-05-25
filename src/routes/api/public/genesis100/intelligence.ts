import { createFileRoute } from "@tanstack/react-router";
import { analyzeGenesisUniverse, getGenesisIntelligence } from "@/lib/genesis100/engine";
import { getMacroFeed } from "@/lib/ai/feeds/macroFeed";
import { getNewsFeed } from "@/lib/ai/feeds/newsFeed";
import { getAIMemoryStatus } from "@/lib/ai/memory/store";
import { getSourceCredibilityReport } from "@/lib/ai/credibility/sourceCredibility";
import { AI_SAFETY_FLAGS, safeRead } from "@/lib/ai/core/safety";

export const Route = createFileRoute("/api/public/genesis100/intelligence")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await analyzeGenesisUniverse();
        const [macroFeed, newsFeed, memory, sourceCredibility] = await Promise.all([
          safeRead(() => getMacroFeed(), null),
          safeRead(() => getNewsFeed(), null),
          safeRead(() => getAIMemoryStatus(), null),
          safeRead(() => getSourceCredibilityReport(), null),
        ]);
        return new Response(JSON.stringify({
          ...getGenesisIntelligence(request),
          macroFeedConnected: Boolean(macroFeed?.availableIndicators?.length),
          newsFeedConnected: Boolean(newsFeed?.items?.length),
          memoryConnected: Boolean(memory?.memoryConnected),
          sourceCredibilityConnected: Boolean(sourceCredibility?.sources?.length),
          learningCycleReady: Boolean(memory?.learningReady),
          ...AI_SAFETY_FLAGS,
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
