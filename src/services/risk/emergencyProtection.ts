// Emergency Protection — global kill-switch for autonomous trading.
export type EmergencyReason =
  | "manual" | "api-instability" | "abnormal-loss" | "extreme-volatility"
  | "ai-instability" | "execution-anomaly";

export interface EmergencyState {
  active: boolean;
  reason?: EmergencyReason;
  triggeredAt?: number;
  message?: string;
}

let STATE: EmergencyState = { active: false };
const LISTENERS = new Set<(s: EmergencyState) => void>();

export function getEmergencyState(): EmergencyState { return STATE; }

export function subscribeEmergency(cb: (s: EmergencyState) => void): () => void {
  LISTENERS.add(cb);
  return () => LISTENERS.delete(cb);
}

function emit() { for (const cb of LISTENERS) cb(STATE); }

export function triggerEmergency(reason: EmergencyReason, message?: string): EmergencyState {
  STATE = { active: true, reason, triggeredAt: Date.now(), message: message ?? defaultMessage(reason) };
  emit();
  return STATE;
}

export function clearEmergency(): EmergencyState {
  STATE = { active: false };
  emit();
  return STATE;
}

export interface EmergencyInputs {
  apiErrorsPerMin: number;
  lossPct: number;
  volatility: number;
  aiAnomalyScore: number;     // 0-100
  rejectionRate: number;       // 0-100
}

export function evaluateEmergency(input: EmergencyInputs): EmergencyState | null {
  if (input.apiErrorsPerMin >= 10) return triggerEmergency("api-instability", `API errors ${input.apiErrorsPerMin}/min`);
  if (input.lossPct >= 5) return triggerEmergency("abnormal-loss", `Loss ${input.lossPct.toFixed(1)}%`);
  if (input.volatility >= 90) return triggerEmergency("extreme-volatility", `Vol ${input.volatility}`);
  if (input.aiAnomalyScore >= 80) return triggerEmergency("ai-instability", "AI anomaly detected");
  if (input.rejectionRate >= 50) return triggerEmergency("execution-anomaly", `Rejection rate ${input.rejectionRate}%`);
  return null;
}

function defaultMessage(r: EmergencyReason): string {
  switch (r) {
    case "manual": return "Emergency stop activated manually.";
    case "api-instability": return "Broker API unstable — trading halted.";
    case "abnormal-loss": return "Abnormal loss detected — trading halted.";
    case "extreme-volatility": return "Extreme market volatility — trading halted.";
    case "ai-instability": return "AI reasoning anomaly — autonomous mode disabled.";
    case "execution-anomaly": return "Execution anomaly detected — trading halted.";
  }
}
