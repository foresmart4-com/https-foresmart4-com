// Emergency Security Controls — global hard-stop layer that also halts AI trading.
import { triggerEmergency, clearEmergency, getEmergencyState } from "@/services/risk/emergencyProtection";
import { forceLogout } from "./authSecurity";
import { pushAlert } from "./securityMonitor";

export interface LockdownState {
  trading: boolean;
  ai: boolean;
  broker: boolean;
  account: boolean;
  since: number | null;
}

let STATE: LockdownState = { trading: false, ai: false, broker: false, account: false, since: null };
const LISTENERS = new Set<(s: LockdownState) => void>();

export function getLockdownState(): LockdownState { return STATE; }
export function subscribeLockdown(cb: (s: LockdownState) => void): () => void {
  LISTENERS.add(cb); return () => LISTENERS.delete(cb);
}
function emit() { for (const l of LISTENERS) l(STATE); }

export function freezeTrading(reason = "manual"): LockdownState {
  STATE = { ...STATE, trading: true, since: STATE.since ?? Date.now() };
  triggerEmergency("manual", `Trading frozen: ${reason}`);
  pushAlert({ severity: "critical", category: "trading", message: `Trading frozen — ${reason}` });
  emit();
  return STATE;
}

export function shutdownAI(reason = "manual"): LockdownState {
  STATE = { ...STATE, ai: true, since: STATE.since ?? Date.now() };
  triggerEmergency("ai-instability", `AI shutdown: ${reason}`);
  pushAlert({ severity: "critical", category: "execution", message: `AI shutdown — ${reason}` });
  emit();
  return STATE;
}

export function revokeBroker(reason = "manual"): LockdownState {
  STATE = { ...STATE, broker: true, since: STATE.since ?? Date.now() };
  pushAlert({ severity: "warning", category: "api", message: `Broker sessions revoked — ${reason}` });
  emit();
  return STATE;
}

export async function emergencyLogout(): Promise<void> {
  pushAlert({ severity: "critical", category: "session", message: "Emergency logout triggered." });
  await forceLogout();
}

export async function fullAccountLockdown(reason = "manual"): Promise<LockdownState> {
  STATE = { trading: true, ai: true, broker: true, account: true, since: Date.now() };
  triggerEmergency("manual", `Account lockdown: ${reason}`);
  pushAlert({ severity: "critical", category: "auth", message: `Account lockdown — ${reason}` });
  emit();
  return STATE;
}

export function releaseLockdown(): LockdownState {
  STATE = { trading: false, ai: false, broker: false, account: false, since: null };
  clearEmergency();
  pushAlert({ severity: "info", category: "session", message: "Lockdown released." });
  emit();
  return STATE;
}

export function emergencyMirror() {
  return { lockdown: STATE, emergency: getEmergencyState() };
}
