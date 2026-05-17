// System Health Monitor — tracks infrastructure metrics.
export interface HealthSample {
  ts: number;
  apiLatencyMs: number;
  failedRequests: number;
  executionFailures: number;
  aiQuality: number;      // 0-100
  wsStable: boolean;
  brokerConnected: boolean;
  refreshDriftMs: number;
}
export interface HealthReport {
  stabilityScore: number;     // 0-100
  infrastructure: "healthy" | "degraded" | "unstable" | "critical";
  anomalies: string[];
  lastSample?: HealthSample;
  samples: HealthSample[];
}

const SAMPLES: HealthSample[] = [];
const MAX = 60;

export function recordHealth(sample: Partial<HealthSample> = {}): HealthSample {
  const s: HealthSample = {
    ts: Date.now(),
    apiLatencyMs: sample.apiLatencyMs ?? 0,
    failedRequests: sample.failedRequests ?? 0,
    executionFailures: sample.executionFailures ?? 0,
    aiQuality: sample.aiQuality ?? 85,
    wsStable: sample.wsStable ?? true,
    brokerConnected: sample.brokerConnected ?? true,
    refreshDriftMs: sample.refreshDriftMs ?? 0,
  };
  SAMPLES.unshift(s);
  if (SAMPLES.length > MAX) SAMPLES.length = MAX;
  return s;
}

export function evaluateHealth(): HealthReport {
  const last = SAMPLES[0];
  if (!last) {
    return { stabilityScore: 100, infrastructure: "healthy", anomalies: [], samples: [] };
  }
  const anomalies: string[] = [];
  let score = 100;

  if (last.apiLatencyMs > 800) { anomalies.push(`High API latency ${last.apiLatencyMs}ms`); score -= 15; }
  else if (last.apiLatencyMs > 400) { anomalies.push("Elevated API latency"); score -= 6; }

  if (last.failedRequests > 5) { anomalies.push(`${last.failedRequests} failed requests`); score -= 12; }
  if (last.executionFailures > 0) { anomalies.push(`${last.executionFailures} execution failures`); score -= 20; }
  if (!last.wsStable) { anomalies.push("Websocket unstable"); score -= 15; }
  if (!last.brokerConnected) { anomalies.push("Broker disconnected"); score -= 25; }
  if (last.aiQuality < 60) { anomalies.push(`AI quality low (${last.aiQuality})`); score -= 10; }
  if (last.refreshDriftMs > 5000) { anomalies.push("Refresh cycle drifting"); score -= 5; }

  score = Math.max(0, Math.min(100, score));
  const infrastructure: HealthReport["infrastructure"] =
    score >= 85 ? "healthy" : score >= 65 ? "degraded" : score >= 40 ? "unstable" : "critical";

  return { stabilityScore: score, infrastructure, anomalies, lastSample: last, samples: SAMPLES.slice(0, 30) };
}
