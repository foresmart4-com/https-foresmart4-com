import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity, ShieldAlert, Brain, Zap, Power, AlertTriangle, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  getAutopilotState, subscribeAutopilot, setAutopilotMode,
  setConfidenceThreshold, haltAutopilot, resumeAutopilot,
  type AutopilotState, type AutopilotMode,
} from "@/services/autonomy/aiAutopilot";
import { fetchAccount, listExecutionHistory } from "@/lib/realBroker.functions";
import type { MarketIntel } from "@/services/analysis";

interface AccountSnapshot {
  connected: boolean;
  mode?: "testnet" | "live";
  equityUSDT?: number;
  available?: number;
  balances?: Array<{ asset: string; free: number; locked: number }>;
  error?: string;
}

interface HistoryRow {
  id: string; symbol: string; side: string; type: string;
  quantity: number; price: number | null; status: string;
  created_at: string;
}

export function ExecutionControlCenter({ data, ar }: { data: MarketIntel | null; ar: boolean }) {
  const fetchAcct = useServerFn(fetchAccount);
  const fetchHistory = useServerFn(listExecutionHistory);

  const [autopilot, setAutopilot] = useState<AutopilotState>(getAutopilotState());
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [mode, setMode] = useState<"testnet" | "live">("testnet");
  const [busy, setBusy] = useState(false);

  useEffect(() => { const off = subscribeAutopilot(setAutopilot); return () => { off(); }; }, []);

  const refresh = async () => {
    setBusy(true);
    try {
      const [a, h] = await Promise.all([
        fetchAcct({ data: { mode } }).catch(() => ({ connected: false } as AccountSnapshot)),
        fetchHistory().catch(() => ({ rows: [] as HistoryRow[] })),
      ]);
      setAccount(a as AccountSnapshot);
      setHistory((h.rows as HistoryRow[]) ?? []);
    } finally { setBusy(false); }
  };
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mode]);

  const regime = data?.regime?.regime ?? "—";
  const pnlDay = data?.portfolio?.riskScore ?? 0;

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <Activity className="h-4 w-4" />
          </span>
          <h3 className="font-display text-lg font-bold">
            {ar ? "مركز التحكم في التنفيذ" : "Execution Control Center"}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refresh} disabled={busy}>
            <RefreshCw className={cn("h-3 w-3", busy && "animate-spin")} />
          </Button>
          <div className="flex rounded-lg border border-border/50 bg-background/30 p-0.5">
            {(["testnet", "live"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={cn("rounded-md px-2 py-1 text-[11px] font-bold uppercase",
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={ar ? "الاتصال" : "Broker"}
          value={account?.connected ? (ar ? "متصل" : "Connected") : (ar ? "غير متصل" : "Disconnected")}
          variant={account?.connected ? "success" : "muted"} />
        <StatCard label={ar ? "قيمة المحفظة" : "Equity"}
          value={account?.equityUSDT != null ? `$${account.equityUSDT.toLocaleString()}` : "—"}
          variant="primary" />
        <StatCard label={ar ? "نظام السوق" : "Regime"} value={regime} variant="primary" />
        <StatCard label={ar ? "درجة المخاطرة" : "Risk Score"}
          value={`${pnlDay.toFixed(0)}`}
          variant={pnlDay > 70 ? "danger" : pnlDay > 45 ? "muted" : "success"} />
      </div>

      <Card className="border-border/50 bg-card/40 backdrop-blur-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <p className="font-display text-sm font-bold">{ar ? "وضع الذكاء الاصطناعي" : "AI Autopilot"}</p>
            <Badge className={cn("border text-[10px]",
              autopilot.mode === "off" ? "bg-muted/40 text-muted-foreground border-border" :
              autopilot.mode === "full-auto" ? "bg-danger/15 text-danger border-danger/30" :
              "bg-primary/15 text-primary border-primary/30")}>
              {autopilot.mode.toUpperCase()}
            </Badge>
            {autopilot.emergencyHalt && (
              <Badge className="border border-danger/40 bg-danger/15 text-danger text-[10px]">
                <AlertTriangle className="mr-1 h-3 w-3" /> HALT
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(["off", "advisory", "semi-auto", "full-auto"] as AutopilotMode[]).map((m) => (
              <Button key={m} size="sm" variant={autopilot.mode === m ? "default" : "outline"}
                onClick={() => setAutopilotMode(m)} disabled={autopilot.emergencyHalt && m !== "off"}>
                {m}
              </Button>
            ))}
            {autopilot.emergencyHalt ? (
              <Button size="sm" variant="outline" onClick={() => resumeAutopilot()}>
                <Power className="mr-1 h-3 w-3" /> {ar ? "استئناف" : "Resume"}
              </Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => haltAutopilot("manual")}>
                <ShieldAlert className="mr-1 h-3 w-3" /> {ar ? "إيقاف طارئ" : "EMERGENCY STOP"}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {ar ? "حد الثقة" : "Confidence threshold"}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Slider value={[autopilot.confidenceThreshold]} min={50} max={95} step={1}
                onValueChange={(v) => setConfidenceThreshold(v[0])} className="flex-1" />
              <span className="font-mono text-sm font-bold w-10 text-right">{autopilot.confidenceThreshold}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {ar ? "قرارات اليوم" : "Decisions today"}
            </p>
            <p className="mt-1 font-mono text-lg font-bold">{autopilot.decisionsToday}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {ar ? "نسبة النجاح" : "Success rate"}
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-success">{autopilot.successRate}%</p>
          </div>
        </div>

        {autopilot.lastDecision && (
          <div className="mt-3 rounded-md border border-border/50 bg-background/30 p-2 text-xs">
            <p className="flex items-center gap-1 text-muted-foreground">
              <Zap className="h-3 w-3" />
              {ar ? "آخر قرار:" : "Last decision:"}{" "}
              <span className="font-bold text-foreground">{autopilot.lastDecision.action}</span>{" "}
              · {autopilot.lastDecision.asset}
            </p>
            <p className="mt-0.5 text-muted-foreground">{autopilot.lastDecision.rationale}</p>
          </div>
        )}
      </Card>

      <Card className="border-border/50 bg-card/40 backdrop-blur-xl p-4">
        <p className="mb-2 font-display text-sm font-bold">{ar ? "سجل التنفيذ" : "Execution History"}</p>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">{ar ? "لا يوجد تنفيذ بعد." : "No executions yet."}</p>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="text-left py-1">Time</th><th className="text-left">Symbol</th>
                <th className="text-left">Side</th><th className="text-right">Qty</th>
                <th className="text-right">Price</th><th className="text-right">Status</th></tr>
              </thead>
              <tbody className="font-mono">
                {history.map((r) => (
                  <tr key={r.id} className="border-t border-border/30">
                    <td className="py-1 text-muted-foreground">{new Date(r.created_at).toLocaleTimeString()}</td>
                    <td>{r.symbol}</td>
                    <td className={r.side === "BUY" ? "text-success" : "text-danger"}>{r.side}</td>
                    <td className="text-right">{r.quantity}</td>
                    <td className="text-right">{r.price?.toFixed(2) ?? "—"}</td>
                    <td className="text-right">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}

function StatCard({ label, value, variant }: {
  label: string; value: string; variant: "success" | "danger" | "primary" | "muted";
}) {
  const c = {
    success: "border-success/30 bg-success/10 text-success",
    danger: "border-danger/30 bg-danger/10 text-danger",
    primary: "border-primary/30 bg-primary/10 text-primary",
    muted: "border-border bg-muted/20 text-muted-foreground",
  }[variant];
  return (
    <Card className={cn("border bg-card/40 backdrop-blur-xl p-3", c)}>
      <p className="text-[10px] uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-1 font-mono text-base font-bold">{value}</p>
    </Card>
  );
}
