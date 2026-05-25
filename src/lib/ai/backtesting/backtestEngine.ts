import { getGenesisArchive, getGenesisArchiveSummary, type GenesisArchivedDecision } from "@/lib/genesis100/engine";
import { getSnapshotHistory } from "@/lib/market/snapshots";
import { getMemoryEvents } from "@/lib/ai/memory/store";
import { AI_SAFETY_FLAGS } from "@/lib/ai/core/safety";

export type BacktestPeriod = "7d" | "30d" | "90d" | "180d" | "1y";

const MIN_DECISIONS = 5;
const MIN_SNAPSHOTS = 2;

function parsePeriod(value: string | null): BacktestPeriod {
  const allowed: BacktestPeriod[] = ["7d", "30d", "90d", "180d", "1y"];
  return allowed.includes(value as BacktestPeriod) ? value as BacktestPeriod : "90d";
}

function emptyReason(period: BacktestPeriod) {
  return `لا توجد بيانات تاريخية كافية بعد لاختبار فترة ${period}. يلزم وجود قرارات مؤرشفة ولقطات سوق متعددة.`;
}

function archiveItems(): GenesisArchivedDecision[] {
  return getGenesisArchive().archive as GenesisArchivedDecision[];
}

function estimateDecisionReturn(decision: GenesisArchivedDecision, snapshots: ReturnType<typeof getSnapshotHistory>): number | null {
  const related = snapshots
    .flatMap((snapshot) => snapshot.symbols)
    .filter((entry) => entry.symbol.toUpperCase() === decision.symbol.toUpperCase() && typeof entry.changePercent === "number");
  if (related.length < 1) return null;
  const avgChange = related.reduce((sum, entry) => sum + (entry.changePercent ?? 0), 0) / related.length;
  const direction = ["strong_buy", "buy", "accumulate", "increase"].includes(decision.action) ? 1
    : ["reduce", "exit", "decrease"].includes(decision.action) ? -1
    : 0;
  if (direction === 0) return 0;
  return avgChange * direction * (decision.targetWeight || 0.01);
}

export function getBacktestStatus() {
  const archive = archiveItems();
  const snapshots = getSnapshotHistory("daily", 100);
  const memory = getMemoryEvents(100);
  const learningMemoryCount = memory.filter((item) => item.type === "learning_event").length;
  const ready = archive.length >= MIN_DECISIONS && snapshots.length >= MIN_SNAPSHOTS;
  return {
    backtestEngineVersion: "backtest-engine-v1",
    ready,
    genesisArchiveCount: archive.length,
    marketSnapshotCount: snapshots.length,
    learningMemoryCount,
    supportedPeriods: ["7d", "30d", "90d", "180d", "1y"] as BacktestPeriod[],
    reasonAr: ready ? "محرك الاختبار الخلفي جاهز." : emptyReason("90d"),
    ...AI_SAFETY_FLAGS,
  };
}

export function runGenesisBacktest(period: BacktestPeriod = "90d") {
  const archive = archiveItems();
  const snapshots = getSnapshotHistory("daily", 100);
  const archiveSummary = getGenesisArchiveSummary();
  const status = getBacktestStatus();

  if (!status.ready) {
    return {
      backtestEngineVersion: "backtest-engine-v1",
      period,
      ready: false,
      reasonAr: emptyReason(period),
      genesisArchiveCount: archive.length,
      marketSnapshotCount: snapshots.length,
      archiveSummary,
      ...AI_SAFETY_FLAGS,
    };
  }

  const evaluated = archive
    .map((decision) => ({ decision, estimatedReturn: estimateDecisionReturn(decision, snapshots) }))
    .filter((item): item is { decision: GenesisArchivedDecision; estimatedReturn: number } => item.estimatedReturn !== null);

  if (evaluated.length < MIN_DECISIONS) {
    return {
      backtestEngineVersion: "backtest-engine-v1",
      period,
      ready: false,
      reasonAr: emptyReason(period),
      evaluatedDecisionCount: evaluated.length,
      ...AI_SAFETY_FLAGS,
    };
  }

  const wins = evaluated.filter((item) => item.estimatedReturn > 0);
  const losses = evaluated.filter((item) => item.estimatedReturn < 0);
  const returns = evaluated.map((item) => item.estimatedReturn);
  const averageReturn = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const value of returns) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
  }
  const variance = returns.reduce((sum, value) => sum + (value - averageReturn) ** 2, 0) / returns.length;
  const sharpeProxy = variance > 0 ? averageReturn / Math.sqrt(variance) : 0;
  const best = evaluated.reduce((a, b) => a.estimatedReturn > b.estimatedReturn ? a : b);
  const worst = evaluated.reduce((a, b) => a.estimatedReturn < b.estimatedReturn ? a : b);
  const confidenceCalibration = Math.round(
    evaluated.reduce((sum, item) => sum + Math.abs((item.decision.decisionConfidencePercent ?? 0) - (item.estimatedReturn > 0 ? 75 : 35)), 0) / evaluated.length,
  );

  return {
    backtestEngineVersion: "backtest-engine-v1",
    period,
    ready: true,
    evaluatedDecisionCount: evaluated.length,
    winRate: Math.round((wins.length / evaluated.length) * 100),
    lossRate: Math.round((losses.length / evaluated.length) * 100),
    averageReturn: Number(averageReturn.toFixed(4)),
    maxDrawdown: Number(Math.abs(maxDrawdown).toFixed(4)),
    sharpeProxy: Number(sharpeProxy.toFixed(4)),
    bestDecision: { symbol: best.decision.symbol, action: best.decision.action, estimatedReturn: Number(best.estimatedReturn.toFixed(4)) },
    worstDecision: { symbol: worst.decision.symbol, action: worst.decision.action, estimatedReturn: Number(worst.estimatedReturn.toFixed(4)) },
    strategyAccuracy: Math.round((wins.length / evaluated.length) * 100),
    confidenceCalibration,
    lessonsLearnedAr: [
      "تم قياس القرارات المؤرشفة مقابل لقطات السوق المتاحة فقط.",
      "زيادة عمق اللقطات التاريخية تحسن جودة الاختبار الخلفي.",
      confidenceCalibration > 30 ? "تحتاج الثقة إلى معايرة أقوى." : "معايرة الثقة مقبولة مبدئياً.",
    ],
    ...AI_SAFETY_FLAGS,
  };
}

export async function runBacktestFromRequest(request: Request) {
  const url = new URL(request.url);
  return runGenesisBacktest(parsePeriod(url.searchParams.get("period")));
}

export function backtestReportFromRequest(request: Request) {
  const url = new URL(request.url);
  return runGenesisBacktest(parsePeriod(url.searchParams.get("period")));
}
