import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, AlertTriangle, Lock, Activity, Gauge, Layers } from "lucide-react";
import {
  DEFAULT_CAPITAL_CONFIG,
  availableDeployable,
  regimeAllocationCap,
  aggregateExposure,
  computeEquityState,
  protectedProfit,
  trailingEquityFloor,
  evaluateDefensiveMode,
  buildHeatmap,
  buildRiskRadar,
  buildAlerts,
  runSafetyChecks,
  type Regime,
  type ExposureItem,
} from "@/services/risk";

interface Props {
  ar?: boolean;
  equity?: number;
  startEquity?: number;
  regime?: Regime;
  volatility?: number;
  liquidityScore?: number;
  confidence?: number;
  exposures?: ExposureItem[];
  equityHistory?: { ts: number; equity: number }[];
  recentTrades?: { ts: number; pnl: number; symbol: string }[];
}

const T = (ar: boolean, en: string, arT: string) => (ar ? arT : en);

export function CapitalProtectionPanel({
  ar = false,
  equity = 10000,
  startEquity = 10000,
  regime = "neutral",
  volatility = 0.02,
  liquidityScore = 0.75,
  confidence = 0.65,
  exposures = [],
  equityHistory = [],
  recentTrades = [],
}: Props) {
  const data = useMemo(() => {
    const cfg = { ...DEFAULT_CAPITAL_CONFIG, totalCapital: equity };
    const breakdown = aggregateExposure(exposures);
    const eqState = computeEquityState({
      history: equityHistory.length ? equityHistory : [{ ts: Date.now(), equity }],
      startEquity,
    });
    const defensive = evaluateDefensiveMode({
      equity: eqState, regime, volatility, consecutiveLosses: 0, flashCrash: false,
    });
    const safety = runSafetyChecks({
      trades: recentTrades, equity, startEquity,
      lastTickAgeMs: 1000, volatility, pendingOrderRate: 0,
    });
    const cap = regimeAllocationCap(cfg, regime);
    const deployable = availableDeployable(cfg, regime, breakdown.total);
    const heat = buildHeatmap(breakdown);
    const radar = buildRiskRadar({
      capitalUtil: equity > 0 ? breakdown.total / equity : 0,
      sectorUtil: breakdown.largestSector.pct,
      correlatedUtil: breakdown.largestCorrelated.pct,
      volatility, drawdownPct: eqState.drawdownPct, liquidityScore, confidence,
    });
    const alerts = buildAlerts({ breakdown, volatility, liquidityScore, confidence });
    return { cfg, breakdown, eqState, defensive, safety, cap, deployable, heat, radar, alerts };
  }, [equity, startEquity, regime, volatility, liquidityScore, confidence, exposures, equityHistory, recentTrades]);

  const modeColor: Record<string, string> = {
    normal: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    cautious: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    defensive: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    frozen: "bg-red-500/10 text-red-400 border-red-500/30",
  };

  const protectedAmt = protectedProfit(data.eqState);
  const floor = trailingEquityFloor(data.eqState);
  const capUtilPct = Math.min(100, (data.breakdown.total / Math.max(1, equity)) * 100);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-background/50">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            {T(ar, "Capital Protection Center", "مركز حماية رأس المال")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={modeColor[data.defensive.mode]}>
              {T(ar, `Mode: ${data.defensive.mode.toUpperCase()}`,
                  `الوضع: ${data.defensive.mode.toUpperCase()}`)}
            </Badge>
            {data.defensive.freeze && (
              <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                <Lock className="w-3 h-3 mr-1" />
                {T(ar, "CAPITAL FROZEN", "تجميد رأس المال")}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label={T(ar,"Protected Capital","رأس المال المحمي")}
               value={`$${floor.toFixed(0)}`} icon={<Shield className="w-4 h-4" />} />
          <Kpi label={T(ar,"Locked Profit","الأرباح المؤمنة")}
               value={`$${protectedAmt.toFixed(0)}`} icon={<Lock className="w-4 h-4" />} />
          <Kpi label={T(ar,"Active Exposure","التعرض النشط")}
               value={`$${data.breakdown.total.toFixed(0)}`} icon={<Activity className="w-4 h-4" />} />
          <Kpi label={T(ar,"Deployable","المتاح للنشر")}
               value={`$${data.deployable.toFixed(0)}`} icon={<Gauge className="w-4 h-4" />} />
        </div>

        {/* Allocation bars */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{T(ar,"Capital Utilization","استخدام رأس المال")}</span>
            <span>{capUtilPct.toFixed(1)}% / {(data.cfg.maxCapitalExposurePct*100).toFixed(0)}%</span>
          </div>
          <Progress value={capUtilPct} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground pt-2">
            <span>{T(ar,"Drawdown","التراجع")}</span>
            <span>{(data.eqState.drawdownPct*100).toFixed(2)}%</span>
          </div>
          <Progress value={Math.min(100, data.eqState.drawdownPct*100*8)} className="h-2" />
        </div>

        {/* Heatmap */}
        <div>
          <div className="flex items-center gap-2 mb-2 text-sm font-medium">
            <Layers className="w-4 h-4" />
            {T(ar,"Sector Concentration","تركز القطاعات")}
          </div>
          {data.heat.length === 0 ? (
            <p className="text-xs text-muted-foreground">{T(ar,"No active exposure","لا يوجد تعرض نشط")}</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {data.heat.map((c) => (
                <div key={c.label} className={`p-2 rounded border text-xs ${riskClass(c.risk)}`}>
                  <div className="font-medium truncate">{c.label}</div>
                  <div className="opacity-80">{(c.pct*100).toFixed(1)}%</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Risk Radar (compact list) */}
        <div>
          <div className="text-sm font-medium mb-2">{T(ar,"Risk Radar","رادار المخاطر")}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {data.radar.map((p) => (
              <div key={p.axis} className="p-2 rounded border border-border/50 bg-muted/20">
                <div className="text-[11px] text-muted-foreground">{p.axis}</div>
                <Progress value={p.value*100} className="h-1.5 mt-1" />
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        {(data.alerts.length > 0 || data.safety.reasons.length > 0) && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              {T(ar,"Active Alerts","التنبيهات النشطة")}
            </div>
            {data.alerts.map((a) => (
              <div key={a.id} className={`text-xs p-2 rounded border ${alertClass(a.level)}`}>
                <span className="uppercase font-semibold mr-2 opacity-80">{a.category}</span>
                {a.message}
              </div>
            ))}
            {data.safety.reasons.map((r, i) => (
              <div key={`s${i}`} className="text-xs p-2 rounded border border-red-500/30 bg-red-500/10 text-red-300">
                <span className="uppercase font-semibold mr-2 opacity-80">SAFETY</span>{r}
              </div>
            ))}
          </div>
        )}

        {data.defensive.reasons.length > 0 && (
          <div className="text-xs text-muted-foreground border-t border-border/50 pt-2">
            <span className="font-semibold">{T(ar,"Defensive policy:","سياسة دفاعية:")} </span>
            {data.defensive.reasons.join(" • ")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}{label}
      </div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  );
}

function riskClass(r: "low"|"med"|"high"|"critical") {
  switch (r) {
    case "critical": return "border-red-500/40 bg-red-500/10 text-red-300";
    case "high": return "border-orange-500/40 bg-orange-500/10 text-orange-300";
    case "med": return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    default: return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
}
function alertClass(l: "info"|"warn"|"critical") {
  switch (l) {
    case "critical": return "border-red-500/40 bg-red-500/10 text-red-300";
    case "warn": return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    default: return "border-border/50 bg-muted/30 text-muted-foreground";
  }
}
