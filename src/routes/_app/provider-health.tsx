import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAllProvidersStatus, type ProviderStatusRow, type ProviderCategory } from "@/lib/all-providers-status.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";
import { Activity, RefreshCw, CheckCircle2, KeyRound, AlertTriangle, Clock, Wrench, Wifi } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const Route = createFileRoute("/_app/provider-health")({
  component: () => (
    <ErrorBoundary><ProviderHealthPage /></ErrorBoundary>
  ),
  head: () => ({
    meta: [
      { title: "Provider Health — ForeSmart" },
      { name: "description", content: "Status of every external provider: market data, news, brokers, payments, KYC." },
    ],
  }),
});

const CATEGORY_LABELS: Record<ProviderCategory, { ar: string; en: string }> = {
  market_data: { ar: "بيانات الأسواق", en: "Market Data" },
  news: { ar: "الأخبار والجغرافيا السياسية", en: "News & Geopolitics" },
  macro: { ar: "البيانات الاقتصادية الكلية", en: "Macro" },
  broker: { ar: "الوسطاء", en: "Brokers" },
  payments: { ar: "الدفع والاشتراكات", en: "Payments" },
  kyc: { ar: "التحقق والبنوك", en: "KYC & Banking" },
};

const CATEGORY_ORDER: ProviderCategory[] = ["market_data", "macro", "news", "broker", "payments", "kyc"];

