import { resolveAsset } from "@/lib/market/router";
import { getLatestSnapshot, getSnapshotHistory } from "@/lib/market/snapshots";
import { addMemoryEvent, getMemoryEvents } from "@/lib/ai/memory/store";
import { getSourceCredibilityReport } from "@/lib/ai/credibility/sourceCredibility";
import { getGenesisArchiveSummary } from "@/lib/genesis100/engine";
import { getBacktestStatus } from "@/lib/ai/backtesting/backtestEngine";
import { AI_SAFETY_FLAGS } from "@/lib/ai/core/safety";

export type PredictionDirection = "up" | "down" | "flat";

export interface AIPrediction {
  predictionId: string;
  symbol: string;
  predictionTime: string;
  expectedDirection: PredictionDirection;
  expectedMovePercent: number;
  confidencePercent: number;
  reasonAr: string;
  actualOutcome: PredictionDirection | null;
  accuracyScore: number | null;
  errorReason: string | null;
  lessonLearnedAr: string | null;
  assetClass: string;
  confidenceTier: string;
}

const predictions: AIPrediction[] = [];

function confidenceTier(confidence: number) {
  if (confidence >= 80) return "high";
  if (confidence >= 60) return "medium";
  if (confidence >= 40) return "low";
  return "very_low";
}

function directionFromMove(value: number | null | undefined): PredictionDirection | null {
  if (typeof value !== "number") return null;
  if (value > 0.2) return "up";
  if (value < -0.2) return "down";
  return "flat";
}

function scorePrediction(prediction: AIPrediction, actual: PredictionDirection | null, actualMove: number | null): { score: number | null; lesson: string | null; error: string | null } {
  if (!actual || typeof actualMove !== "number") {
    return { score: null, lesson: null, error: "لا توجد نتيجة سوق فعلية كافية للتقييم." };
  }
  const directionScore = prediction.expectedDirection === actual ? 70 : 20;
  const moveError = Math.abs(Math.abs(prediction.expectedMovePercent) - Math.abs(actualMove));
  const magnitudeScore = Math.max(0, 30 - moveError * 5);
  const score = Math.round(Math.min(100, directionScore + magnitudeScore));
  return {
    score,
    lesson: score >= 70
      ? "النمط كان ناجحاً نسبياً ويمكن مراقبته في ظروف مشابهة."
      : "التنبؤ يحتاج معايرة أفضل بين الاتجاه وحجم الحركة الفعلي.",
    error: score >= 70 ? null : "انحراف بين التوقع والنتيجة الفعلية.",
  };
}

