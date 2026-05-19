import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { finnhubHealth } from "@/lib/finnhub.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { Activity, Gauge, RefreshCw, Signal, Wifi, WifiOff } from "lucide-react";

export const Route = createFileRoute("/_app/market-data-monitor")({
  component: MarketDataMonitorPage,
  head: () => ({
    meta: [
      { title: "Market Data Monitor — ForeSmart" },
      { name: "description", content: "Provider health, latency, rate-limit, and stale-feed diagnostics for live market data feeds." },
    ],
  }),
});

type Health = Awaited<ReturnType<typeof finnhubHealth>>;

function MarketDataMonitorPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const callHealth = useServerFn(finnhubHealth);
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try { setData(await callHealth()); }
    catch (e) { setErr(e instanceof Error ? e.message : "failed"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, []);

  const statusLabel = (s?: string) =>
    ar
      ? s === "healthy" ? "صحي" : s === "degraded" ? "متدهور" : s === "down" ? "متوقف" : "غير معروف"
      : s ?? "unknown";

  const staleLabel = (s?: string) =>
    ar
      ? s === "fresh" ? "حديث" : s === "stale" ? "قديم" : s === "down" ? "متوقف" : "—"
      : s ?? "—";

  return (
    <div className="container mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            {ar ? "مراقبة مزوّدي بيانات السوق" : "Market Data Monitor"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ar
              ? "صحة المزوّد، زمن الاستجابة، حدود المعدّل، وكشف التغذية القديمة — تحديث تلقائي كل 15 ثانية."
              : "Provider health, latency, rate-limit & stale-feed detection — auto-refreshes every 15s."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""} ${ar ? "ml-2" : "mr-2"}`} />
          {ar ? "تحديث" : "Refresh"}
        </Button>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Signal className="h-4 w-4 text-primary" />
            Finnhub
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!data ? (
            <p className="text-sm text-muted-foreground">{ar ? "جارٍ التحميل…" : "Loading…"}</p>
          ) : !data.configured ? (
            <p className="text-sm text-destructive">
              {ar ? "FINNHUB_API_KEY غير مهيّأ." : "FINNHUB_API_KEY is not configured."}
            </p>
          ) : (
            <>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <Stat
                  icon={data.status === "healthy" ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                  label={ar ? "الحالة" : "Status"}
                  value={statusLabel(data.status)}
                  tone={data.status === "healthy" ? "ok" : data.status === "degraded" ? "warn" : "bad"}
                />
                <Stat icon={<Gauge className="h-4 w-4" />} label={ar ? "متوسط الكمون" : "Avg latency"} value={data.avgLatencyMs != null ? `${data.avgLatencyMs} ms` : "—"} />
                <Stat icon={<Activity className="h-4 w-4" />} label={ar ? "نسبة الأخطاء" : "Error rate"} value={`${(data.errorRate * 100).toFixed(1)}%`} />
                <Stat icon={<Activity className="h-4 w-4" />} label={ar ? "تجاوز الحد" : "Rate-limited"} value={String(data.rateLimited)} />
              </div>

              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-start p-2">{ar ? "النقطة" : "Endpoint"}</th>
                      <th className="text-start p-2">{ar ? "حالة التغذية" : "Feed"}</th>
                      <th className="text-end p-2">{ar ? "كمون" : "Latency"}</th>
                      <th className="text-end p-2">EWMA</th>
                      <th className="text-end p-2">OK</th>
                      <th className="text-end p-2">{ar ? "أخطاء" : "Errors"}</th>
                      <th className="text-end p-2">429</th>
                      <th className="text-end p-2">{ar ? "آخر نجاح" : "Last OK"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.endpoints.length === 0 ? (
                      <tr><td colSpan={8} className="p-3 text-center text-muted-foreground">{ar ? "لم يتم تنفيذ طلبات بعد." : "No requests yet."}</td></tr>
                    ) : data.endpoints.map((e) => (
                      <tr key={e.endpoint} className="border-t">
                        <td className="p-2 font-mono text-xs">{e.endpoint}</td>
                        <td className="p-2">
                          <Badge variant={e.stale === "fresh" ? "default" : e.stale === "down" ? "destructive" : "outline"}>
                            {staleLabel(e.stale)}
                          </Badge>
                        </td>
                        <td className="p-2 text-end tabular-nums">{e.lastLatencyMs != null ? `${e.lastLatencyMs} ms` : "—"}</td>
                        <td className="p-2 text-end tabular-nums">{e.ewmaLatencyMs != null ? `${e.ewmaLatencyMs} ms` : "—"}</td>
                        <td className="p-2 text-end tabular-nums">{e.okCount}</td>
                        <td className="p-2 text-end tabular-nums">{e.errCount}</td>
                        <td className="p-2 text-end tabular-nums">{e.rateLimitedCount}</td>
                        <td className="p-2 text-end text-xs text-muted-foreground">
                          {e.lastOkAt ? `${Math.round((Date.now() - e.lastOkAt) / 1000)}s` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                {ar
                  ? "المفتاح مخزّن في خزنة الأسرار ولا يُرسل أبداً إلى المتصفح. جميع الطلبات تتم من الخادم مع حماية معدل، إعادة محاولة، تراجع أُسّي، وكشف تغذية قديمة."
                  : "API key lives in the secrets vault and is never sent to the browser. All requests are server-side with rate-limit protection, retries, exponential backoff, and stale-feed detection."}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "ok" | "warn" | "bad" }) {
  const cls = tone === "ok" ? "text-emerald-500" : tone === "warn" ? "text-amber-500" : tone === "bad" ? "text-destructive" : "";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <p className={`mt-1 text-lg font-bold tabular-nums ${cls}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