function stateBadge(row: ProviderStatusRow, ar: boolean) {
  const map: Record<ProviderStatusRow["connState"], { cls: string; ar: string; en: string; Icon: typeof CheckCircle2 }> = {
    connected:       { cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30", ar: "متصل",         en: "Connected",       Icon: CheckCircle2 },
    missing_key:     { cls: "bg-amber-500/10  text-amber-500  border-amber-500/30",     ar: "مفتاح مفقود",  en: "Missing Key",     Icon: KeyRound },
    error:           { cls: "bg-rose-500/10   text-rose-500   border-rose-500/30",      ar: "خطأ",          en: "Error",           Icon: AlertTriangle },
    rate_limited:    { cls: "bg-orange-500/10 text-orange-500 border-orange-500/30",    ar: "تجاوز الحد",   en: "Rate Limited",    Icon: Clock },
    not_implemented: { cls: "bg-muted text-muted-foreground border-border",              ar: "غير مُفعّل",   en: "Not Implemented", Icon: Wrench },
    unknown:         { cls: "bg-muted text-muted-foreground border-border",              ar: "غير معروف",    en: "Unknown",         Icon: Wrench },
  };
  const m = map[row.connState];
  const Icon = m.Icon;
  return (
    <Badge variant="outline" className={`gap-1 ${m.cls}`}>
      <Icon className="h-3 w-3" />
      {ar ? m.ar : m.en}
    </Badge>
  );
}

function dataModeBadge(mode: ProviderStatusRow["dataMode"], ar: boolean) {
  const map = {
    live:          { cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30", ar: "مباشر",   en: "Live" },
    delayed:       { cls: "bg-amber-500/10  text-amber-500  border-amber-500/30",    ar: "متأخر",   en: "Delayed" },
    mock:          { cls: "bg-warning/10    text-warning    border-warning/30",      ar: "تجريبي",  en: "Demo/Mock" },
    not_connected: { cls: "bg-muted         text-muted-foreground border-border",    ar: "غير متصل", en: "Not Connected" },
    error:         { cls: "bg-rose-500/10   text-rose-500   border-rose-500/30",     ar: "خطأ",     en: "Error" },
  } as const;
  const m = map[mode];
  return <Badge variant="outline" className={`text-[10px] ${m.cls}`}>{ar ? m.ar : m.en}</Badge>;
}

function ProviderHealthPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const fetchStatus = useServerFn(getAllProvidersStatus);
  const [data, setData] = useState<Awaited<ReturnType<typeof getAllProvidersStatus>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true); setErr(null);
    try { setData(await fetchStatus()); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => {
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const grouped = useMemo(() => {
    const out: Record<ProviderCategory, ProviderStatusRow[]> = {
      market_data: [], news: [], macro: [], broker: [], payments: [], kyc: [],
    };
    if (data) for (const p of (data.providers ?? [])) out[p.category].push(p);
    return out;
  }, [data]);

  const totals = useMemo(() => {
    if (!data) return { connected: 0, missing: 0, error: 0, total: 0 };
    let connected = 0, missing = 0, error = 0;
    for (const p of (data.providers ?? [])) {
      if (p.connState === "connected") connected++;
      else if (p.connState === "missing_key" || p.connState === "not_implemented") missing++;
      else if (p.connState === "error" || p.connState === "rate_limited") error++;
    }
    return { connected, missing, error, total: data.providers.length };
  }, [data]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4 md:p-6" dir={dir}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Activity className="h-6 w-6" />
            {ar ? "صحة المزودين" : "Provider Health"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ar
              ? "حالة كل خدمة خارجية متصلة بالمنصة: بيانات الأسواق، الأخبار، الوسطاء، والدفع."
              : "Status of every external service connected to the platform: market data, news, brokers, and payments."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> {totals.connected}/{totals.total} {ar ? "متصل" : "connected"}</Badge>
          {totals.missing > 0 && <Badge variant="outline" className="gap-1"><KeyRound className="h-3 w-3 text-amber-500" /> {totals.missing} {ar ? "مفتاح ناقص" : "missing"}</Badge>}
          {totals.error > 0 && <Badge variant="outline" className="gap-1"><AlertTriangle className="h-3 w-3 text-rose-500" /> {totals.error} {ar ? "خطأ" : "error"}</Badge>}
          <Button onClick={refresh} disabled={loading} variant="outline" size="sm" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {ar ? "تحديث" : "Refresh"}
          </Button>
        </div>
      </header>

      {err && (
        <Card><CardContent className="p-4 text-sm text-rose-500">{err}</CardContent></Card>
      )}

      {data && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{ar ? "التوجيه الحالي" : "Active routing"}</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex items-center justify-between rounded border border-border/60 p-2">
              <span className="text-muted-foreground">{ar ? "أسعار السوق" : "Market quotes"}</span>
              <Badge variant="secondary" className="capitalize">{data.routing.market}</Badge>
            </div>
            <div className="flex items-center justify-between rounded border border-border/60 p-2">
              <span className="text-muted-foreground">{ar ? "البيانات الاقتصادية" : "Macro data"}</span>
              <Badge variant="secondary" className="capitalize">{data.routing.macro}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {data?.routingPlan && data.routingPlan.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{ar ? "خطة التوجيه حسب فئة الأصل" : "Failover plan by asset class"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-3">
            {data.routingPlan.map((row) => (
              <div key={row.assetClass} className="rounded border border-border/60 p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono uppercase">{row.assetClass}</span>
                  <Badge variant={row.selected === "not_connected" ? "destructive" : "secondary"} className="capitalize">
                    {row.selected}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {row.chain.map((c, i) => (
                    <span key={c.id} className="flex items-center gap-1">
                      <Badge
                        variant="outline"
                        className={c.available
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                          : "bg-muted text-muted-foreground"}
                      >
                        {c.id}
                      </Badge>
                      {i < row.chain.length - 1 && <span className="text-muted-foreground">→</span>}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">{row.reason}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {CATEGORY_ORDER.map((cat) => {
        const rows = grouped[cat];
        if (!rows || rows.length === 0) return null;
        const label = CATEGORY_LABELS[cat];
        return (
          <section key={cat} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{ar ? label.ar : label.en}</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => (
                <Card key={row.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between gap-2 text-sm">
                      <span className="capitalize">{row.label}</span>
                      {stateBadge(row, ar)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{ar ? "وضع البيانات" : "Data mode"}</span>
                      {dataModeBadge(row.dataMode, ar)}
                    </div>
                    {row.envKeys.length > 0 && (
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-muted-foreground">{ar ? "المفاتيح المطلوبة" : "Required keys"}</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help font-mono text-[10px]">{row.envKeys.length}× ENV</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="font-mono text-[11px]">{row.envKeys.join(", ")}</div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                    {row.endpoint && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Endpoint</span>
                        <span className="truncate font-mono text-[10px]">{row.endpoint}</span>
                      </div>
                    )}
                    {row.latencyMs != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{ar ? "زمن الاستجابة" : "Latency"}</span>
                        <span>{row.latencyMs} ms</span>
                      </div>
                    )}
                    {row.errorRate != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{ar ? "نسبة الأخطاء" : "Error rate"}</span>
                        <span>{(row.errorRate * 100).toFixed(1)}%</span>
                      </div>
                    )}
                    {row.rateLimited != null && row.rateLimited > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">429</span>
                        <span>{row.rateLimited}</span>
                      </div>
                    )}
                    {row.lastSuccessAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{ar ? "آخر نجاح" : "Last success"}</span>
                        <span className="text-emerald-500">{new Date(row.lastSuccessAt).toLocaleTimeString()}</span>
                      </div>
                    )}
                    {row.lastErrorAt && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex cursor-help items-center justify-between">
                            <span className="text-muted-foreground">{ar ? "آخر خطأ" : "Last error"}</span>
                            <span className="text-rose-500">{new Date(row.lastErrorAt).toLocaleTimeString()}</span>
                          </div>
                        </TooltipTrigger>
                        {row.lastError && (
                          <TooltipContent className="max-w-xs">
                            <div className="font-mono text-[11px]">{row.lastError}</div>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    )}
                    {row.note && <p className="pt-1 text-[10px] text-muted-foreground">{row.note}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}

      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Wifi className="h-3 w-3" /> {ar ? "تحديث تلقائي كل 60 ثانية. لا تُعرض قيم المفاتيح أبداً." : "Auto-refresh every 60s. Key values are never exposed."}
      </p>
    </div>
  );
}
