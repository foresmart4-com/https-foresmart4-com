// Live Command Center — Phase 2 institutional live trading panel.
// Displays live portfolio, AI activity, risk state, execution stream, emergency controls.
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, AlertOctagon, ShieldCheck, Radio, TrendingUp, TrendingDown, RefreshCw, Zap, Lock } from "lucide-react";
import {
  getLivePortfolio, getLivePerformance, getLiveStatus,
  triggerEmergencyStop, resumeTrading,
} from "@/lib/liveTrading.functions";
import { toast } from "sonner";

interface Holding { asset: string; amount: number; valueUSDT: number; weightPct: number; }
interface Snapshot {
  equityUSDT: number; availableUSDT: number; exposurePct: number;
  pnlDay: number; pnlTotal: number; concentrationHHI: number;
  topHolding: { asset: string; weightPct: number } | null;
  holdings: Holding[]; capturedAt: number;
}
interface Performance {
  totalTrades: number; wins: number; losses: number; winRatePct: number;
  pnlTotal: number; profitFactor: number; sharpeLike: number; maxDrawdownPct: number;
}
interface StatusFeed {
  emergencyStopActive: boolean;
  decisions: Array<{ id: string; asset: string; action: string; confidence: number; rationale: string; created_at: string }>;
  executions: Array<{ id: string; symbol: string; side: string; quantity: number; price: number; status: string; created_at: string }>;
  riskEvents: Array<{ id: string; severity: string; category: string; message: string; created_at: string }>;
}

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

