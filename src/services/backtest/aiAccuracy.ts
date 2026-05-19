// AI decision accuracy analytics over replayed decisions.
import type { ReplayDecision } from "./historicalReplay";

export interface AIAccuracyReport {
  totalDecisions: number;
  actionable: number;
  hits: number;
  misses: number;
  hitRate: number;       // 0..100
  precisionBuy: number;
  precisionSell: number;
  recallUp: number;
  recallDown: number;
  f1: number;
  avgConfidenceWhenRight: number;
  avgConfidenceWhenWrong: number;
  highConfidenceHitRate: number; // conf >= 75
  edge: number;           // hitRate - 50
}

export function analyzeAIAccuracy(decisions: ReplayDecision[]): AIAccuracyReport {
  const actionable = decisions.filter((d) => d.predictedDirection !== "flat" && d.actualDirection !== "flat");
  const hits = actionable.filter((d) => d.correct).length;
  const misses = actionable.length - hits;
  const hitRate = actionable.length ? (hits / actionable.length) * 100 : 0;

  const buy = actionable.filter((d) => d.action === "buy");
  const sell = actionable.filter((d) => d.action === "sell");
  const precisionBuy = buy.length ? (buy.filter((d) => d.correct).length / buy.length) * 100 : 0;
  const precisionSell = sell.length ? (sell.filter((d) => d.correct).length / sell.length) * 100 : 0;

  const ups = actionable.filter((d) => d.actualDirection === "up");
  const downs = actionable.filter((d) => d.actualDirection === "down");
  const recallUp = ups.length ? (ups.filter((d) => d.action === "buy").length / ups.length) * 100 : 0;
  const recallDown = downs.length ? (downs.filter((d) => d.action === "sell").length / downs.length) * 100 : 0;

  const precAvg = (precisionBuy + precisionSell) / 2;
  const recAvg = (recallUp + recallDown) / 2;
  const f1 = precAvg + recAvg > 0 ? (2 * precAvg * recAvg) / (precAvg + recAvg) : 0;

  const right = actionable.filter((d) => d.correct);
  const wrong = actionable.filter((d) => !d.correct);
  const avgRight = right.length ? right.reduce((s, d) => s + d.confidence, 0) / right.length : 0;
  const avgWrong = wrong.length ? wrong.reduce((s, d) => s + d.confidence, 0) / wrong.length : 0;
  const high = actionable.filter((d) => d.confidence >= 75);
  const highRate = high.length ? (high.filter((d) => d.correct).length / high.length) * 100 : 0;

  return {
    totalDecisions: decisions.length,
    actionable: actionable.length,
    hits, misses,
    hitRate: +hitRate.toFixed(2),
    precisionBuy: +precisionBuy.toFixed(2),
    precisionSell: +precisionSell.toFixed(2),
    recallUp: +recallUp.toFixed(2),
    recallDown: +recallDown.toFixed(2),
    f1: +f1.toFixed(2),
    avgConfidenceWhenRight: +avgRight.toFixed(2),
    avgConfidenceWhenWrong: +avgWrong.toFixed(2),
    highConfidenceHitRate: +highRate.toFixed(2),
    edge: +(hitRate - 50).toFixed(2),
  };
}
