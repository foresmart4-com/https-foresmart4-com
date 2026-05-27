import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSystemHealth, getActiveAlerts, acknowledgeAlert, evaluateAlerts } from "@/lib/observability/observability.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, AlertOctagon, CheckCircle2, RefreshCw, Zap } from "lucide-react";

export const Route = createFileRoute("/_app/system-health")({
  component: () => <ErrorBoundary fallbackTitle="تعذر تحميل الصفحة"><SystemHealthPage /></ErrorBoundary>,
});

function SystemHealthPage() {
  const healthFn = useServerFn(getSystemHealth);
  const alertsFn = useServerFn(getActiveAlerts);
  const ackFn = useServerFn(acknowledgeAlert);
  const evalFn = useServerFn(evaluateAlerts);

  const health = useQuery({
    queryKey: ["system-health"],
    queryFn: () => healthFn({ data: undefined as never }),
    refetchInterval: 30_000,
  });
  const alerts = useQuery({
    queryKey: ["active-alerts"],
    queryFn: () => alertsFn({ data: undefined as never }),
    refetchInterval: 30_000,
  });

  const snap = (health.data as { snapshot: any; vault?: { configured: boolean; message: string } } | undefined)?.snapshot;
  const vault = (health.data as { snapshot: any; vault?: { configured: boolean; message: string } } | undefined)?.vault;

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">System Health</h1>
          <p className="text-sm text-muted-foreground">Live observability across services, emails, billing, AI, and auth.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { health.refetch(); alerts.refetch(); }} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${health.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={async () => { await evalFn({ data: undefined as never }); alerts.refetch(); }} className="gap-2">
            <Zap className="h-4 w-4" /> Evaluate alerts
          </Button>
        </div>
      </header>

      {vault && (
        <Card className={`flex items-start gap-3 p-4 ${vault.configured ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}>
          {vault.configured
            ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />
            : <AlertOctagon className="h-5 w-5 shrink-0 text-destructive mt-0.5" />}
          <div>
            <div className="text-sm font-semibold">{vault.configured ? "Vault key configured" : "Vault key missing"}</div>
            {!vault.configured && <div className="mt-1 text-xs text-muted-foreground">{vault.message}</div>}
          </div>
        </Card>
      )}

      {!snap ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Loading snapshot…</Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Stat label="Events 24h" value={snap.events_24h.total} />
            <Stat label="Errors 24h" value={snap.events_24h.errors} tone={Number(snap.events_24h.errors) > 0 ? "warn" : "ok"} />
            <Stat label="Critical 24h" value={snap.events_24h.critical} tone={Number(snap.events_24h.critical) > 0 ? "bad" : "ok"} />
            <Stat label="Open alerts" value={snap.open_alerts} tone={Number(snap.open_alerts) > 0 ? "warn" : "ok"} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Section title="Events by source (24h)" data={snap.by_source_24h} />
            <Section title="Email (24h)" data={snap.email_24h} />
            <Section title="Auth (24h)" data={snap.auth_24h} />
          </div>
        </>
      )}

      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <AlertOctagon className="h-4 w-4" /> Active alerts (last 7 days)
        </div>
        {alerts.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !alerts.data || (alerts.data as any).alerts.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-emerald-500"><CheckCircle2 className="h-4 w-4" /> No active alerts.</p>
        ) : (
          <ul className="space-y-2">
            {((alerts.data as any).alerts as any[]).map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.severity === "critical" ? "destructive" : a.severity === "error" ? "destructive" : "secondary"}>
                      {a.severity}
                    </Badge>
                    <span className="font-medium">{a.title}</span>
                    {a.acknowledged_at && <Badge variant="outline" className="text-xs">acked</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {a.rule_key} · {new Date(a.created_at).toLocaleString()}
                  </div>
                </div>
                {!a.acknowledged_at && (
                  <Button size="sm" variant="ghost" onClick={async () => { await ackFn({ data: { id: a.id } }); alerts.refetch(); }}>
                    Acknowledge
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "bad" ? "text-destructive" : tone === "warn" ? "text-amber-500" : "text-foreground";
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-2 text-3xl font-bold ${color}`}>{value}</div>
    </Card>
  );
}

function Section({ title, data }: { title: string; data: Record<string, number | string> }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Activity className="h-4 w-4" /> {title}
      </div>
      <ul className="space-y-1.5 text-sm">
        {Object.entries(data ?? {}).map(([k, v]) => (
          <li key={k} className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{k}</span>
            <Badge variant="secondary">{String(v)}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}
