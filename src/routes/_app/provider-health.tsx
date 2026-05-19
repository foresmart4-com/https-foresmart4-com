import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { allProviderHealth } from "@/lib/providers.functions";
import { logProviderHealth, getAllProviderHealthTimeline } from "@/lib/provider-health.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { Activity, RefreshCw, Wifi, WifiOff, Zap, History } from "lucide-react";

export const Route = createFileRoute("/_app/provider-health")({
  component: ProviderHealthPage,
  head: () => ({
    meta: [
      { title: "Provider Health — ForeSmart" },
      { name: "description", content: "Per-provider status, latency, error rates, failover routing, and stale/down timeline." },
    ],
  }),
});

type Aggregate = {
  routing: { marketChosen: string; macroChosen: string };
  failoverEvents: Array<{ ts: number; kind: string; primary: string; chosen: string; reason: string }>;
} & Record<string, unknown>;
type ProviderRow = {
  id: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  configured: boolean;
  errorRate: number;
  avgLatencyMs: number | null;
  rateLimited: number;
  role: string;
  failoverScore?: number;
};

const KNOWN = ["finnhub", "twelvedata", "alphavantage", "newsapi"] as const;

function statusColor(s: string) {
  if (s === "healthy") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
  if (s === "degraded") return "bg-amber-500/10 text-amber-600 border-amber-500/30";
  if (s === "down") return "bg-rose-500/10 text-rose-600 border-rose-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function ProviderHealthPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const callHealth = useServerFn(allProviderHealth);
  const callLog = useServerFn(logProviderHealth);
  const callTimeline = useServerFn(getAllProviderHealthTimeline);

  const [agg, setAgg] = useState<Aggregate | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<Array<{ id: string; provider: string; status: string; stale_state: string | null; avg_latency_ms: number | null; error_rate: number | null; rate_limited: number; recorded_at: string }>>([]);

  const rows: ProviderRow[] = useMemo(() => {
    if (!agg) return [];
    const out: ProviderRow[] = [];
    for (const id of KNOWN) {
      const p = (agg as Record<string, unknown>)[id] as undefined | {
        status: ProviderRow["status"]; configured: boolean; errorRate: number;
        avgLatencyMs: number | null; rateLimited: number; role?: string; failoverScore?: number;
      };
      if (!p) continue;
      out.push({
        id, status: p.status, configured: p.configured, errorRate: p.errorRate,
        avgLatencyMs: p.avgLatencyMs, rateLimited: p.rateLimited,
        role: p.role ?? id, failoverScore: p.failoverScore,
      });
    }
    return out;
  }, [agg]);

  const refresh = async () => {
    setLoading(true); setErr(null);
    try {
      const data = (await callHealth()) as unknown as Aggregate;
      setAgg(data);
      // Archive a sample per provider for the per-user timeline.
      await Promise.allSettled(rowsFromAgg(data).map((r) => callLog({ data: {
        provider: r.id,
        status: r.status,
        staleState: r.status === "down" ? "down" : r.status === "degraded" ? "stale" : "fresh",
        avgLatencyMs: r.avgLatencyMs,
        errorRate: r.errorRate,
        rateLimited: r.rateLimited,
        lastSuccessAgeS: null,
      } })));
      const tl = await callTimeline({ data: { hours: 24, providers: [...KNOWN] } });
      if (tl.ok) setTimeline(tl.rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => {
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  return (
    <div className="space-y-4 p-4" dir={ar ? "rtl" : "ltr"}>
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Activity className="size-6" /> {ar ? "صحة المزودين" : "Provider Health"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ar
              ? "حالة كل مزود بيانات مع التوجيه التلقائي وسجل التدهور لكل مستخدم."
              : "Per-provider status with automatic failover routing and per-user stale/down timeline."}
          </p>
        </div>
        <Button onClick={refresh} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          <span className="ms-2">{ar ? "تحديث" : "Refresh"}</span>
        </Button>
      </header>

      {err && <Card><CardContent className="p-4 text-sm text-rose-600">{err}</CardContent></Card>}

      {agg && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="size-4" /> {ar ? "التوجيه الحالي" : "Active routing"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm grid sm:grid-cols-2 gap-2">
            <div>{ar ? "أسعار السوق" : "Market quotes"}: <Badge variant="secondary">{agg.routing.marketChosen}</Badge></div>
            <div>{ar ? "بيانات الاقتصاد الكلي" : "Macro"}: <Badge variant="secondary">{agg.routing.macroChosen}</Badge></div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {rows.map((r) => (
          <Card key={r.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="capitalize">{r.id}</span>
                <Badge className={statusColor(r.status)} variant="outline">
                  {r.configured ? r.status : "unconfigured"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{ar ? "الدور" : "Role"}</span>
                <span>{r.role}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{ar ? "زمن الاستجابة" : "Latency"}</span>
                <span>{r.avgLatencyMs != null ? `${r.avgLatencyMs} ms` : "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{ar ? "نسبة الأخطاء" : "Error rate"}</span>
                <span>{(r.errorRate * 100).toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">429</span>
                <span>{r.rateLimited}</span>
              </div>
              {typeof r.failoverScore === "number" && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{ar ? "نقاط الاحتياط" : "Failover score"}</span>
                  <span>{r.failoverScore.toFixed(2)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {agg && agg.failoverEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <WifiOff className="size-4" /> {ar ? "أحداث التحويل الأخيرة" : "Recent failover events"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1.5">
            {agg.failoverEvents.slice(0, 10).map((e, i) => (
              <div key={i} className="flex items-center justify-between gap-2 border-b border-border/40 pb-1">
                <span className="text-muted-foreground">{new Date(e.ts).toLocaleTimeString(ar ? "ar" : "en")}</span>
                <span className="font-mono">{e.kind}</span>
                <span><Badge variant="outline">{e.chosen}</Badge></span>
                <span className="truncate text-muted-foreground">{e.reason}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="size-4" /> {ar ? "الجدول الزمني (24 ساعة)" : "Timeline (24h)"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs">
          {timeline.length === 0 ? (
            <p className="text-muted-foreground">{ar ? "لا توجد عينات بعد." : "No samples yet."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="text-left p-1.5">{ar ? "الوقت" : "Time"}</th>
                    <th className="text-left p-1.5">{ar ? "المزود" : "Provider"}</th>
                    <th className="text-left p-1.5">{ar ? "الحالة" : "Status"}</th>
                    <th className="text-left p-1.5">{ar ? "الكمون" : "Latency"}</th>
                    <th className="text-left p-1.5">{ar ? "الأخطاء" : "Errors"}</th>
                    <th className="text-left p-1.5">429</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.slice(0, 120).map((r) => (
                    <tr key={r.id} className="border-t border-border/40">
                      <td className="p-1.5 whitespace-nowrap">{new Date(r.recorded_at).toLocaleTimeString(ar ? "ar" : "en")}</td>
                      <td className="p-1.5 capitalize">{r.provider}</td>
                      <td className="p-1.5"><Badge className={statusColor(r.status)} variant="outline">{r.stale_state ?? r.status}</Badge></td>
                      <td className="p-1.5">{r.avg_latency_ms ?? "—"}</td>
                      <td className="p-1.5">{r.error_rate != null ? `${(r.error_rate * 100).toFixed(1)}%` : "—"}</td>
                      <td className="p-1.5">{r.rate_limited}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <Wifi className="size-3" /> {ar ? "يتم التحديث تلقائيًا كل 30 ثانية." : "Auto-refreshes every 30 seconds."}
      </p>
    </div>
  );
}

function rowsFromAgg(agg: Aggregate): ProviderRow[] {
  const out: ProviderRow[] = [];
  for (const id of KNOWN) {
    const p = (agg as Record<string, unknown>)[id] as undefined | {
      status: ProviderRow["status"]; configured: boolean; errorRate: number;
      avgLatencyMs: number | null; rateLimited: number; role?: string;
    };
    if (!p) continue;
    out.push({
      id, status: p.status, configured: p.configured, errorRate: p.errorRate,
      avgLatencyMs: p.avgLatencyMs, rateLimited: p.rateLimited, role: p.role ?? id,
    });
  }
  return out;
}
