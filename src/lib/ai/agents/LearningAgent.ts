import { getRouterDiagnostics } from "@/lib/market/router";
import { getGenesisArchiveSummary } from "@/lib/genesis100/engine";
import { AI_CORE_VERSION, AI_INSUFFICIENT_HISTORY_AR, AI_SAFETY_FLAGS, safeRead } from "@/lib/ai/core/safety";
import { getMacroFeed } from "@/lib/ai/feeds/macroFeed";
import { getNewsFeed } from "@/lib/ai/feeds/newsFeed";
import { getAIMemoryStatus } from "@/lib/ai/memory/store";
import { getSourceCredibilityReport } from "@/lib/ai/credibility/sourceCredibility";

export class LearningAgent {
  async analyze() {
    const router = await safeRead(() => getRouterDiagnostics(), null);
    const archive = await safeRead(() => getGenesisArchiveSummary(), null);
    const [macroFeed, newsFeed, memory, sourceCredibility] = await Promise.all([
      safeRead(() => getMacroFeed(), null),
      safeRead(() => getNewsFeed(), null),
      safeRead(() => getAIMemoryStatus(), null),
      safeRead(() => getSourceCredibilityReport(), null),
    ]);
    const metrics = router?.metrics ? Object.keys(router.metrics).length : 0;
    const historyDepth = (archive?.count ?? 0) + metrics;
    const learningReady = historyDepth >= 50;

    return {
      aiCoreVersion: AI_CORE_VERSION,
      learningReady,
      dataCoverage: {
        providerMetricCount: metrics,
        decisionArchiveCount: archive?.count ?? 0,
      },
      historyDepth,
      learningStatus: learningReady ? "ready_for_model_training" : AI_INSUFFICIENT_HISTORY_AR,
      noteAr: learningReady ? "البيانات كافية لبدء التعلم التحليلي." : AI_INSUFFICIENT_HISTORY_AR,
      macroFeedConnected: Boolean(macroFeed?.availableIndicators?.length),
      newsFeedConnected: Boolean(newsFeed?.items?.length),
      memoryConnected: Boolean(memory?.memoryConnected),
      sourceCredibilityConnected: Boolean(sourceCredibility?.sources?.length),
      learningCycleReady: Boolean(memory?.learningReady),
      ...AI_SAFETY_FLAGS,
    };
  }
}
