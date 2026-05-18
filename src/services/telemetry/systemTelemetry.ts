/** Live monitoring & telemetry — single source of truth for system health. */
export interface HealthPoint { ts: number; latencyMs: number; ok: boolean; component: string; }
const points: HealthPoint[] = [];
const MAX = 500;

export function record(component: string, latencyMs: number, ok = true) {
  points.unshift({ ts: Date.now(), latencyMs, ok, component });
  if (points.length > MAX) points.pop();
}
export function snapshot() {
  const byComp: Record<string, { avgLatency: number; uptime: number; samples: number }> = {};
  const groups: Record<string, HealthPoint[]> = {};
  for (const p of points) (groups[p.component] ??= []).push(p);
  for (const [k, v] of Object.entries(groups)) {
    const avg = v.reduce((s, p) => s + p.latencyMs, 0) / v.length;
    const up = v.filter((p) => p.ok).length / v.length;
    byComp[k] = { avgLatency: Math.round(avg), uptime: Number(up.toFixed(3)), samples: v.length };
  }
  return { byComp, total: points.length, lastTs: points[0]?.ts ?? null };
}