export async function createPrediction(request: Request) {
  const body = await request.json().catch(() => ({})) as Partial<AIPrediction>;
  const symbol = (body.symbol || "AAPL").toUpperCase();
  const confidence = Math.max(0, Math.min(100, Number(body.confidencePercent ?? 50)));
  const prediction: AIPrediction = {
    predictionId: body.predictionId || `pred-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    symbol,
    predictionTime: new Date().toISOString(),
    expectedDirection: body.expectedDirection && ["up", "down", "flat"].includes(body.expectedDirection) ? body.expectedDirection : "flat",
    expectedMovePercent: Number(body.expectedMovePercent ?? 0),
    confidencePercent: confidence,
    reasonAr: body.reasonAr || "تنبؤ AI مسجل للمراجعة اللاحقة.",
    actualOutcome: null,
    accuracyScore: null,
    errorReason: null,
    lessonLearnedAr: null,
    assetClass: resolveAsset(symbol).assetClass,
    confidenceTier: confidenceTier(confidence),
  };
  predictions.unshift(prediction);
  if (predictions.length > 1000) predictions.length = 1000;
  addMemoryEvent({
    type: "agent_decision",
    title: `Prediction ${prediction.symbol}`,
    summaryAr: prediction.reasonAr,
    confidence,
    metadata: { predictionId: prediction.predictionId, symbol },
  });
  return { prediction, ...AI_SAFETY_FLAGS };
}

export async function evaluatePredictions(request: Request) {
  const body = await request.json().catch(() => ({})) as { predictionId?: string; symbol?: string };
  const target = predictions.filter((prediction) =>
    body.predictionId ? prediction.predictionId === body.predictionId
      : body.symbol ? prediction.symbol === body.symbol.toUpperCase()
        : prediction.accuracyScore == null,
  );
  const latest = getLatestSnapshot();
  let evaluated = 0;

  for (const prediction of target) {
    const entry = latest?.symbols.find((item) => item.symbol.toUpperCase() === prediction.symbol);
    const actualMove = entry?.changePercent ?? null;
    const actual = directionFromMove(actualMove);
    const result = scorePrediction(prediction, actual, actualMove);
    prediction.actualOutcome = actual;
    prediction.accuracyScore = result.score;
    prediction.errorReason = result.error;
    prediction.lessonLearnedAr = result.lesson;
    if (result.score != null) evaluated++;
    addMemoryEvent({
      type: result.score != null && result.score >= 70 ? "successful_pattern" : "failed_prediction",
      title: `Prediction evaluation ${prediction.symbol}`,
      summaryAr: result.lesson ?? result.error ?? "لا توجد بيانات كافية.",
      confidence: result.score ?? 0,
      metadata: { predictionId: prediction.predictionId, actualMove },
    });
  }

  return {
    evaluated,
    predictions: target,
    reasonAr: evaluated ? "تم تقييم التنبؤات المتاحة." : "لا توجد بيانات سوق فعلية كافية للتقييم.",
    ...AI_SAFETY_FLAGS,
  };
}

export function getPredictionHistory(symbol?: string | null) {
  const filtered = symbol ? predictions.filter((prediction) => prediction.symbol === symbol.toUpperCase()) : predictions;
  return {
    count: filtered.length,
    symbol: symbol ?? null,
    predictions: filtered,
    ...AI_SAFETY_FLAGS,
  };
}

export function getPredictionAccuracy() {
  const evaluated = predictions.filter((prediction) => typeof prediction.accuracyScore === "number");
  const overallAccuracy = evaluated.length
    ? Math.round(evaluated.reduce((sum, prediction) => sum + (prediction.accuracyScore ?? 0), 0) / evaluated.length)
    : 0;
  const by = <K extends string>(keyFn: (prediction: AIPrediction) => K) => {
    const out: Record<string, { count: number; accuracy: number }> = {};
    for (const prediction of evaluated) {
      const key = keyFn(prediction);
      out[key] ??= { count: 0, accuracy: 0 };
      out[key].count++;
      out[key].accuracy += prediction.accuracyScore ?? 0;
    }
    for (const key of Object.keys(out)) out[key].accuracy = Math.round(out[key].accuracy / Math.max(1, out[key].count));
    return out;
  };
  const memory = getMemoryEvents(50);
  const sourceCredibility = getSourceCredibilityReport();
  const archive = getGenesisArchiveSummary();
  const snapshots = getSnapshotHistory("daily", 30);
  const backtest = getBacktestStatus();
  const insufficientDataReasonAr = evaluated.length ? null : "لا توجد بيانات تقييم كافية بعد.";

  return {
    predictionTrackerVersion: "prediction-tracker-v1",
    overallAccuracy,
    evaluatedCount: evaluated.length,
    totalPredictions: predictions.length,
    accuracyByAssetClass: by((prediction) => prediction.assetClass),
    accuracyByConfidenceTier: by((prediction) => prediction.confidenceTier),
    bestPatterns: evaluated.filter((prediction) => (prediction.accuracyScore ?? 0) >= 70).slice(0, 10),
    failedPatterns: evaluated.filter((prediction) => (prediction.accuracyScore ?? 0) < 70).slice(0, 10),
    reasonAr: insufficientDataReasonAr,
    insufficientDataReasonAr,
    calibrationSuggestionAr: evaluated.length
      ? overallAccuracy >= 70 ? "المعايرة جيدة مبدئياً، استمر في جمع عينات أكثر." : "خفض وزن الثقة أو حسّن مصادر البيانات قبل رفع حجم القرار."
      : "لا توجد بيانات تقييم كافية بعد.",
    connectedContext: {
      genesisArchiveCount: archive.count,
      marketSnapshotCount: snapshots.length,
      memoryEvents: memory.length,
      sourceCredibilityAverage: sourceCredibility.averageCredibility,
      backtestReady: backtest.ready,
      backtestReasonAr: backtest.insufficientDataReasonAr ?? backtest.reasonAr,
    },
    ...AI_SAFETY_FLAGS,
  };
}
