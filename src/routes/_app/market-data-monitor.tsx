import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { finnhubHealth } from "@/lib/finnhub.functions";
import { logProviderHealth, getProviderHealthTimeline } from "@/lib/provider-health.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Activity, Gauge, RefreshCw, Signal, Wifi, WifiOff, BellRing, History } from "lucide-react";

export const Route = createFileRoute("/_app/market-data-monitor")({
  component: () => <ErrorBoundary fallbackTitle="\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0641\u062d\u0629"><MarketDataMonitorPage /></ErrorBoundary>,
  head: () => ({
    meta: [
      { title: "Market Data Monitor — ForeSmart" },
      { name: "description", content: "Provider health, latency, rate-limit, and stale-feed diagnostics for live market data feeds." },
    ],
  }),
});

type Health = Awaited<ReturnType<typeof finnhubHealth>>;
type TimelineRow = {
  id: string; provider: string; status: string; stale_state: string | null;
  avg_latency_ms: number | null; error_rate: number | null; rate_limited: number;
  last_success_age_s: number | null; recorded_at: string;
};

const SETTINGS_KEY = "foresmart.providerAlerts.v1";
type AlertSettings = { enabled: boolean; staleSeconds: number; browserPush: boolean };
const DEFAULTS: AlertSettings = { enabled: true, staleSeconds: 120, browserPush: false };

function loadSettings(): AlertSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<AlertSettings>;
    return { ...DEFAULTS, ...p };
  } catch { return DEFAULTS; }
}

function MarketDataMonitorPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const callHealth = useServerFn(finnhubHealth);
  const callLog = useServerFn(logProviderHealth);
  const callTimeline = useServerFn(getProviderHealthTimeline);

  const [data, setData] = useState<Health | null>(null);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [settings, setSettings] = useState<AlertSettings>(DEFAULTS);
  const [hours, setHours] = useState<number>(24);
  const lastAlertAt = useRef<number>(0);

  useEffect(() => { setSettings(loadSettings()); }, []);
  const persist = (s: AlertSettings) => {
    setSettings(s);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  };

  const computeStale = (h: Health): { worstStale: "fresh" | "stale" | "down"; oldestOkAgeS: number | null } => {
    if (!h.configured || !h.endpoints?.length) return { worstStale: "fresh", oldestOkAgeS: null };
    let worst: "fresh" | "stale" | "down" = "fresh";
    let oldest: number | null = null;
    for (const e of h.endpoints) {
      if (e.stale === "down") worst = "down";
      else if (e.stale === "stale" && worst !== "down") worst = "stale";
      if (e.lastOkAt) {
        const age = Math.round((Date.now() - e.lastOkAt) / 1000);
        if (oldest == null || age > oldest) oldest = age;
      }
    }
    return { worstStale: worst, oldestOkAgeS: oldest };
  };

  const fireAlert = (msg: string) => {
    const now = Date.now();
    if (now - lastAlertAt.current < 60_000) return; // 1 alert / minute max
    lastAlertAt.current = now;
    toast.warning(ar ? "تنبيه تغذية السوق" : "Market feed alert", { description: msg });
    if (settings.browserPush && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try { new Notification(ar ? "تنبيه تغذية السوق" : "Market feed alert", { body: msg }); } catch { /* ignore */ }
    }
  };

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const h = await callHealth();
      setData(h);
      const { worstStale, oldestOkAgeS } = computeStale(h);

      // Archive sample (best-effort)
      if (h.configured) {
        try {
          await callLog({
            data: {
              provider: "finnhub",
              status: (h.status as "healthy" | "degraded" | "down" | "unknown") ?? "unknown",
              staleState: worstStale,
              avgLatencyMs: typeof h.avgLatencyMs === "number" ? h.avgLatencyMs : null,
              errorRate: typeof h.errorRate === "number" ? h.errorRate : null,
              rateLimited: Number(h.rateLimited ?? 0),
              lastSuccessAgeS: oldestOkAgeS,
            },
          });
        } catch { /* swallow */ }
      }

      // Alert evaluation
      if (settings.enabled && h.configured) {
        if (worstStale === "down") {
          fireAlert(ar ? "تغذية بيانات Finnhub متوقفة." : "Finnhub data feed appears to be down.");
        } else if (worstStale === "stale" && oldestOkAgeS != null && oldestOkAgeS >= settings.staleSeconds) {
          fireAlert(
            ar
              ? `تغذية بيانات قديمة منذ ${oldestOkAgeS} ثانية (الحد ${settings.staleSeconds}s).`
              : `Data feed stale for ${oldestOkAgeS}s (threshold ${settings.staleSeconds}s).`,
          );
        }
      }
    } catch (e) { setErr(e instanceof Error ? e.message : "failed"); }
    finally { setLoading(false); }
  };

  const loadTimeline = async () => {
    try {
      const r = await callTimeline({ data: { hours, provider: "finnhub" } });
      if (r.ok) setTimeline(r.rows as TimelineRow[]);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.enabled, settings.staleSeconds]);

  useEffect(() => { loadTimeline(); const t = setInterval(loadTimeline, 30_000); return () => clearInterval(t); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours]);

  const requestPush = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error(ar ? "المتصفح لا يدعم الإشعارات" : "Browser does not support notifications");
      return;
    }
    const res = await Notification.requestPermission();
    persist({ ...settings, browserPush: res === "granted" });
    if (res === "granted") toast.success(ar ? "تم تفعيل إشعارات المتصفح" : "Browser notifications enabled");
  };

  const statusLabel = (s?: string) =>
    ar
      ? s === "healthy" ? "صحي" : s === "degraded" ? "متدهور" : s === "down" ? "متوقف" : "غير معروف"
      : s ?? "unknown";
  const staleLabel = (s?: string | null) =>
    ar
      ? s === "fresh" ? "حديث" : s === "stale" ? "قديم" : s === "down" ? "متوقف" : "—"
      : s ?? "—";

  const summary = useMemo(() => {
    if (!timeline.length) return null;
    const stale = timeline.filter((r) => r.stale_state === "stale").length;
    const down = timeline.filter((r) => r.stale_state === "down").length;
    const rl = timeline.reduce((a, r) => a + (r.rate_limited || 0), 0);
    const avgLat = (() => {
      const v = timeline.map((r) => r.avg_latency_ms).filter((x): x is number => typeof x === "number");
      return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
    })();
    return { stale, down, rl, avgLat, total: timeline.length };
  }, [timeline]);

  return (
    <div className="container mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-2 flex-wrap">
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

      {/* Alert settings */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" />
            {ar ? "إعدادات تنبيهات التغذية" : "Feed alert settings"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 items-end">
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <Label className="text-sm">{ar ? "تفعيل التنبيهات" : "Enable alerts"}</Label>
              <p className="text-xs text-muted-foreground">
                {ar ? "إشعار عند تأخر/توقف التغذية." : "Notify on stale or down feed."}
              </p>
            </div>
            <Switch checked={settings.enabled} onCheckedChange={(v) => persist({ ...settings, enabled: v })} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="threshold" className="text-sm">
              {ar ? "حد التأخر (ثانية)" : "Stale threshold (seconds)"}
            </Label>
            <Input
              id="threshold"
              type="number"
              min={30}
              max={3600}
              step={10}
              value={settings.staleSeconds}
              onChange={(e) => {
                const n = Math.max(30, Math.min(3600, Number(e.target.value) || 120));
                persist({ ...settings, staleSeconds: n });
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <Label className="text-sm">{ar ? "إشعارات المتصفح" : "Browser push"}</Label>
              <p className="text-xs text-muted-foreground">
                {ar ? "تنبيه نظام عندما تكون الصفحة في الخلفية." : "OS-level notification when tab is in background."}
              </p>
            </div>
            {settings.browserPush ? (
              <Switch checked onCheckedChange={(v) => persist({ ...settings, browserPush: v })} />
            ) : (
              <Button size="sm" variant="outline" onClick={requestPush}>{ar ? "تفعيل" : "Enable"}</Button>
            )}
          </div>
        </CardContent>
      </Card>

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
              {ar ? "FINNHUB_API_KEY غير مهيأ في بيئة الإنتاج." : "FINNHUB_API_KEY غير مهيأ في بيئة الإنتاج."}
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
                  ? "المفتاح مخزّن في خزنة الأسرار ولا يُرسل أبداً إلى المتصفح."
                  : "API key lives in the secrets vault and is never sent to the browser."}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Archived timeline */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            {ar ? "أرشيف صحة المزوّد" : "Provider health archive"}
          </CardTitle>
          <div className="flex items-center gap-2">
            {[6, 24, 72, 168].map((h) => (
              <Button key={h} size="sm" variant={hours === h ? "default" : "outline"} onClick={() => setHours(h)}>
                {h}h
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {summary ? (
            <div className="grid gap-2 grid-cols-2 md:grid-cols-4 text-sm">
              <SummaryCell label={ar ? "عينات" : "Samples"} value={String(summary.total)} />
              <SummaryCell label={ar ? "متوسط الكمون" : "Avg latency"} value={summary.avgLat != null ? `${summary.avgLat} ms` : "—"} />
              <SummaryCell label={ar ? "حالات تأخر" : "Stale events"} value={String(summary.stale)} tone={summary.stale > 0 ? "warn" : undefined} />
              <SummaryCell label={ar ? "حالات توقف" : "Down events"} value={String(summary.down)} tone={summary.down > 0 ? "bad" : undefined} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{ar ? "لا توجد بيانات أرشيفية بعد." : "No archive samples yet."}</p>
          )}

          <div className="rounded-md border max-h-[420px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground sticky top-0">
                <tr>
                  <th className="text-start p-2">{ar ? "الوقت" : "Time"}</th>
                  <th className="text-start p-2">{ar ? "الحالة" : "Status"}</th>
                  <th className="text-start p-2">{ar ? "التغذية" : "Feed"}</th>
                  <th className="text-end p-2">{ar ? "كمون" : "Latency"}</th>
                  <th className="text-end p-2">{ar ? "أخطاء" : "Errors"}</th>
                  <th className="text-end p-2">429</th>
                  <th className="text-end p-2">{ar ? "عمر آخر نجاح" : "Last OK age"}</th>
                </tr>
              </thead>
              <tbody>
                {timeline.length === 0 ? (
                  <tr><td colSpan={7} className="p-3 text-center text-muted-foreground">{ar ? "—" : "—"}</td></tr>
                ) : timeline.map((r) => {
                  const t = new Date(r.recorded_at);
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="p-2 text-xs">{t.toLocaleString()}</td>
                      <td className="p-2">
                        <Badge variant={r.status === "healthy" ? "default" : r.status === "degraded" ? "outline" : "destructive"}>
                          {statusLabel(r.status)}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Badge variant={r.stale_state === "fresh" ? "default" : r.stale_state === "down" ? "destructive" : "outline"}>
                          {staleLabel(r.stale_state)}
                        </Badge>
                      </td>
                      <td className="p-2 text-end tabular-nums">{r.avg_latency_ms != null ? `${r.avg_latency_ms} ms` : "—"}</td>
                      <td className="p-2 text-end tabular-nums">{r.error_rate != null ? `${(r.error_rate * 100).toFixed(1)}%` : "—"}</td>
                      <td className="p-2 text-end tabular-nums">{r.rate_limited}</td>
                      <td className="p-2 text-end tabular-nums text-xs text-muted-foreground">
                        {r.last_success_age_s != null ? `${r.last_success_age_s}s` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

function SummaryCell({ label, value, tone }: { label: string; value: string; tone?: "warn" | "bad" }) {
  const cls = tone === "warn" ? "text-amber-500" : tone === "bad" ? "text-destructive" : "";
  return (
    <div className="rounded-md border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-base font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
