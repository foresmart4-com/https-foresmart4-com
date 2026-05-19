// Confidence calibration — bins predictions by confidence and measures accuracy.
import type { ReplayDecision } from "./historicalReplay";

export interface CalibrationBucket {
  range: string; lower: number; upper: number;
  count: number; correct: number; accuracy: number; // 0..100
}

export interface CalibrationReport {
  buckets: CalibrationBucket[];
  brierScore: number;          // lower is better
  expectedCalibrationError: number; // 0..1
  overconfidence: number;      // avg(conf) - avg(acc)
  reliability: "excellent" | "good" | "fair" | "poor";
}

const BUCKETS = [
  [0, 30], [30, 50], [50, 65], [65, 80], [80, 90], [90, 100],
] as const;

export function calibrate(decisions: ReplayDecision[]): CalibrationReport {
  const considered = decisions.filter((d) => d.predictedDirection !== "flat" && d.actualDirection !== "flat");
  const buckets: CalibrationBucket[] = BUCKETS.map(([lo, hi]) => ({
    range: `${lo}-${hi}`, lower: lo, upper: hi, count: 0, correct: 0, accuracy: 0,
  }));
  let brierSum = 0;
  for (const d of considered) {
    const p = d.confidence / 100;
    const y = d.correct ? 1 : 0;
    brierSum += (p - y) ** 2;
    const b = buckets.find((b) => d.confidence >= b.lower && d.confidence < b.upper) ?? buckets.at(-1)!;
    b.count++; if (d.correct) b.correct++;
  }
  for (const b of buckets) b.accuracy = b.count ? +((b.correct / b.count) * 100).toFixed(1) : 0;
  const n = considered.length || 1;
  const ece = buckets.reduce((s, b) => {
    if (!b.count) return s;
    const meanConf = (b.lower + b.upper) / 2 / 100;
    const meanAcc = b.correct / b.count;
    return s + (b.count / n) * Math.abs(meanConf - meanAcc);
  }, 0);
  const avgConf = considered.reduce((s, d) => s + d.confidence, 0) / n;
  const avgAcc = (considered.filter((d) => d.correct).length / n) * 100;
  const over = +(avgConf - avgAcc).toFixed(2);
  const reliability: CalibrationReport["reliability"] =
    ece < 0.05 ? "excellent" : ece < 0.1 ? "good" : ece < 0.2 ? "fair" : "poor";
  return {
    buckets,
    brierScore: +(brierSum / n).toFixed(4),
    expectedCalibrationError: +ece.toFixed(4),
    overconfidence: over,
    reliability,
  };
}
