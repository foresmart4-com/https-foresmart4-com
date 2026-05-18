// AI Autopilot — orchestrates autonomous trading sessions (state-only on client).
import type { DecisionContext, AutoDecision } from "./decisionEngine";
import { makeDecision } from "./decisionEngine";

export type AutopilotMode = "off" | "advisory" | "semi-auto" | "full-auto";

export interface AutopilotState {
  mode: AutopilotMode;
  startedAt: number | null;
  confidenceThreshold: number;
  lastDecision: AutoDecision | null;
  decisionsToday: number;
  successRate: number;
  emergencyHalt: boolean;
}

const LISTENERS = new Set<(s: AutopilotState) => void>();
let STATE: AutopilotState = {
  mode: "off", startedAt: null, confidenceThreshold: 72,
  lastDecision: null, decisionsToday: 0, successRate: 0, emergencyHalt: false,
};

export function getAutopilotState() { return STATE; }
export function subscribeAutopilot(cb: (s: AutopilotState) => void) {
  LISTENERS.add(cb); return () => LISTENERS.delete(cb);
}
function emit() { for (const cb of LISTENERS) cb(STATE); }

export function setAutopilotMode(mode: AutopilotMode) {
  STATE = { ...STATE, mode, startedAt: mode === "off" ? null : (STATE.startedAt ?? Date.now()) };
  emit();
}

export function setConfidenceThreshold(v: number) {
  STATE = { ...STATE, confidenceThreshold: Math.max(50, Math.min(95, v)) };
  emit();
}

export function haltAutopilot(reason = "manual"): AutoDecision {
  const dec: AutoDecision = {
    action: "halt", asset: "*", confidence: 100, ts: Date.now(),
    rationale: `Autopilot halted: ${reason}`, regime: "Panic",
  };
  STATE = { ...STATE, emergencyHalt: true, mode: "off", lastDecision: dec };
  emit();
  return dec;
}

export function resumeAutopilot() {
  STATE = { ...STATE, emergencyHalt: false };
  emit();
}

export function recordDecision(ctx: DecisionContext): AutoDecision {
  const dec = makeDecision(ctx, STATE.confidenceThreshold);
  const success = dec.action !== "skip" && dec.action !== "halt";
  STATE = {
    ...STATE,
    lastDecision: dec,
    decisionsToday: STATE.decisionsToday + 1,
    successRate: Math.round((STATE.successRate * 0.8) + (success ? 20 : 0)),
  };
  emit();
  return dec;
}
