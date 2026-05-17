import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Power, ShieldAlert, AlertTriangle, Activity, Cpu, PlugZap, Wallet, Gauge,
} from "lucide-react";
import { getAccount, type BrokerAccount } from "@/services/broker/binanceConnector";
import { getExecutionFeed, getExecutionMetrics, type ExecutionEvent } from "@/services/execution/liveExecutionEngine";
import {
  evaluateRisk, DEFAULT_RISK_LIMITS, type RiskReport,
} from "@/services/risk/globalRiskEngine";
import {
  getEmergencyState, triggerEmergency, clearEmergency, subscribeEmergency,
  type EmergencyState,
} from "@/services/risk/emergencyProtection";
import {
  getAutonomyConfig, setAutonomyConfig, type AutonomyMode,
} from "@/services/autonomy/aiTradingController";
import type { MarketIntel } from "@/services/analysis";

const MODES: AutonomyMode[] = ["off", "advisory", "semi-auto", "full-auto"];

export function AutonomousExecutionPanel({ data, ar }: { data?: MarketIntel; ar: boolean }) {
  const [account, setAccount] = useState<BrokerAccount | null>(null);
  const [feed, setFeed] = useState<ExecutionEvent[]>([]);
  const [emergency, setEmergency] = useState<EmergencyState>(getEmergencyState());
  const [autonomy, setAutonomy] = useState(getAutonomyConfig());

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const a = await getAccount("testnet");
      if (!cancelled) {
        setAccount(a);
        setFeed(getExecutionFeed(8));
      }
    };
    tick();
    const i = setInterval(tick, 8000);
    const unsub = subscribeEmergency(setEmergency);
    return () => { cancelled = true; clearInterval(i); unsub(); };
  }, []);

  const metrics = getExecutionMetrics();

  const risk: RiskReport = useMemo(() => {
    const vol = data?.quotes?.length
      ? data.quotes.reduce((a, q) => a + q.volatility, 0) / data.quotes.length
      : 40;
    const panic = data?.regime?.regime === "Panic";
    return evaluateRisk({
      equity: account?.equity ?? 10_000,
      dailyPnl: 0,
      drawdownPct: 0,
      exposurePct: account?.positions?.length ? 25 : 0,
      marketVolatility: Math.round(vol),
      panic,
    }, DEFAULT_RISK_LIMITS);
  }, [data, account]);

  const stateTone: Record<RiskReport["state"], string> = {
    normal: "border-success/40 text-success",
    caution: "border-warning/40 text-warning",
    defensive: "border-warning/40 text-warning",
    shutdown: "border-danger/40 text-danger",
  };

  const onMode = (m: AutonomyMode) => setAutonomy(setAutonomyConfig({ mode: m }));

  return (
    <Card className="border-border/50 bg-card/40 p-5 backdrop-blur-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-glow">
            <Cpu className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold">
              {ar ? "التنفيذ المستقل والوسيط" : "Autonomous Execution & Broker"}
            </h3>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {ar ? "وضع تجريبي · Binance Testnet" : "TESTNET MODE · Binance"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-warning/40 text-warning">
            <ShieldAlert className="me-1 h-3 w-3" /> {ar ? "آمن" : "Safe Mode"}
          </Badge>
          <Button
            size="sm"
            variant={emergency.active ? "outline" : "destructive"}
            onClick={() => emergency.active ? clearEmergency() : triggerEmergency("manual")}
            className="gap-1.5"
          >
            <Power className="h-3.5 w-3.5" />
            {emergency.active ? (ar ? "إلغاء الإيقاف" : "Clear Stop") : (ar ? "إيقاف طارئ" : "EMERGENCY STOP")}
          </Button>
        </div>
      </div>

      {emergency.active && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-semibold">{emergency.message}</span>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-4">
        {/* Broker connection */}
        <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <PlugZap className="h-3 w-3" /> {ar ? "اتصال الوسيط" : "Broker Status"}
          </div>
          <div className="flex items-center justify-between">
            <span className={cn("text-sm font-bold", account?.connected ? "text-success" : "text-muted-foreground")}>
              {account?.connected ? (ar ? "متصل" : "Connected") : (ar ? "غير متصل" : "Offline")}
            </span>
            <Badge variant="outline" className="border-primary/30 text-[10px]">{account?.mode ?? "testnet"}</Badge>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            {ar ? "آخر فحص" : "Last ping"}: {account ? new Date(account.lastPing).toLocaleTimeString() : "—"}
          </div>
        </div>

        {/* Live portfolio */}
        <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Wallet className="h-3 w-3" /> {ar ? "المحفظة الحية" : "Live Portfolio"}
          </div>
          <div className="text-lg font-bold tabular-nums">
            ${account?.equity?.toLocaleString() ?? "—"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {ar ? "متاح" : "Available"}: ${account?.available?.toLocaleString() ?? "—"}
            <span className="ms-2">· {account?.positions?.length ?? 0} {ar ? "صفقة" : "positions"}</span>
          </div>
        </div>

        {/* Risk state */}
        <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Gauge className="h-3 w-3" /> {ar ? "حالة المخاطرة" : "Global Risk"}
          </div>
          <Badge variant="outline" className={cn("text-[11px] uppercase", stateTone[risk.state])}>
            {risk.state}
          </Badge>
          <div className="mt-2 text-[11px] text-muted-foreground">
            {ar ? "تعرض موصى به" : "Rec. exposure"}: {risk.recommendedExposurePct.toFixed(0)}%
          </div>
        </div>

        {/* Execution health */}
        <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Activity className="h-3 w-3" /> {ar ? "صحة التنفيذ" : "Execution Health"}
          </div>
          <div className="text-sm font-bold">{metrics.successRate}% {ar ? "نجاح" : "fill"}</div>
          <div className="text-[11px] text-muted-foreground">
            {ar ? "زمن" : "Lat"} {metrics.avgLatencyMs}ms · {ar ? "انزلاق" : "slip"} {metrics.avgSlippagePct}%
          </div>
        </div>
      </div>

      {/* Autonomy controls */}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">{ar ? "وضع التحكم الذاتي" : "Autonomous Mode"}</span>
            <Switch
              checked={autonomy.mode !== "off"}
              onCheckedChange={(c) => onMode(c ? "advisory" : "off")}
              disabled={emergency.active}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MODES.map((m) => (
              <button
                key={m}
                onClick={() => onMode(m)}
                disabled={emergency.active}
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px] font-medium capitalize transition",
                  autonomy.mode === m
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border/40 text-muted-foreground hover:border-primary/40",
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{ar ? "موافقة يدوية مطلوبة" : "Manual approval required"}</span>
            <Switch
              checked={autonomy.requireApproval}
              onCheckedChange={(c) => setAutonomy(setAutonomyConfig({ requireApproval: c }))}
            />
          </div>
        </div>

        {/* Execution feed */}
        <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            {ar ? "تدفق التنفيذ" : "Execution Feed"}
          </div>
          {feed.length === 0 ? (
            <div className="text-[11px] text-muted-foreground">{ar ? "لا توجد عمليات بعد" : "No executions yet."}</div>
          ) : (
            <ul className="space-y-1.5 text-[11px]">
              {feed.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className={cn(
                      "rounded px-1.5 py-0.5 font-bold uppercase",
                      e.kind === "fill" ? "bg-success/15 text-success" :
                      e.kind === "reject" ? "bg-danger/15 text-danger" :
                      "bg-muted/30 text-muted-foreground",
                    )}>{e.kind}</span>
                    <span className="font-mono">{e.symbol}</span>
                    <span className="text-muted-foreground">{e.side} · {e.qty}</span>
                  </span>
                  <span className="text-muted-foreground">{new Date(e.ts).toLocaleTimeString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {(risk.warnings.length > 0 || risk.triggers.length > 0) && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {risk.triggers.length > 0 && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-[11px] text-danger">
              <div className="mb-1 font-bold uppercase tracking-wider">{ar ? "محفزات الإيقاف" : "Shutdown triggers"}</div>
              <ul className="space-y-0.5">{risk.triggers.map((t, i) => <li key={i}>· {t}</li>)}</ul>
            </div>
          )}
          {risk.warnings.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-2.5 text-[11px] text-warning">
              <div className="mb-1 font-bold uppercase tracking-wider">{ar ? "تحذيرات" : "Warnings"}</div>
              <ul className="space-y-0.5">{risk.warnings.map((t, i) => <li key={i}>· {t}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
