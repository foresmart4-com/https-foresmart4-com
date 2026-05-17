// Security Monitor — aggregates anomalies into severity-tiered alerts.
import { snapshotAbuse } from "./rateLimiter";

export type Severity = "info" | "warning" | "critical";

export interface SecurityAlert {
  id: string;
  severity: Severity;
  category: "auth" | "execution" | "api" | "trading" | "session";
  message: string;
  at: number;
}

const ALERTS: SecurityAlert[] = [];
const MAX = 100;

export function pushAlert(a: Omit<SecurityAlert, "id" | "at">): SecurityAlert {
  const alert: SecurityAlert = { id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`, at: Date.now(), ...a };
  ALERTS.unshift(alert);
  if (ALERTS.length > MAX) ALERTS.length = MAX;
  return alert;
}

export function recentAlerts(limit = 20): SecurityAlert[] {
  return ALERTS.slice(0, limit);
}

export interface SecurityReport {
  threatScore: number;       // 0-100
  level: "stable" | "watch" | "elevated" | "critical";
  alerts: SecurityAlert[];
  recommendLockdown: boolean;
  summary: string;
}

export interface MonitorInputs {
  authRiskScore: number;       // from authSecurity
  failedLoginsLastHour: number;
  apiErrorRate: number;         // 0-1
  abnormalTrades: number;       // count
  executionAnomalyScore: number;// 0-100
}

export function evaluateSecurity(input: MonitorInputs): SecurityReport {
  const abuse = snapshotAbuse();
  let score = 0;
  score += input.authRiskScore * 0.25;
  score += Math.min(40, input.failedLoginsLastHour * 5);
  score += input.apiErrorRate * 30;
  score += Math.min(30, input.abnormalTrades * 6);
  score += input.executionAnomalyScore * 0.3;
  if (abuse.threat === "lockout") score += 25;
  else if (abuse.threat === "high") score += 15;
  else if (abuse.threat === "elevated") score += 8;
  score = Math.min(100, Math.round(score));

  const level: SecurityReport["level"] =
    score >= 80 ? "critical" : score >= 55 ? "elevated" : score >= 30 ? "watch" : "stable";

  return {
    threatScore: score,
    level,
    alerts: recentAlerts(10),
    recommendLockdown: level === "critical",
    summary:
      level === "critical" ? "Critical anomalies detected — lockdown recommended."
      : level === "elevated" ? "Elevated threat surface — heightened monitoring active."
      : level === "watch" ? "Minor anomalies present — no action required."
      : "Security posture nominal.",
  };
}
