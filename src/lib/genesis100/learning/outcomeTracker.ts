// Outcome tracker — compares archived decisions against current prices
// to measure Genesis prediction accuracy. Never blocks the cycle.

import { routeQuote } from "@/lib/market/router";
import type { DecisionOutcome } from "@/lib/genesis100/algorithms/learningEngine";

// Minimal interface so engine.ts is the only caller importing us (no circular dep)
export interface LearningDecisionInput {
  id: string;
  symbol: string;
  timestamp: string;
  newRecommendation: string;
  finalApprovalPercent: number;
  quoteSnapshot: { price?: number | null };
  schoolScoresAtDecision: Record<string, number>;
  dominantSchoolAtDecision: string;
  assetClass: string;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Base stop-loss percentages matching riskManagement.ts defaults
const BASE_STOP_PCT: Record<string, number> = {
  crypto: 0.10,
  us_stock: 0.06,
  saudi_stock: 0.06,
  forex: 0.025,
  metal: 0.05,
  commodity: 0.07,
  etf: 0.06,
  macro: 0.04,
};

function directionFor(rec: string): "up" | "down" | "neutral" {
  const r = rec.toLowerCase();
  if (r === "strong_buy" || r === "buy" || r === "accumulate") return "up";
  if (r === "reduce" || r === "exit") return "down";
  return "neutral";
}

function wasDecisionCorrect(
  rec: string,
  entryPrice: number,
  currentPrice: number,
): boolean {
  const changePct = ((currentPrice - entryPrice) / entryPrice) * 100;
  const dir = directionFor(rec);
  if (dir === "up") return currentPrice > entryPrice * 1.01;
  if (dir === "down") return currentPrice < entryPrice * 0.99;
  return Math.abs(changePct) < 3;
}

export async function evaluateArchiveOutcomes(
  archive: LearningDecisionInput[],
  currentPriceMap?: Map<string, number>,
): Promise<DecisionOutcome[]> {
  const now = Date.now();

  const eligible = archive.filter((d) => {
    const entryDate = new Date(d.timestamp).getTime();
    const entryPrice = d.quoteSnapshot.price;
    return (
      entryPrice != null &&
      entryPrice > 0 &&
      now - entryDate >= SEVEN_DAYS_MS
    );
  });

  if (eligible.length === 0) return [];

  const outcomes: DecisionOutcome[] = [];

  for (const d of eligible) {
    try {
      const entryPrice = d.quoteSnapshot.price!;
      const entryDate = new Date(d.timestamp).getTime();
      const daysHeld = (now - entryDate) / 86_400_000;

      // Use pre-fetched prices first (from current scoring cycle — no extra API calls)
      let currentPrice: number | null = currentPriceMap?.get(d.symbol) ?? null;

      if (currentPrice == null) {
        const q = await routeQuote(d.symbol);
        if (!q.success || q.price == null) continue;
        currentPrice = q.price;
      }

      const assetClass = d.assetClass;
      const stopPct = BASE_STOP_PCT[assetClass] ?? 0.07;
      const approxStopLoss = entryPrice * (1 - stopPct);
      const approxTP1 = entryPrice * (1 + stopPct * 1.5);

      const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
      const wasCorrect = wasDecisionCorrect(d.newRecommendation, entryPrice, currentPrice);

      outcomes.push({
        decisionId: d.id,
        symbol: d.symbol,
        action: d.newRecommendation,
        entryDate,
        entryPrice,
        predictedDirection: directionFor(d.newRecommendation),
        predictedConfidence: d.finalApprovalPercent,
        stopLossPrice: approxStopLoss,
        targetPrice: approxTP1,
        actualPriceAfter7d: daysHeld >= 7 ? currentPrice : undefined,
        actualPriceAfter14d: daysHeld >= 14 ? currentPrice : undefined,
        actualPriceAfter30d: daysHeld >= 30 ? currentPrice : undefined,
        wasCorrect,
        pnlPercent,
        hitStopLoss: currentPrice < approxStopLoss,
        hitTarget: currentPrice > approxTP1,
        schoolScoresAtDecision: d.schoolScoresAtDecision,
        dominantSchoolAtDecision: d.dominantSchoolAtDecision,
        regimeAtDecision: "unknown",
      });
    } catch {
      // Never block the cycle on individual evaluation failures
    }
  }

  return outcomes;
}
