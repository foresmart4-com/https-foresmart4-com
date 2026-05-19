import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadRecords, autoResolveExpired, generateSyntheticHistory, recordRecommendationsBulk,
  buildScorecard, buildCalibration, detectDrift, falsePositiveAnalysis,
  buildPerformance, agingAnalytics, regimeAnalytics, agentAnalytics,
  hallucinationAnalytics,
} from "@/services/ai-validation";
import type { CombinedRecord } from "@/services/ai-validation";

export function useAIValidation(seedIfEmpty = true) {
  const [records, setRecords] = useState<CombinedRecord[]>([]);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => {
    let rs = loadRecords();
    if (!rs.length && seedIfEmpty) {
      const seeded = generateSyntheticHistory(7, 140);
      recordRecommendationsBulk(seeded);
      rs = loadRecords();
    }
    setRecords(rs);
  }, [seedIfEmpty]);

  useEffect(() => { reload(); }, [reload]);
  // Auto-resolve expired predictions every minute against last-known exits
  useEffect(() => {
    const i = setInterval(() => {
      autoResolveExpired({});
      setTick((t) => t + 1);
    }, 60_000);
    return () => clearInterval(i);
  }, []);

  const analytics = useMemo(() => ({
    scorecard: buildScorecard(records),
    calibration: buildCalibration(records),
    drift: detectDrift(records),
    falsePositives: falsePositiveAnalysis(records),
    performance: buildPerformance(records),
    aging: agingAnalytics(records),
    regime: regimeAnalytics(records),
    agents: agentAnalytics(records),
    hallucination: hallucinationAnalytics(records),
  }), [records, tick]);

  return { records, analytics, reload };
}