export function LiveCommandCenter({ ar = false }: { ar?: boolean }) {
  const fetchPortfolio = useServerFn(getLivePortfolio);
  const fetchPerf = useServerFn(getLivePerformance);
  const fetchStatus = useServerFn(getLiveStatus);
  const stopFn = useServerFn(triggerEmergencyStop);
  const resumeFn = useServerFn(resumeTrading);

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [perf, setPerf] = useState<Performance | null>(null);
  const [status, setStatus] = useState<StatusFeed | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"testnet" | "live">("live");
  const [pulse, setPulse] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, perfRes, statRes] = await Promise.all([
        fetchPortfolio({ data: { mode } }).catch(() => ({ connected: false })),
        fetchPerf({ data: {} }).catch(() => null),
        fetchStatus({ data: {} }).catch(() => null),
      ]);
      const p = pRes as { connected: boolean; snapshot?: Snapshot };
      setConnected(p.connected);
      if (p.snapshot) setSnapshot(p.snapshot);
      if (perfRes) setPerf((perfRes as { report: Performance }).report);
      if (statRes) setStatus(statRes as StatusFeed);
      setPulse((n) => n + 1);
    } finally {
      setLoading(false);
    }
  }, [fetchPortfolio, fetchPerf, fetchStatus, mode]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const t = setInterval(() => { refresh(); }, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  const handleStop = async () => {
    try {
      await stopFn({ data: { reason: "Manual emergency stop from Live Command Center" } });
      toast.success(ar ? "تم تفعيل الإيقاف الطارئ" : "Emergency stop activated");
      refresh();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  };
  const handleResume = async () => {
    try {
      await resumeFn({ data: {} });
      toast.success(ar ? "تم استئناف التداول" : "Trading resumed");
      refresh();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  };

  const stopActive = status?.emergencyStopActive ?? false;

  return (
    <Card className="p-5 bg-gradient-to-br from-slate-950/80 to-indigo-950/40 border-indigo-500/30 backdrop-blur-xl relative overflow-hidden">
      {/* Pulse indicator */}
      <div key={pulse} className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" />

      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/30 to-indigo-500/30 border border-emerald-400/40 flex items-center justify-center ${connected ? "shadow-[0_0_20px_rgba(16,185,129,0.4)]" : ""}`}>
            <Radio className={`w-5 h-5 ${connected ? "text-emerald-300" : "text-muted-foreground"}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold tracking-wide uppercase text-foreground">
                {ar ? "مركز القيادة المباشر" : "Live Command Center"}
              </h3>
              <Badge variant="outline" className={mode === "live" ? "text-red-300 border-red-500/40 bg-red-500/10" : "text-amber-300 border-amber-500/40 bg-amber-500/10"}>
                {mode === "live" ? (ar ? "حقيقي" : "LIVE") : (ar ? "تجريبي" : "TESTNET")}
              </Badge>
              {stopActive && (
                <Badge variant="outline" className="text-red-400 border-red-500/60 bg-red-500/15 animate-pulse">
                  <Lock className="w-3 h-3 mr-1" /> {ar ? "متوقف" : "HALTED"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ar ? "تنفيذ ذكي مستقل · حماية مؤسسية · مراقبة لحظية" : "Autonomous AI execution · institutional protection · live monitoring"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm" variant="outline"
            onClick={() => setMode(mode === "live" ? "testnet" : "live")}
            className="h-8 text-xs">
            {mode === "live" ? (ar ? "تجريبي" : "Testnet") : (ar ? "حقيقي" : "Live")}
          </Button>
          <Button size="icon" variant="ghost" onClick={refresh} disabled={loading} className="h-8 w-8">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {!connected ? (
        <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm text-amber-200">
          {ar
            ? "لا توجد بيانات اعتماد Binance مكوّنة. أضف مفاتيح API في إعدادات الحساب لتفعيل التداول المباشر."
            : "No Binance credentials configured. Add API keys in account settings to activate live trading."}
        </div>
      ) : (
        <>
          {/* Equity row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <Metric label={ar ? "حقوق المحفظة" : "Equity"} value={snapshot ? fmtUsd(snapshot.equityUSDT) : "—"} accent="text-emerald-300" />
            <Metric label={ar ? "متاح" : "Available"} value={snapshot ? fmtUsd(snapshot.availableUSDT) : "—"} accent="text-foreground" />
            <Metric
              label={ar ? "ربح اليوم" : "P&L Today"}
              value={snapshot ? `${snapshot.pnlDay >= 0 ? "+" : ""}${fmtUsd(snapshot.pnlDay)}` : "—"}
              accent={(snapshot?.pnlDay ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}
            />
            <Metric
              label={ar ? "إجمالي الربح" : "P&L Total"}
              value={snapshot ? `${snapshot.pnlTotal >= 0 ? "+" : ""}${fmtUsd(snapshot.pnlTotal)}` : "—"}
              accent={(snapshot?.pnlTotal ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}
            />
          </div>

          {/* Exposure + concentration */}
          {snapshot && (
            <div className="mb-4 grid md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-background/40 border border-border/50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{ar ? "نسبة التعرّض" : "Market Exposure"}</span>
                  <span className="text-xs font-bold text-foreground">{snapshot.exposurePct.toFixed(1)}%</span>
                </div>
                <Progress value={snapshot.exposurePct} className="h-1.5" />
              </div>
              <div className="p-3 rounded-lg bg-background/40 border border-border/50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{ar ? "تركّز" : "Concentration HHI"}</span>
                  <span className="text-xs font-bold text-foreground">
                    {snapshot.concentrationHHI.toFixed(0)}
                    {snapshot.topHolding && <span className="text-muted-foreground ml-2">{snapshot.topHolding.asset} {snapshot.topHolding.weightPct.toFixed(1)}%</span>}
                  </span>
                </div>
                <Progress value={Math.min(100, snapshot.concentrationHHI / 100)} className="h-1.5" />
              </div>
            </div>
          )}

          {/* Performance row */}
          {perf && perf.totalTrades > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-background/30 border border-border/40">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-3.5 h-3.5 text-indigo-300" />
                <span className="text-[11px] uppercase tracking-wider font-semibold text-indigo-300">{ar ? "الأداء" : "Performance"}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
                <SubMetric label={ar ? "الصفقات" : "Trades"} value={String(perf.totalTrades)} />
                <SubMetric label={ar ? "نسبة الفوز" : "Win Rate"} value={`${perf.winRatePct.toFixed(1)}%`} accent="text-emerald-300" />
                <SubMetric label="Sharpe" value={perf.sharpeLike.toFixed(2)} />
                <SubMetric label={ar ? "أقصى تراجع" : "Max DD"} value={`${perf.maxDrawdownPct.toFixed(1)}%`} accent="text-red-300" />
                <SubMetric label={ar ? "عامل الربح" : "Profit Factor"} value={perf.profitFactor.toFixed(2)} />
              </div>
            </div>
          )}

          {/* Holdings heatmap */}
          {snapshot && snapshot.holdings.length > 0 && (
            <div className="mb-4">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                {ar ? "خريطة الحيازات" : "Allocation Heatmap"}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {snapshot.holdings.slice(0, 12).map((h) => {
                  const heat = Math.min(1, h.weightPct / 50);
                  return (
                    <div key={h.asset}
                      className="px-2.5 py-1.5 rounded-md border border-border/40 text-xs flex items-center gap-2"
                      style={{ background: `rgba(99, 102, 241, ${0.08 + heat * 0.25})` }}>
                      <span className="font-bold text-foreground">{h.asset}</span>
                      <span className="text-muted-foreground">{h.weightPct.toFixed(1)}%</span>
                      <span className="text-emerald-300/80 text-[10px]">{fmtUsd(h.valueUSDT)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI activity + executions */}
          <div className="grid lg:grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-background/30 border border-border/40">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-300">{ar ? "نشاط الذكاء الاصطناعي" : "AI Decision Stream"}</span>
              </div>
              <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {(status?.decisions ?? []).slice(0, 6).map((d) => (
                  <li key={d.id} className="text-xs flex items-start gap-2">
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-indigo-500/40 text-indigo-300">{d.confidence}%</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate">{d.action} · {d.asset}</div>
                      <div className="text-[10px] text-muted-foreground line-clamp-1">{d.rationale}</div>
                    </div>
                  </li>
                ))}
                {(!status?.decisions || status.decisions.length === 0) && (
                  <li className="text-xs text-muted-foreground italic">{ar ? "لا قرارات حديثة" : "No recent decisions"}</li>
                )}
              </ul>
            </div>

            <div className="p-3 rounded-lg bg-background/30 border border-border/40">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-3.5 h-3.5 text-emerald-300" />
                <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-300">{ar ? "تدفق التنفيذ" : "Execution Stream"}</span>
              </div>
              <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {(status?.executions ?? []).slice(0, 6).map((e) => (
                  <li key={e.id} className="text-xs flex items-center gap-2">
                    {e.side === "BUY"
                      ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      : <TrendingDown className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                    <span className="font-bold text-foreground">{e.symbol}</span>
                    <span className="text-muted-foreground">{e.quantity} @ {Number(e.price).toFixed(2)}</span>
                    <Badge variant="outline" className={`ml-auto text-[9px] px-1 py-0 ${e.status === "FILLED" ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-300"}`}>{e.status}</Badge>
                  </li>
                ))}
                {(!status?.executions || status.executions.length === 0) && (
                  <li className="text-xs text-muted-foreground italic">{ar ? "لا تنفيذات حديثة" : "No recent executions"}</li>
                )}
              </ul>
            </div>
          </div>

          {/* Risk events */}
          {status && status.riskEvents.length > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-red-300" />
                <span className="text-[11px] uppercase tracking-wider font-semibold text-red-300">{ar ? "أحداث المخاطر" : "Risk Events"}</span>
              </div>
              <ul className="space-y-1 max-h-28 overflow-y-auto pr-1">
                {status.riskEvents.slice(0, 5).map((r) => (
                  <li key={r.id} className="text-xs flex items-center gap-2">
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 ${r.severity === "critical" ? "border-red-500/60 text-red-300" : "border-amber-500/40 text-amber-300"}`}>{r.severity}</Badge>
                    <span className="text-muted-foreground truncate">{r.category}: {r.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Emergency controls */}
          <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-border/40">
            {!stopActive ? (
              <Button onClick={handleStop} variant="destructive" className="flex-1 gap-2 font-bold">
                <AlertOctagon className="w-4 h-4" />
                {ar ? "إيقاف طارئ" : "EMERGENCY STOP"}
              </Button>
            ) : (
              <Button onClick={handleResume} className="flex-1 gap-2 font-bold bg-emerald-600 hover:bg-emerald-500">
                <ShieldCheck className="w-4 h-4" />
                {ar ? "استئناف التداول" : "RESUME TRADING"}
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="p-2.5 rounded-md bg-background/40 border border-border/40">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-base font-bold mt-0.5 ${accent}`}>{value}</div>
    </div>
  );
}
function SubMetric({ label, value, accent = "text-foreground" }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold ${accent}`}>{value}</div>
    </div>
  );
}
