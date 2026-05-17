// Autonomous AI Trading Controller — decides whether the AI may act on a
// trade plan given current risk + emergency state. Defaults to safe / paused.
import type { TradePlan } from "@/services/execution/tradePlanner";
import { evaluateRisk, type RiskInputs, type RiskReport } from "@/services/risk/globalRiskEngine";
import { getEmergencyState } from "@/services/risk/emergencyProtection";

export type AutonomyMode = "off" | "advisory" | "semi-auto" | "full-auto";
export type AutonomyAction = "open" | "close" | "reduce" | "tighten-stop" | "pause" | "skip";

export interface AutonomyConfig {
  mode: AutonomyMode;
  minConfidence: number;     // 0-100
  requireApproval: boolean;
}

export const DEFAULT_AUTONOMY: AutonomyConfig = {
  mode: "off",
  minConfidence: 75,
  requireApproval: true,
};

let CONFIG: AutonomyConfig = { ...DEFAULT_AUTONOMY };

export function getAutonomyConfig(): AutonomyConfig { return CONFIG; }
export function setAutonomyConfig(patch: Partial<AutonomyConfig>): AutonomyConfig {
  CONFIG = { ...CONFIG, ...patch };
  return CONFIG;
}

export interface AutonomyDecision {
  action: AutonomyAction;
  plan?: TradePlan;
  reason: string;
  requiresApproval: boolean;
  riskState: RiskReport["state"];
  blocked: boolean;
}

export function decide(plan: TradePlan, risk: RiskInputs): AutonomyDecision {
  const emergency = getEmergencyState();
  const riskReport = evaluateRisk(risk);

  if (emergency.active) {
    return { action: "pause", reason: emergency.message ?? "Emergency stop active", requiresApproval: false, riskState: "shutdown", blocked: true, plan };
  }
  if (CONFIG.mode === "off") {
    return { action: "skip", reason: "Autonomous mode disabled", requiresApproval: false, riskState: riskReport.state, blocked: true, plan };
  }
  if (riskReport.state === "shutdown") {
    return { action: "pause", reason: `Risk shutdown — ${riskReport.triggers.join("; ")}`, requiresApproval: false, riskState: riskReport.state, blocked: true, plan };
  }
  if (riskReport.autoReduce && risk.exposurePct > riskReport.recommendedExposurePct) {
    return { action: "reduce", reason: "Exposure above risk-adjusted limit", requiresApproval: false, riskState: riskReport.state, blocked: false, plan };
  }
  if (plan.riskProfile === "stand-aside" || plan.bias === "neutral") {
    return { action: "skip", reason: "No actionable edge", requiresApproval: false, riskState: riskReport.state, blocked: true, plan };
  }
  if (plan.confidence < CONFIG.minConfidence) {
    return { action: "skip", reason: `Confidence ${plan.confidence}% < ${CONFIG.minConfidence}%`, requiresApproval: false, riskState: riskReport.state, blocked: true, plan };
  }
  if (riskReport.blockNewEntries) {
    return { action: "tighten-stop", reason: "Defensive regime — only protective actions allowed", requiresApproval: false, riskState: riskReport.state, blocked: false, plan };
  }

  const requiresApproval = CONFIG.requireApproval || CONFIG.mode === "advisory" || CONFIG.mode === "semi-auto";
  return {
    action: "open",
    reason: `Plan accepted — confidence ${plan.confidence}%, ${plan.riskProfile}`,
    requiresApproval, riskState: riskReport.state, blocked: false, plan,
  };
}

export function decideBatch(plans: TradePlan[], risk: RiskInputs): AutonomyDecision[] {
  return plans.map((p) => decide(p, risk));
}
