// Self-evaluation — continuously rates the AI system's own quality.
import type { Signal } from "@/services/signals/signalEngine";
import type { CalibratedSignal } from "@/services/quant/confidenceEngine";
import type { RegimeReport } from "@/services/quant/regimeDetection";
import { computeStats } from "./signalMemory";
import type { PerformanceLearningReport } from "./performanceLearning";

export interface SelfEvaluationReport {
  systemHealth: number;        // 0-100
  signalQuality: number;       // 0-100
  confidenceRealism: number;   // 0-100 (calibration)
  riskCalibration: number;     // 0-100
  adaptationQuality: number;   // 0-100
  reasoningAccuracy: number;   // 0-100 (proxy)
  flags: Array<{ severity: "info" | "warning" | "critical"; message: string }>;
  summary: string;
}

function clamp(n: number) { return Math.max(0, Math.min(100, Math.round(n))); }

export function evaluateSelf(
  signals: Signal[],
  calibrated: CalibratedSignal[],
  regime: RegimeReport,
  learning: PerformanceLearningReport,
): SelfEvaluationReport {
  const stats = computeStats();
  const flags: SelfEvaluationReport["flags"] = [];

  // Signal quality: spread of confidence + share of non-HOLD
  const directional = signals.filter((s) => s.action !== "HOLD").length;
  const directionalShare = signals.length ? directional / signals.length : 0;
  const avgConf = signals.length ? signals.reduce((s, x) => s + x.confidence, 0) / signals.length : 0;
  const signalQuality = clamp(directionalShare * 60 + (avgConf - 40) * 0.8);

  // Confidence realism: closeness of high-conf accuracy to high-conf level
  let confidenceRealism = 60;
  if (stats.evaluated >= 6) {
    const gap = Math.abs(learning.highConfAccuracy - 70); // ideal high conf ≈ 70%+ wins
    confidenceRealism = clamp(100 - gap * 1.2);
    if (learning.highConfAccuracy < 50) {
      flags.push({ severity: "warning", message: `High-confidence accuracy ${learning.highConfAccuracy}% is below expected threshold — recalibrate.` });
    }
  } else {
    flags.push({ severity: "info", message: "Building calibration baseline — limited evaluated samples." });
  }

  // Risk calibration: avg risk should track regime stress
  const avgRisk = signals.length ? signals.reduce((s, x) => s + x.risk, 0) / signals.length : 50;
  const regimeStress = regime.regime === "Panic" ? 90
    : regime.regime === "High Volatility" ? 75
    : regime.regime === "Risk-Off" || regime.regime === "Trending Bearish" ? 60
    : regime.regime === "Sideways" ? 45 : 35;
  const riskGap = Math.abs(avgRisk - regimeStress);
  const riskCalibration = clamp(100 - riskGap * 1.4);
  if (riskGap > 30) {
    flags.push({ severity: "warning", message: `Risk readings (${Math.round(avgRisk)}) misaligned with ${regime.regime} stress level (${regimeStress}).` });
  }

  // Adaptation quality: did calibrated confidences differ from raw?
  let adapted = 0;
  for (const c of calibrated) {
    const raw = signals.find((s) => s.asset === c.asset)?.confidence ?? c.calibratedConfidence;
    if (Math.abs(raw - c.calibratedConfidence) >= 3) adapted++;
  }
  const adaptationQuality = clamp(calibrated.length ? (adapted / calibrated.length) * 100 + 20 : 40);

  // Reasoning accuracy proxy: win rate scaled
  const reasoningAccuracy = stats.evaluated >= 6 ? clamp(stats.winRate) : 55;

  // Composite system health
  const systemHealth = clamp(
    signalQuality * 0.2 + confidenceRealism * 0.25 + riskCalibration * 0.25
    + adaptationQuality * 0.15 + reasoningAccuracy * 0.15,
  );

  if (systemHealth < 45) flags.push({ severity: "critical", message: "System health degraded — favor capital preservation." });
  else if (systemHealth < 60) flags.push({ severity: "warning", message: "System operating below optimal calibration." });

  if (regime.regime === "Panic") {
    flags.push({ severity: "critical", message: "Panic regime detected — suppress aggressive entries." });
  }

  const summary = systemHealth >= 70
    ? "Adaptive intelligence operating within healthy calibration bands."
    : systemHealth >= 50
      ? "Adaptive intelligence functional; some calibration drift detected."
      : "Adaptive intelligence under stress — prioritize survival, await stabilization.";

  return {
    systemHealth, signalQuality, confidenceRealism, riskCalibration,
    adaptationQuality, reasoningAccuracy, flags, summary,
  };
}
