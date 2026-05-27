export interface LearningEvent {
  id: string;
  symbol: string;
  market: string;
  timestamp: string;
  prediction: "up" | "down" | "neutral";
  confidence: number;
  expectedMove: number;
  actualMove: number | null;
  outcome: "win" | "loss" | "open" | "neutral";
  winLoss: boolean | null;
  strategy: string;
  source: "signal" | "decision_engine" | "watchlist" | "backtest" | "paper_trade" | "genesis100";
  riskScore: number;
}

export interface LearningStats {
  totalEvents: number;
  closedEvents: number;
  wins: number;
  losses: number;
  predictionAccuracy: number;
  avgExpectedMove: number;
  avgActualMove: number;
  successRate: number;
  confidenceCalibration: number;
  improvementTrend: number;
  strategyScores: Record<string, { wins: number; losses: number; accuracy: number }>;
  learningHistory: Array<{ date: string; accuracy: number; events: number }>;
}

const STORAGE_KEY = "foresmart_learning_events";
let eventsCache: LearningEvent[] | null = null;

function loadEvents(): LearningEvent[] {
  if (eventsCache) return eventsCache;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    eventsCache = raw ? JSON.parse(raw) : [];
  } catch { eventsCache = []; }
  return eventsCache!;
}

function saveEvents(events: LearningEvent[]): void {
  eventsCache = events;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, 1000))); } catch {}
}

export function recordLearningEvent(event: Omit<LearningEvent, "id">): LearningEvent {
  const events = loadEvents();
  const record: LearningEvent = { id: `LE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...event };
  events.unshift(record);
  saveEvents(events);
  return record;
}

export function closeLearningEvent(id: string, actualMove: number): LearningEvent | null {
  const events = loadEvents();
  const ev = events.find((e) => e.id === id);
  if (!ev) return null;
  ev.actualMove = actualMove;
  const predicted = ev.prediction === "up" ? 1 : ev.prediction === "down" ? -1 : 0;
  const actual = actualMove > 0.5 ? 1 : actualMove < -0.5 ? -1 : 0;
  ev.winLoss = predicted === actual;
  ev.outcome = ev.winLoss ? "win" : actual === 0 ? "neutral" : "loss";
  saveEvents(events);
  return ev;
}

export function getLearningEvents(limit = 100): LearningEvent[] {
  return loadEvents().slice(0, limit);
}

export function getLearningStats(): LearningStats {
  const events = loadEvents();
  const closed = events.filter((e) => e.outcome !== "open");
  const wins = closed.filter((e) => e.outcome === "win").length;
  const losses = closed.filter((e) => e.outcome === "loss").length;
  const totalClosed = closed.length;

  const predictionAccuracy = totalClosed > 0 ? Math.round((wins / totalClosed) * 100) : 0;
  const avgExpected = events.length > 0 ? events.reduce((s, e) => s + Math.abs(e.expectedMove), 0) / events.length : 0;
  const avgActual = closed.length > 0 ? closed.reduce((s, e) => s + Math.abs(e.actualMove ?? 0), 0) / closed.length : 0;
  const successRate = totalClosed > 0 ? Math.round((wins / totalClosed) * 100) : 0;

  const avgConf = events.length > 0 ? events.reduce((s, e) => s + e.confidence, 0) / events.length : 0;
  const confidenceCalibration = totalClosed > 0 ? Math.round(Math.abs(predictionAccuracy - avgConf * 100)) : 0;

  const strategyMap: Record<string, { wins: number; losses: number }> = {};
  for (const e of closed) {
    if (!strategyMap[e.strategy]) strategyMap[e.strategy] = { wins: 0, losses: 0 };
    if (e.outcome === "win") strategyMap[e.strategy].wins++;
    else strategyMap[e.strategy].losses++;
  }
  const strategyScores: LearningStats["strategyScores"] = {};
  for (const [k, v] of Object.entries(strategyMap)) {
    strategyScores[k] = { ...v, accuracy: Math.round((v.wins / (v.wins + v.losses)) * 100) };
  }

  const byDate: Record<string, { wins: number; total: number }> = {};
  for (const e of closed) {
    const d = e.timestamp.slice(0, 10);
    if (!byDate[d]) byDate[d] = { wins: 0, total: 0 };
    byDate[d].total++;
    if (e.outcome === "win") byDate[d].wins++;
  }
  const learningHistory = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, v]) => ({ date, accuracy: Math.round((v.wins / v.total) * 100), events: v.total }));

  const recent = learningHistory.slice(-7);
  const older = learningHistory.slice(-14, -7);
  const recentAvg = recent.length > 0 ? recent.reduce((s, r) => s + r.accuracy, 0) / recent.length : 0;
  const olderAvg = older.length > 0 ? older.reduce((s, r) => s + r.accuracy, 0) / older.length : 0;
  const improvementTrend = olderAvg > 0 ? Math.round(recentAvg - olderAvg) : 0;

  return {
    totalEvents: events.length,
    closedEvents: totalClosed,
    wins,
    losses,
    predictionAccuracy,
    avgExpectedMove: Math.round(avgExpected * 100) / 100,
    avgActualMove: Math.round(avgActual * 100) / 100,
    successRate,
    confidenceCalibration,
    improvementTrend,
    strategyScores,
    learningHistory,
  };
}
