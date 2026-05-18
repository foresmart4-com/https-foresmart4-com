/** Unified alert engine — fans events into channels (browser, email, mobile, emergency). */
export type AlertChannel = "browser" | "email" | "mobile" | "emergency";
export type AlertSeverity = "info" | "warn" | "critical";
export interface AlertEvent {
  id: string;
  ts: number;
  title: string;
  body: string;
  severity: AlertSeverity;
  channels: AlertChannel[];
  category: "ai_decision" | "execution" | "risk" | "profit" | "system";
  meta?: Record<string, unknown>;
}

type Listener = (e: AlertEvent) => void;
const listeners = new Set<Listener>();
const buffer: AlertEvent[] = [];

export function onAlert(fn: Listener) { listeners.add(fn); return () => listeners.delete(fn); }
export function emitAlert(e: Omit<AlertEvent, "id"|"ts">): AlertEvent {
  const full: AlertEvent = { ...e, id: crypto.randomUUID(), ts: Date.now() };
  buffer.unshift(full); if (buffer.length > 200) buffer.pop();
  for (const fn of listeners) try { fn(full); } catch {}
  return full;
}
export function recentAlerts(n = 50) { return buffer.slice(0, n); }
