import { getGenesisAllocations, getGenesisArchiveSummary, getGenesisStatus } from "@/lib/genesis100/engine";
import { AI_CORE_VERSION, AI_SAFETY_FLAGS, AI_UNAVAILABLE_AR, safeRead } from "@/lib/ai/core/safety";

export class GenesisPortfolioAgent {
  async analyze() {
    const status = await safeRead(() => getGenesisStatus(), null);
    const allocations = await safeRead(() => getGenesisAllocations(), null);
    const archive = await safeRead(() => getGenesisArchiveSummary(), null);
    const allocationList = allocations?.allocations ?? [];
    const topWeight = allocationList.reduce((max, item) => Math.max(max, item.targetWeight ?? 0), 0);
    const concentration = topWeight > 0.08 ? "high" : topWeight > 0.05 ? "medium" : "low";
    const hasData = allocationList.length > 0 || (archive?.count ?? 0) > 0;

    return {
      aiCoreVersion: AI_CORE_VERSION,
      summaryAr: hasData
        ? `صحة محفظة Genesis جيدة للمراقبة. التركيز ${concentration} وعدد التخصيصات ${allocationList.length}.`
        : "لا توجد بيانات كافية",
      diversification: {
        allocationCount: allocationList.length,
        concentration,
        topWeight,
      },
      concentration,
      sectorExposure: allocationList.map((item) => ({ symbol: item.symbol, bucket: item.bucket, weight: item.targetWeight })),
      marketExposure: allocationList.map((item) => ({ symbol: item.symbol, assetClass: item.assetClass, value: item.targetValue })),
      portfolioHealth: hasData ? "monitoring_ready" : "insufficient_data",
      status,
      archiveSummary: archive,
      liveExecutionEnabled: false,
      ...AI_SAFETY_FLAGS,
    };
  }
}
