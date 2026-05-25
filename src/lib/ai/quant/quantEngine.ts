import { getSnapshotHistory } from "@/lib/market/snapshots";
import { getMacroFeed } from "@/lib/ai/feeds/macroFeed";
import { getNewsFeed } from "@/lib/ai/feeds/newsFeed";
import { runGenesisBacktest } from "@/lib/ai/backtesting/backtestEngine";
import { getPredictionAccuracy } from "@/lib/ai/predictions/tracker";
import { getMemoryEvents } from "@/lib/ai/memory/store";
import { AI_SAFETY_FLAGS } from "@/lib/ai/core/safety";

const MIN_SNAPSHOTS = 5;
const MIN_MEMORY_EVENTS = 10;

export function getQuantStatus() {
  const snapshots = getSnapshotHistory("daily", 100);
  const memory = getMemoryEvents(100);
  const ready = snapshots.length >= MIN_SNAPSHOTS && memory.length >= MIN_MEMORY_EVENTS;
  return {
    quantVersion: "quant-ml-v1",
    ready,
    models: ["regime_prediction", "probabilistic_forecasting", "anomaly_detection", "factor_scoring", "signal_confidence"],
    marketHistoryDepth: snapshots.length,
    memoryDepth: memory.length,
    insufficientDataReasonAr: ready ? null : "لا توجد بيانات كمية كافية بعد: نحتاج تاريخ سوق وذاكرة تعلم أعمق.",
    ...AI_SAFETY_FLAGS,
  };
}

function factorScoresFromInputs(macro: Awaited<ReturnType<typeof getMacroFeed>>, news: Awaited<ReturnType<typeof getNewsFeed>>, backtest: ReturnType<typeof runGenesisBacktest>, accuracy: ReturnType<typeof getPredictionAccuracy>) {
  return {
    macroFactor: macro.confidencePercent,
    newsFactor: Math.min(100, (news.items?.length ?? 0) * 12),
    backtestFactor: "ready" in backtest && backtest.ready ? Number(backtest.strategyAccuracy ?? 0) : 0,
    predictionAccuracyFactor: accuracy.overallAccuracy,
    liquidityFactor: macro.liquiditySignal === "neutral" ? 60 : macro.liquiditySignal === "tightening_watch" ? 35 : 20,
  };
}

export async function runQuantModels() {
  const [macro, news] = await Promise.all([getMacroFeed(), getNewsFeed()]);
  const backtest = runGenesisBacktest("90d");
  const accuracy = getPredictionAccuracy();
  const status = getQuantStatus();
  const factorScores = factorScoresFromInputs(macro, news, backtest, accuracy);
  const averageFactor = Math.round(Object.values(factorScores).reduce((a, b) => a + b, 0) / Object.values(factorScores).length);

  if (!status.ready) {
    return {
      quantVersion: "quant-ml-v1",
      ready: false,
      predictedRegime: "insufficient_data",
      forecastConfidence: 0,
      marketStressProbability: null,
      anomalyWarnings: ["لا توجد بيانات كافية لتشغيل النماذج بدون نتائج مزيفة."],
      factorScores,
      predictionSummaryAr: status.insufficientDataReasonAr,
      insufficientDataReasonAr: status.insufficientDataReasonAr,
      ...AI_SAFETY_FLAGS,
    };
  }

  const marketStressProbability = Math.max(0, Math.min(100, 100 - averageFactor));
  const predictedRegime = marketStressProbability > 65 ? "risk_off" : marketStressProbability < 35 ? "risk_on" : "mixed";
  return {
    quantVersion: "quant-ml-v1",
    ready: true,
    predictedRegime,
    forecastConfidence: averageFactor,
    marketStressProbability,
    anomalyWarnings: marketStressProbability > 70 ? ["ارتفاع احتمالية ضغط السوق"] : [],
    factorScores,
    predictionSummaryAr: `النموذج الكمي يتوقع نظام ${predictedRegime} بثقة ${averageFactor}%.`,
    insufficientDataReasonAr: null,
    ...AI_SAFETY_FLAGS,
  };
}
