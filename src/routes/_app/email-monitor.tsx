import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getEmailMonitor } from "@/lib/observability/observability.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_app/email-monitor")({
  component: EmailMonitorPage,
});

function EmailMonitorPage() {
  const fn = useServerFn(getEmailMonitor);
  const q = useQuery({
    queryKey: ["email-monitor"],
    queryFn: () => fn({ data: undefined as never }),
    refetchInterval: 30_000,
  });
  const data = q.data as any;
  const stats = data?.stats ?? { sent24: 0, failed24: 0, pending24: 0 };
  const rows = (data?.recent ?? []) as any[];

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Email Monitor</h1>
          <p className="text-sm text-muted-foreground">Delivery health, failures, retries.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => q.refetch()} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Sent 24h" value={stats.sent24} />
        <Stat label="Failed 24h" value={stats.failed24} tone={stats.failed24 > 0 ? "bad" : "ok"} />
        <Stat label="Pending 24h" value={stats.pending24} tone={stats.pending24 > 5 ? "warn" : "ok"} />
      </div>

      <Card className="p-0">
        <div className="border-b p-4 text-sm font-semibold flex items-center gap-2">
          <Mail className="h-4 w-4" /> Recent 100 sends
        </div>
        {q.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No emails yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-3">
                <Badge variant={r.status === "sent" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>
                  {r.status}
                </Badge>
                <span className="font-medium">{r.recipient}</span>
                <span className="text-xs text-muted-foreground">{r.category} · {r.template}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  attempts {r.attempts} · {new Date(r.created_at).toLocaleString()}
                </span>
                {r.error_message && (
                  <p className="basis-full pl-1 text-xs text-destructive">{r.error_message}</p>
                )}
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
