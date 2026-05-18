import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Activity, Globe, Brain, Shield, Zap, AlertTriangle, Cpu, Radio, Layers, TrendingUp,
} from "lucide-react";
import { aggregateMarkets, type NormalizedQuote } from "@/services/markets";
import { computeMacroOutlook, classifyRegime } from "@/services/ai";
import { recentAlerts, onAlert, emitAlert, triggerEmergency } from "@/services/alerts";
import { snapshot as telemetrySnapshot, record as recordTelemetry } from "@/services/telemetry";
import { aiMemory, statsFor } from "@/services/learning";
import { readAudit } from "@/services/execution/institutionalEngine";

interface Props { ar?: boolean; }
const T = (ar: boolean, en: string, arT: string) => (ar ? arT : en);

export function MasterControlCenter({ ar = false }: Props) {
  const [quotes, setQuotes] = useState<NormalizedQuote[]>([]);
  const [lastLatency, setLastLatency] = useState(0);
  const [alerts, setAlerts] = useState(recentAlerts(8));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancel = false;
    const pull = async () => {
      try {
        const r = await aggregateMarkets();
        if (cancel) return;
        setQuotes(r.quotes);
        setLastLatency(r.latencyMs);
        recordTelemetry("markets", r.latencyMs, true);
      } catch {
        recordTelemetry("markets", 0, false);
      }
    };
    pull();
    const id = setInterval(pull, 20000);
    const off = onAlert(() => setAlerts(recentAlerts(8)));
    const t = setInterval(() => setTick((x) => x + 1), 5000);
    return () => { cancel = true; clearInterval(id); clearInterval(t); off(); };
  }, []);

  const stats = useMemo(() => statsFor(aiMemory.list()), [tick]);
  const tele = useMemo(() => telemetrySnapshot(), [tick, lastLatency]);
  const audit = useMemo(() => readAudit(5), [tick]);

  const macro = useMemo(() => {
    const get = (s: string) => quotes.find((q) => q.symbol === s)?.price;
    return computeMacroOutlook({
      dxy: undefined,
      gold: get("XAUUSD"),
      oil: get("WTI") ?? get("BRENT"),
    });
  }, [quotes]);

  const regime = useMemo(() => classifyRegime({
    trendPct: 0.012, volatility: 0.025, drawdownPct: 0.018, breadth: 0.55,
  }), [tick]);

  const regimeColor: Record<string, string> = {
    trending_bull: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    recovery: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
    ranging: "text-slate-300 border-slate-500/30 bg-slate-500/10",
    trending_bear: "text-rose-400 border-rose-500/30 bg-rose-500/10",
    volatile: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    risk_off: "text-orange-400 border-orange-500/30 bg-orange-500/10",
    panic: "text-red-400 border-red-500/30 bg-red-500/10",
  };

  const handleTestAlert = () => emitAlert({
    title: T(ar,"AI heartbeat","نبض الذكاء"),
    body: T(ar,"All systems nominal","كل الأنظمة طبيعية"),
    severity: "info", channels: ["browser"], category: "system",
  });

  const handleEmergency = () => triggerEmergency(T(ar,"Manual master kill","إيقاف رئيسي يدوي"));

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-background via-background to-primary/5">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" />
            {T(ar, "Master Control Center", "مركز التحكم الرئيسي")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={regimeColor[regime.regime]}>
              {regime.regime.replace("_"," ").toUpperCase()} · {(regime.confidence*100).toFixed(0)}%
            </Badge>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              <Radio className="w-3 h-3 mr-1 animate-pulse" />
              {T(ar,"LIVE","مباشر")}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi icon={<Globe className="w-4 h-4" />} label={T(ar,"Markets Aggregated","الأسواق المجمعة")}
               value={`${quotes.length}`} sub={`${lastLatency}ms`} />
          <Kpi icon={<Brain className="w-4 h-4" />} label={T(ar,"Macro Bias","التحيز الكلي")}
               value={macro.bias.replace("_"," ").toUpperCase()} sub={`score ${macro.score.toFixed(2)}`} />
          <Kpi icon={<TrendingUp className="w-4 h-4" />} label={T(ar,"AI Win Rate","نسبة الفوز")}
               value={`${(stats.winRate*100).toFixed(0)}%`} sub={`${stats.trades} trades`} />
          <Kpi icon={<Shield className="w-4 h-4" />} label={T(ar,"Expectancy","التوقع")}
               value={`${(stats.expectancy*100).toFixed(2)}%`} sub={`PF ${stats.profitFactor.toFixed(2)}`} />
        </div>

        {/* Multi-market grid */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium mb-2">
            <Layers className="w-4 h-4" />{T(ar,"Multi-Asset Feed","تغذية متعددة الأصول")}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {quotes.slice(0, 12).map((q) => (
              <div key={q.assetClass + q.symbol} className="p-2 rounded-md border border-border/50 bg-muted/20">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="uppercase">{q.assetClass}</span>
                  <span>{q.symbol}</span>
                </div>
                <div className="text-sm font-semibold mt-0.5">
                  {q.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </div>
                {q.changePct != null && (
                  <div className={`text-[11px] ${q.changePct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {q.changePct >= 0 ? "+" : ""}{q.changePct.toFixed(2)}%
                  </div>
                )}
              </div>
            ))}
            {quotes.length === 0 && (
              <div className="col-span-full text-xs text-muted-foreground p-3">
                {T(ar,"Connecting to market aggregators…","يتم الاتصال بمجمعات الأسواق…")}
              </div>
            )}
          </div>
        </div>

        {/* Telemetry */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium mb-2">
            <Activity className="w-4 h-4" />{T(ar,"Infrastructure Health","صحة البنية التحتية")}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {Object.entries(tele.byComp).slice(0,6).map(([k, v]) => (
              <div key={k} className="p-2 rounded-md border border-border/50 bg-muted/20">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{k}</span>
                  <span className="text-muted-foreground">{v.avgLatency}ms</span>
                </div>
                <Progress value={v.uptime * 100} className="h-1.5 mt-1.5" />
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  uptime {(v.uptime*100).toFixed(1)}% · {v.samples} samples
                </div>
              </div>
            ))}
            {Object.keys(tele.byComp).length === 0 && (
              <div className="col-span-full text-xs text-muted-foreground">
                {T(ar,"Awaiting telemetry…","في انتظار القياس عن بعد…")}
              </div>
            )}
          </div>
        </div>

        {/* Audit + alerts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium mb-2">{T(ar,"Execution Audit","سجل التنفيذ")}</div>
            <div className="space-y-1.5 max-h-40 overflow-auto">
              {audit.length === 0 ? (
                <p className="text-xs text-muted-foreground">{T(ar,"No executions recorded","لا توجد تنفيذات")}</p>
              ) : audit.map((a) => (
                <div key={a.id} className="text-xs p-2 rounded border border-border/50 bg-muted/20 flex justify-between">
                  <span>{a.symbol} {a.side.toUpperCase()} ×{a.filled}/{a.requested}</span>
                  <span className="text-muted-foreground">{a.slippageBps.toFixed(1)} bps</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">{T(ar,"Live Alerts","التنبيهات المباشرة")}</div>
            <div className="space-y-1.5 max-h-40 overflow-auto">
              {alerts.length === 0 ? (
                <p className="text-xs text-muted-foreground">{T(ar,"No active alerts","لا توجد تنبيهات نشطة")}</p>
              ) : alerts.map((a) => (
                <div key={a.id} className={`text-xs p-2 rounded border ${
                  a.severity === "critical" ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : a.severity === "warn" ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                  : "border-border/50 bg-muted/20"
                }`}>
                  <div className="font-medium">{a.title}</div>
                  <div className="opacity-80">{a.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Zap className="w-3.5 h-3.5" />
            {T(ar,"Autonomous ecosystem online","النظام المستقل متصل")}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleTestAlert}>
              {T(ar,"Heartbeat","نبض")}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleEmergency} className="gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {T(ar,"Emergency","طوارئ")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon}{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
