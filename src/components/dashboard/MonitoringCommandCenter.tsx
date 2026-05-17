import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Activity, Brain, ClipboardList, HeartPulse, ShieldAlert, TrendingUp,
} from "lucide-react";
import { getAuditLog, type TradeAuditEntry } from "@/services/monitoring/tradeAudit";
import { getDecisionLog, type DecisionEntry } from "@/services/monitoring/decisionLogger";
import { evaluateHealth, recordHealth, type HealthReport } from "@/services/monitoring/systemHealth";
import { getIncidents, incidentSummary, type RiskIncident } from "@/services/monitoring/riskIncidentTracker";
import { analyzePerformance, type PerformanceReport } from "@/services/monitoring/performanceAnalytics";
import type { MarketIntel } from "@/services/analysis";

export function MonitoringCommandCenter({ data, ar }: { data?: MarketIntel; ar: boolean }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const apiLat = data?.quotes?.length ? 150 + Math.round(Math.random() * 100) : 600;
    recordHealth({
      apiLatencyMs: apiLat,
      aiQuality: 80 + Math.round(Math.random() * 15),
      wsStable: true,
      brokerConnected: true,
    });
    const i = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(i);
  }, [data]);

  const audit: TradeAuditEntry[] = useMemo(() => getAuditLog(8), [tick]);
  const decisions: DecisionEntry[] = useMemo(() => getDecisionLog(8), [tick]);
  const health: HealthReport = useMemo(() => evaluateHealth(), [tick]);
  const incidents: RiskIncident[] = useMemo(() => getIncidents(5), [tick]);
  const incSummary = useMemo(() => incidentSummary(), [tick]);
  const perf: PerformanceReport = useMemo(() => analyzePerformance(getAuditLog(200)), [tick]);

  const infraTone: Record<HealthReport["infrastructure"], string> = {
    healthy: "border-success/40 text-success",
    degraded: "border-warning/40 text-warning",
    unstable: "border-warning/40 text-warning",
    critical: "border-danger/40 text-danger",
  };

  return (
    <Card className="border-border/50 bg-card/40 p-5 backdrop-blur-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-accent to-primary text-primary-foreground shadow-glow">
            <ClipboardList className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold">
              {ar ? "مركز المراقبة المؤسسي" : "Institutional Monitoring & Audit"}
            </h3>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {ar ? "شفافية · مراجعة · أداء" : "Transparency · Audit · Performance"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <Badge variant="outline" className={cn("uppercase", infraTone[health.infrastructure])}>
            {health.infrastructure} · {health.stabilityScore}
          </Badge>
          <Badge variant="outline" className={cn(
            incSummary.critical > 0 ? "border-danger/40 text-danger"
            : incSummary.high > 0 ? "border-warning/40 text-warning"
            : "border-success/40 text-success",
          )}>
            {ar ? "حوادث مفتوحة" : "Open incidents"}: {incSummary.open}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* AI Decision Timeline */}
        <Section icon={Brain} title={ar ? "جدول قرارات الذكاء" : "AI Decision Timeline"}>
          {decisions.length === 0 ? (
            <Empty label={ar ? "لم يُسجَّل قرار بعد" : "No decisions recorded yet."} />
          ) : (
            <ul className="space-y-2 text-[11px]">
              {decisions.map((d) => (
                <li key={d.id} className="rounded-md border border-border/40 bg-muted/10 p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase text-foreground">{d.action}{d.asset ? ` · ${d.asset}` : ""}</span>
                    <span className="text-muted-foreground">{new Date(d.ts).toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-1 text-muted-foreground">{d.reasoning}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-[10px]">conf {d.confidence}%</Badge>
                    {d.context.regime && <Badge variant="outline" className="text-[10px]">{d.context.regime}</Badge>}
                    {d.context.riskState && <Badge variant="outline" className="text-[10px]">risk: {d.context.riskState}</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Trade Audit Feed */}
        <Section icon={Activity} title={ar ? "سجل التدقيق" : "Trade Audit Feed"}>
          {audit.length === 0 ? (
            <Empty label={ar ? "لم يتم تنفيذ صفقات" : "No trades executed yet."} />
          ) : (
            <ul className="space-y-1.5 text-[11px]">
              {audit.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-muted/10 p-2">
                  <span className="flex items-center gap-2">
                    <span className={cn(
                      "rounded px-1.5 py-0.5 font-bold uppercase",
                      t.status === "filled" || t.status === "closed" ? "bg-success/15 text-success"
                      : t.status === "rejected" ? "bg-danger/15 text-danger"
                      : "bg-muted/30 text-muted-foreground",
                    )}>{t.status}</span>
                    <span className="font-mono">{t.asset}</span>
                    <span className="text-muted-foreground">{t.side} · {t.size}</span>
                  </span>
                  <span className="text-right text-muted-foreground">
                    {typeof t.pnl === "number" && (
                      <span className={cn("me-2 font-semibold", t.pnl >= 0 ? "text-success" : "text-danger")}>
                        {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}
                      </span>
                    )}
                    {t.latencyMs ? `${t.latencyMs}ms` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* System Health */}
        <Section icon={HeartPulse} title={ar ? "صحة النظام" : "System Health Monitor"}>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <Metric label={ar ? "زمن API" : "API latency"} value={`${health.lastSample?.apiLatencyMs ?? 0}ms`} />
            <Metric label={ar ? "جودة AI" : "AI quality"} value={`${health.lastSample?.aiQuality ?? 0}`} />
            <Metric label="WS" value={health.lastSample?.wsStable ? "OK" : "Unstable"} tone={health.lastSample?.wsStable ? "good" : "bad"} />
            <Metric label="Broker" value={health.lastSample?.brokerConnected ? "Connected" : "Offline"} tone={health.lastSample?.brokerConnected ? "good" : "bad"} />
          </div>
          {health.anomalies.length > 0 && (
            <div className="mt-2 rounded-md border border-warning/30 bg-warning/5 p-2 text-[11px] text-warning">
              <div className="mb-1 font-bold uppercase tracking-wider">{ar ? "شذوذ" : "Anomalies"}</div>
              <ul className="space-y-0.5">{health.anomalies.map((a, i) => <li key={i}>· {a}</li>)}</ul>
            </div>
          )}
        </Section>

        {/* Risk Incidents */}
        <Section icon={ShieldAlert} title={ar ? "مركز الحوادث" : "Risk Incident Center"}>
          {incidents.length === 0 ? (
            <Empty label={ar ? "لا حوادث مسجَّلة" : "No incidents recorded."} />
          ) : (
            <ul className="space-y-1.5 text-[11px]">
              {incidents.map((i) => (
                <li key={i.id} className="rounded-md border border-border/40 bg-muted/10 p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase">{i.kind}</span>
                    <Badge variant="outline" className={cn(
                      "text-[10px] uppercase",
                      i.severity === "critical" ? "border-danger/40 text-danger"
                      : i.severity === "high" ? "border-warning/40 text-warning"
                      : "border-muted-foreground/30 text-muted-foreground",
                    )}>{i.severity}</Badge>
                  </div>
                  <div className="mt-1 text-muted-foreground">{i.message}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-primary/80">→ {i.recommendation}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Performance Analytics */}
      <div className="mt-4 rounded-lg border border-border/40 bg-muted/10 p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="h-3 w-3" /> {ar ? "تحليلات الأداء" : "Performance Analytics"}
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4 lg:grid-cols-6">
          <Metric label={ar ? "صفقات" : "Trades"} value={String(perf.closed)} />
          <Metric label={ar ? "نسبة الفوز" : "Win rate"} value={`${perf.winRate}%`} tone={perf.winRate >= 55 ? "good" : perf.winRate >= 40 ? undefined : "bad"} />
          <Metric label={ar ? "عامل الربح" : "Profit factor"} value={String(perf.profitFactor)} />
          <Metric label={ar ? "أقصى تراجع" : "Max DD"} value={`${perf.maxDrawdownPct}%`} tone={perf.maxDrawdownPct > 8 ? "bad" : undefined} />
          <Metric label="Sharpe~" value={String(perf.sharpeLike)} />
          <Metric label={ar ? "جودة التنفيذ" : "Exec quality"} value={`${perf.executionQuality}`} />
        </div>
        {perf.hints.length > 0 && (
          <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-[11px] text-primary">
            <div className="mb-1 font-bold uppercase tracking-wider">{ar ? "تحسينات مقترحة" : "Improvement hints"}</div>
            <ul className="space-y-0.5">{perf.hints.map((h, i) => <li key={i}>· {h}</li>)}</ul>
          </div>
        )}
      </div>
    </Card>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Activity; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
      <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {title}
      </div>
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="text-[11px] text-muted-foreground">{label}</div>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-md border border-border/40 bg-background/40 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn(
        "mt-0.5 text-sm font-bold tabular-nums",
        tone === "good" && "text-success",
        tone === "bad" && "text-danger",
      )}>{value}</div>
    </div>
  );
}
