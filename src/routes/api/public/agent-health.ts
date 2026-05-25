import { createFileRoute } from "@tanstack/react-router";
import { getAgentHealth } from "@/lib/agent/engine";
import { getMacroFeed } from "@/lib/ai/feeds/macroFeed";
import { getNewsFeed } from "@/lib/ai/feeds/newsFeed";
import { getEconomicCalendar } from "@/lib/ai/feeds/economicCalendar";
import { getAIMemoryStatus } from "@/lib/ai/memory/store";
import { getSourceCredibilityReport } from "@/lib/ai/credibility/sourceCredibility";
import { AI_SAFETY_FLAGS, safeRead } from "@/lib/ai/core/safety";
import { getTrustedSourceHealth } from "@/lib/ai/sources/trustedSources";

export const Route = createFileRoute("/api/public/agent-health")({
  server: {
    handlers: {
      GET: async () => {
        const [macroFeed, newsFeed, economicCalendar, memory, sourceCredibility, sourceHealth] = await Promise.all([
          safeRead(() => getMacroFeed(), null),
          safeRead(() => getNewsFeed(), null),
          safeRead(() => getEconomicCalendar(), null),
          safeRead(() => getAIMemoryStatus(), null),
          safeRead(() => getSourceCredibilityReport(), null),
          safeRead(() => getTrustedSourceHealth(), null),
        ]);
        return new Response(JSON.stringify({
          product: "ForeSmart Genesis Agent",
          ...getAgentHealth(),
          macroFeedConnected: Boolean(macroFeed?.availableIndicators?.length),
          newsFeedConnected: Boolean(newsFeed?.items?.length),
          economicCalendarConnected: Boolean(economicCalendar?.calendarReady),
          memoryConnected: Boolean(memory?.memoryConnected),
          sourceCredibilityConnected: Boolean(sourceCredibility?.sources?.length),
          trustedSourcesConnected: Boolean(sourceHealth?.trustedSourcesConnected),
          sourceCredibilityAverage: sourceHealth?.sourceCredibilityAverage ?? sourceCredibility?.averageCredibility ?? 0,
          liveSourceCount: sourceHealth?.liveSourceCount ?? 0,
          fallbackSourceCount: sourceHealth?.fallbackSourceCount ?? 0,
          sourceWarningsAr: sourceHealth?.sourceWarningsAr ?? [],
          learningCycleReady: Boolean(memory?.learningReady),
          ...AI_SAFETY_FLAGS,
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
