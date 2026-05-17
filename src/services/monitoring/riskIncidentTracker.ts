// Risk Incident Tracker — records risk breaches & emergency events.
export type IncidentKind =
  | "abnormal-loss" | "extreme-volatility" | "execution-anomaly"
  | "emergency-shutdown" | "risk-breach" | "ai-instability";
export type IncidentSeverity = "low" | "moderate" | "high" | "critical";

export interface RiskIncident {
  id: string;
  ts: number;
  kind: IncidentKind;
  severity: IncidentSeverity;
  message: string;
  recommendation: string;
  metadata?: Record<string, unknown>;
  resolvedAt?: number;
}

const KEY = "fs.riskIncidents.v1";
const MAX = 100;
let LOG: RiskIncident[] = load();

function load(): RiskIncident[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
function save() {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(LOG.slice(0, MAX))); } catch { /* quota */ }
}

const SEVERITY_RANK: Record<IncidentSeverity, number> = { low: 1, moderate: 2, high: 3, critical: 4 };

export function reportIncident(input: Omit<RiskIncident, "id" | "ts" | "recommendation"> & { recommendation?: string }): RiskIncident {
  const inc: RiskIncident = {
    id: `INC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    recommendation: input.recommendation ?? recommend(input.kind, input.severity),
    ...input,
  };
  LOG.unshift(inc);
  if (LOG.length > MAX) LOG.length = MAX;
  save();
  return inc;
}

export function resolveIncident(id: string): RiskIncident | null {
  const i = LOG.findIndex((x) => x.id === id);
  if (i < 0) return null;
  LOG[i] = { ...LOG[i], resolvedAt: Date.now() };
  save();
  return LOG[i];
}

export function getIncidents(limit = 30): RiskIncident[] { return LOG.slice(0, limit); }

export function incidentSummary(): { open: number; critical: number; high: number; severityScore: number } {
  const open = LOG.filter((i) => !i.resolvedAt);
  const critical = open.filter((i) => i.severity === "critical").length;
  const high = open.filter((i) => i.severity === "high").length;
  const severityScore = open.reduce((a, i) => a + SEVERITY_RANK[i.severity], 0);
  return { open: open.length, critical, high, severityScore };
}

function recommend(kind: IncidentKind, sev: IncidentSeverity): string {
  if (sev === "critical") return "Halt autonomous trading and review immediately.";
  switch (kind) {
    case "abnormal-loss": return "Reduce position sizes and pause new entries.";
    case "extreme-volatility": return "Tighten stops; switch to defensive mode.";
    case "execution-anomaly": return "Verify broker connectivity and order routing.";
    case "emergency-shutdown": return "Investigate root cause before re-enabling AI.";
    case "risk-breach": return "Lower exposure and recalibrate risk limits.";
    case "ai-instability": return "Pause autonomous mode; require manual approval.";
  }
}
