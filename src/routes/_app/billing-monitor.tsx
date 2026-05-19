import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getBillingMonitor } from "@/lib/observability/observability.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_app/billing-monitor")({
  component: BillingMonitorPage,
});

function BillingMonitorPage() {
  const fn = useServerFn(getBillingMonitor);
  const q = useQuery({
    queryKey: ["billing-monitor"],
    queryFn: () => fn({ data: undefined as never }),
    refetchInterval: 30_000,
  });
  const d = q.data as any;
  const stats = d?.stats ?? { active_subs: 0, webhook_failures_24h: 0, payment_failures_24h: 0 };
  const events = (d?.recent_webhook_events ?? []) as any[];

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Billing Monitor</h1>
          <p className="text-sm text-muted-foreground">Subscriptions, webhook deliveries, payment failures.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => q.refetch()} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Active subscriptions" value={stats.active_subs} />
        <Stat label="Webhook failures 24h" value={stats.webhook_failures_24h} tone={stats.webhook_failures_24h > 0 ? "warn" : "ok"} />
        <Stat label="Payment failures 24h" value={stats.payment_failures_24h} tone={stats.payment_failures_24h > 0 ? "bad" : "ok"} />
      </div>

      <Card className="p-0">
        <div className="flex items-center gap-2 border-b p-4 text-sm font-semibold">
          <CreditCard className="h-4 w-4" /> Recent billing events
        </div>
        {q.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : events.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No recent billing events.</p>
        ) : (
          <ul className="divide-y text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 p-3">
                <Badge variant={e.severity === "error" || e.severity === "critical" ? "destructive" : "secondary"}>
                  {e.severity}
                </Badge>
                <Badge variant="outline">{e.source}</Badge>
                <span className="font-medium">{e.event_type}</span>
                {e.message && <span className="text-xs text-muted-foreground">— {e.message}</span>}
                <span className="ml-auto text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "bad" ? "text-destructive" : tone === "warn" ? "text-amber-500" : "text-foreground";
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-2 text-3xl font-bold ${color}`}>{value}</div>
    </Card>
  );
}
