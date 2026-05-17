// Confidence calibration — adjusts raw signal confidence based on
// timeframe agreement, volatility, sentiment alignment, news pressure
// and correlation stability. Capital preservation > overconfidence.
import type { Signal } from "@/services/signals/signalEngine";
import type { MarketSentimentScore } from "@/services/analysis/marketSentiment";
import type { TimeframeReport } from "@/services/quant/multiTimeframeEngine";
import type { RegimeReport } from "@/services/quant/regimeDetection";

export interface CalibratedSignal extends Signal {
  rawConfidence: number;
  calibratedConfidence: number;
  uncertainty: number; // 0..100
  notes: string[];
}

export interface ConfidenceSummary {
  averageRaw: number;
  averageCalibrated: number;
  averageUncertainty: number;
  stability: "stable" | "shaky" | "chaotic";
  reasoning: string;
}

export function calibrateSignals(
  signals: Signal[],
  tfReports: TimeframeReport[],
  regime: RegimeReport,
  sentiment: MarketSentimentScore,
): CalibratedSignal[] {
  const tfMap = new Map(tfReports.map((r) => [r.asset, r]));
  return signals.map((s) => {
    const notes: string[] = [];
    let adj = 0;
    const tf = tfMap.get(s.asset);

    if (tf) {
      const tfDelta = tf.agreement - 60;
      adj += tfDelta * 0.25;
      if (tf.agreement >= 80) notes.push(`MTF agreement ${tf.agreement}% — strong alignment`);
      else if (tf.agreement < 50) notes.push(`MTF agreement only ${tf.agreement}% — conflicting timeframes`);

      const sideBull = s.action === "BUY" && tf.shortBias === "bullish" && tf.macroBias === "bullish";
      const sideBear = s.action === "SELL" && tf.shortBias === "bearish" && tf.macroBias === "bearish";
      if (sideBull || sideBear) { adj += 6; notes.push("Short + macro bias confirm direction"); }

      if ((s.action === "BUY" && tf.macroBias === "bearish") ||
          (s.action === "SELL" && tf.macroBias === "bullish")) {
        adj -= 10; notes.push("Counter-trend versus macro bias");
      }
    }

    // Sentiment alignment
    const sAligned = (s.action === "BUY" && sentiment.score > 10) ||
                     (s.action === "SELL" && sentiment.score < -10);
    if (sAligned) { adj += 4; }
    else if (Math.abs(sentiment.score) > 20) { adj -= 6; notes.push("Sentiment conflicts with signal"); }

    // Volatility / regime penalties
    if (regime.regime === "Panic") { adj -= 18; notes.push("Panic regime — capital preservation"); }
    else if (regime.regime === "High Volatility") { adj -= 10; notes.push("Volatility elevated"); }
    else if (regime.regime === "Sideways" && s.action !== "HOLD") { adj -= 6; notes.push("Range-bound regime"); }

    if (s.risk > 65) { adj -= 5; notes.push("Risk score elevated"); }

    const calibrated = Math.max(20, Math.min(95, Math.round(s.confidence + adj)));
    const uncertainty = Math.max(0, Math.min(100, 100 - calibrated + Math.round(regime.metrics.avgVol * 0.15)));

    return {
      ...s,
      rawConfidence: s.confidence,
      calibratedConfidence: calibrated,
      uncertainty,
      notes,
    };
  });
}

export function summarizeConfidence(calibrated: CalibratedSignal[]): ConfidenceSummary {
  if (calibrated.length === 0) {
    return { averageRaw: 0, averageCalibrated: 0, averageUncertainty: 100, stability: "chaotic", reasoning: "No signals." };
  }
  const r = calibrated.reduce((s, c) => s + c.rawConfidence, 0) / calibrated.length;
  const c = calibrated.reduce((s, c) => s + c.calibratedConfidence, 0) / calibrated.length;
  const u = calibrated.reduce((s, c) => s + c.uncertainty, 0) / calibrated.length;
  const drop = r - c;
  const stability: ConfidenceSummary["stability"] =
    u < 35 && drop < 6 ? "stable" : u < 55 ? "shaky" : "chaotic";
  const reasoning =
    stability === "stable" ? "Conditions support trusting AI conviction." :
    stability === "shaky" ? "Mixed alignment — size positions conservatively." :
    "Unstable conditions — confidence intentionally suppressed.";
  return {
    averageRaw: +r.toFixed(1),
    averageCalibrated: +c.toFixed(1),
    averageUncertainty: +u.toFixed(1),
    stability,
    reasoning,
  };
}
