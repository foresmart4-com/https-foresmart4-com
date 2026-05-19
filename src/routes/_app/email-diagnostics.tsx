import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  getEmailHealthFn,
  getRecentEmailsFn,
  retryEmailFn,
  sendTestEmailFn,
  checkAdminFn,
} from "@/lib/email/email.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, Mail, RefreshCw, ShieldAlert, Send, Server } from "lucide-react";

export const Route = createFileRoute("/_app/email-diagnostics")({
  component: EmailDiagnosticsPage,
});

function statusColor(s: string) {
  if (s === "sent") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (s === "failed") return "bg-red-500/15 text-red-400 border-red-500/30";
  if (s === "rate_limited") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (s === "pending") return "bg-blue-500/15 text-blue-400 border-blue-500/30";
  return "bg-muted text-muted-foreground";
}

function EmailDiagnosticsPage() {
  const { toast } = useToast();
  const checkAdmin = useServerFn(checkAdminFn);
  const health = useServerFn(getEmailHealthFn);
  const recent = useServerFn(getRecentEmailsFn);
  const retry = useServerFn(retryEmailFn);
  const sendTest = useServerFn(sendTestEmailFn);

  const [filter, setFilter] = useState<"all" | "sent" | "failed" | "pending" | "rate_limited">("all");

  const admin = useQuery({ queryKey: ["email-admin"], queryFn: () => checkAdmin() });
  const healthQ = useQuery({
    queryKey: ["email-health"],
    queryFn: () => health({ data: { windowHours: 24 } }),
    enabled: !!admin.data?.isAdmin,
    refetchInterval: 30_000,
  });
  const logQ = useQuery({
    queryKey: ["email-recent", filter],
    queryFn: () => recent({ data: { limit: 100, status: filter === "all" ? undefined : filter } }),
    enabled: !!admin.data?.isAdmin,
    refetchInterval: 30_000,
  });

  const summary = healthQ.data;

  const statusBadge = useMemo(() => {
    if (!summary) return null;
    const map: Record<string, { label: string; cls: string; icon: any }> = {
      ok: { label: "Healthy", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
      degraded: { label: "Degraded", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: AlertTriangle },
      down: { label: "Down", cls: "bg-red-500/15 text-red-400 border-red-500/30", icon: ShieldAlert },
      unconfigured: { label: "Unconfigured", cls: "bg-muted text-muted-foreground", icon: ShieldAlert },
    };
    const m = map[summary.status] ?? map.ok;
    const Icon = m.icon;
    return <Badge variant="outline" className={m.cls}><Icon className="h-3 w-3 mr-1" />{m.label}</Badge>;
  }, [summary]);

  if (admin.isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!admin.data?.isAdmin) return <div className="p-6 text-red-400">Admins only.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Mail className="h-6 w-6" /> Email Diagnostics</h1>
          <p className="text-sm text-muted-foreground">Provider status, delivery logs, retries, and DNS hardening.</p>
        </div>
        <div className="flex gap-2 items-center">
          {statusBadge}
          <Button size="sm" variant="outline" onClick={() => { healthQ.refetch(); logQ.refetch(); }}>
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              try {
                const r: any = await sendTest({ data: { lang: "en" } });
                toast({ title: r?.success ? "Test sent" : "Test failed", description: r?.error ?? r?.messageId });
                logQ.refetch();
              } catch (e: any) { toast({ title: "Error", description: e?.message }); }
            }}
          >
            <Send className="h-3 w-3 mr-1" /> Send Test
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Provider" value={summary?.configured ? "Resend" : "Not configured"} />
        <StatCard label="Sent (24h)" value={summary?.totals.sent ?? "—"} accent="text-emerald-400" />
        <StatCard label="Failed (24h)" value={summary?.totals.failed ?? "—"} accent="text-red-400" />
        <StatCard label="Rate-limited" value={summary?.totals.rateLimited ?? "—"} accent="text-amber-400" />
        <StatCard label="Success rate" value={summary ? `${Math.round(summary.successRate * 100)}%` : "—"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4" /> Last activity</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div><span className="text-muted-foreground">Sender: </span><span className="font-mono">{summary?.sender}</span></div>
          <div><span className="text-muted-foreground">Last sent: </span>
            {summary?.lastSent
              ? <span>{summary.lastSent.subject} → <span className="font-mono">{summary.lastSent.recipient}</span> · {new Date(summary.lastSent.sentAt).toLocaleString()}</span>
              : <span className="text-muted-foreground">none</span>}
          </div>
          <div><span className="text-muted-foreground">Last error: </span>
            <span className="text-red-400">{summary?.lastError ?? "none"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SPF / DKIM / DMARC</CardTitle>
        </CardHeader>
        <CardContent className="text-xs font-mono space-y-1 text-muted-foreground">
          <div><span className="text-foreground">SPF: </span>{summary?.dnsHints.spf}</div>
          <div><span className="text-foreground">DKIM: </span>{summary?.dnsHints.dkim}</div>
          <div><span className="text-foreground">DMARC: </span>{summary?.dnsHints.dmarc}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Delivery Log</CardTitle>
          <div className="flex gap-1 flex-wrap">
            {(["all", "sent", "failed", "rate_limited", "pending"] as const).map((s) => (
              <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
                {s}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left p-2">Time</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Template</th>
                  <th className="text-left p-2">Recipient</th>
                  <th className="text-left p-2">Subject</th>
                  <th className="text-left p-2">Attempts</th>
                  <th className="text-left p-2">Provider</th>
                  <th className="text-left p-2"></th>
                </tr>
              </thead>
              <tbody>
                {(logQ.data ?? []).map((r: any) => (
                  <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="p-2"><Badge variant="outline" className={statusColor(r.status)}>{r.status}</Badge></td>
                    <td className="p-2 font-mono">{r.template}</td>
                    <td className="p-2 font-mono">{r.recipient}</td>
                    <td className="p-2 max-w-[240px] truncate" title={r.subject}>{r.subject}</td>
                    <td className="p-2">{r.attempts}</td>
                    <td className="p-2 font-mono max-w-[200px] truncate" title={r.provider_message_id ?? r.error_message ?? ""}>
                      {r.provider_message_id ?? r.error_message ?? "—"}
                    </td>
                    <td className="p-2">
                      {r.status === "failed" && (
                        <Button size="sm" variant="outline" onClick={async () => {
                          try {
                            const res: any = await retry({ data: { logId: r.id } });
                            toast({ title: res?.success ? "Retried" : "Retry failed", description: res?.error ?? res?.messageId });
                            logQ.refetch();
                          } catch (e: any) { toast({ title: "Error", description: e?.message }); }
                        }}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Retry
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {(logQ.data ?? []).length === 0 && (
                  <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No emails logged yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: any; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-xl font-bold mt-1 ${accent ?? ""}`}>{String(value)}</div>
      </CardContent>
    </Card>
  );
}
