import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Brain, Download, Loader2, Play, ShieldCheck, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/genesis-100")({
  component: Genesis100Page,
  head: () => ({
    meta: [
      { title: "ForeSmart Genesis 100" },
      { name: "description", content: "AI-managed global multi-asset portfolio analysis, paper trading, allocation, risk, and reporting." },
    ],
  }),
});

interface StatusApi {
  wallet: {
    capital: number;
    cashBalance: number;
    investedBalance: number;
    targetMonthlyReturn: number;
    maxDrawdown: number;
    riskProfile: string;
    status: string;
  };
  currentAIMode: string;
  aiMode: "off" | "semi_ai" | "full_ai";
  liveExecutionEnabled: boolean;
  planActive: boolean;
  featureLocked: boolean;
  proPlanRequired: boolean;
  externalTransfersAllowed: false;
  aiCanTransferOutsidePlatform: false;
  manualWithdrawalOnly: true;
  blockedCapabilities: string[];
  allowedCapabilities: string[];
  safeguards: string[];
}

interface ControlsApi {
  aiMode: "off" | "semi_ai" | "full_ai";
  planActive: boolean;
  featureLocked: boolean;
  reason: string | null;
  liveExecutionEnabled: boolean;
  liveBrokerExecutionAllowed: boolean;
}

interface NotificationsApi {
  notifications: {
    emailReportsEnabled: boolean;
    smsReportsEnabled: boolean;
    emailAlertsEnabled: boolean;
    smsAlertsEnabled: boolean;
    reportFrequencies: string[];
    smsAvailable: boolean;
    smsUnavailableReason: string | null;
  };
}

interface ScoreApi {
  symbol: string;
  name: string;
  assetClass: string;
  bucket: string;
  finalGenesisScore: number;
  confidenceScore: number;
  recommendation: string;
  provider: string | null;
  price: number | null;
}

interface AllocationApi {
  symbol: string;
  name: string;
  bucket: string;
  targetWeight: number;
  targetValue: number;
  finalGenesisScore: number;
}

interface DecisionApi {
  timestamp: string;
  symbol: string;
  action: string;
  oldWeight: number;
  newWeight: number;
  reason: string;
  confidence: number;
  executionMode: string;
}

interface CycleApi {
  scores: ScoreApi[];
  allocations: AllocationApi[];
  decisions: DecisionApi[];
  riskWarnings: string[];
  proposedOrders: unknown[];
  paperOrders: unknown[];
  realOrders: unknown[];
}

const periods = ["hourly", "daily", "weekly", "monthly", "quarterly", "semiannual", "annual"];

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`${path} failed with ${res.status}`);
  return res.json() as Promise<T>;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function money(v: number): string {
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function Genesis100Page() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  const [status, setStatus] = useState<StatusApi | null>(null);
  const [scores, setScores] = useState<ScoreApi[]>([]);
  const [allocations, setAllocations] = useState<AllocationApi[]>([]);
  const [decisions, setDecisions] = useState<DecisionApi[]>([]);
  const [controls, setControls] = useState<ControlsApi | null>(null);
  const [notifications, setNotifications] = useState<NotificationsApi | null>(null);
  const [riskWarnings, setRiskWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topScores = useMemo(() => scores.slice(0, 10), [scores]);
  const topAllocations = useMemo(() => allocations.slice(0, 12), [allocations]);

  const load = async () => {
    setError(null);
    const [s, a, d, c, n] = await Promise.all([
      getJson<StatusApi>("/api/public/genesis100/status"),
      getJson<{ allocations: AllocationApi[] }>("/api/public/genesis100/allocations"),
      getJson<{ decisions: DecisionApi[] }>("/api/public/genesis100/decisions"),
      getJson<ControlsApi>("/api/public/genesis100/controls"),
      getJson<NotificationsApi>("/api/public/genesis100/notifications"),
    ]);
    setStatus(s);
    setAllocations(a.allocations ?? []);
    setDecisions(d.decisions ?? []);
    setControls(c);
    setNotifications(n);
  };

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load Genesis 100"))
      .finally(() => setLoading(false));
  }, []);

  const runCycle = async () => {
    setRunning(true);
    setError(null);
    try {
      const cycle = await getJson<CycleApi>("/api/public/genesis100/run-cycle", { method: "POST" });
      setScores(cycle.scores ?? []);
      setAllocations(cycle.allocations ?? []);
      setDecisions(cycle.decisions ?? []);
      setRiskWarnings(cycle.riskWarnings ?? []);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cycle failed");
    } finally {
      setRunning(false);
    }
  };

  const setAIMode = async (aiMode: ControlsApi["aiMode"]) => {
    setError(null);
    try {
      const next = await getJson<ControlsApi>("/api/public/genesis100/controls", {
        method: "POST",
        body: JSON.stringify({ aiMode }),
      });
      setControls(next);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update AI mode");
    }
  };

  if (loading) {
    return <div className="grid min-h-[50vh] place-items-center text-muted-foreground">{t("جاري تحميل Genesis 100...", "Loading Genesis 100...")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">ForeSmart Genesis 100</h1>
            <Badge variant="outline">{status?.wallet.status ?? "active_analysis"}</Badge>
            <Badge variant="outline" className="border-primary/40">{t("يتطلب Pro", "Pro required")}</Badge>
            <Badge variant="outline" className="border-amber-500/40 text-amber-700">{t("التنفيذ الحقيقي محظور", "Live execution blocked")}</Badge>
            <Badge variant="outline" className="border-rose-500/40 text-rose-700">{t("التحويلات الخارجية ممنوعة", "External transfers forbidden")}</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {t(
              "محفظة عالمية مدارة بالذكاء الاصطناعي للتحليل والتخصيص والتداول التجريبي فقط. التنفيذ الحقيقي معطل.",
              "AI-managed global multi-asset portfolio for analysis, allocation, and paper trading only. Live execution is disabled.",
            )}
          </p>
        </div>
        <Button onClick={runCycle} disabled={running}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          {t("تشغيل دورة AI", "Run AI Cycle")}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("النمط", "AI Mode")}</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{controls?.aiMode ?? status?.aiMode ?? "semi_ai"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("رأس المال", "Capital")}</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{money(status?.wallet.capital ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("الهدف الشهري", "Monthly Target")}</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{pct(status?.wallet.targetMonthlyReturn ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("التنفيذ الحقيقي", "Live Execution")}</CardTitle></CardHeader>
          <CardContent><Badge variant="outline" className="border-amber-500/40 text-amber-700">{String(status?.liveExecutionEnabled ?? false)}</Badge></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("تحكم Genesis 100", "Genesis 100 Controls")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["off", "semi_ai", "full_ai"] as const).map((mode) => (
              <Button
                key={mode}
                variant={(controls?.aiMode ?? status?.aiMode) === mode ? "default" : "outline"}
                onClick={() => setAIMode(mode)}
              >
                {mode === "off" ? "AI Off" : mode === "semi_ai" ? "Semi AI" : "Full AI"}
              </Button>
            ))}
          </div>
          <div className="grid gap-2 text-sm md:grid-cols-3">
            <div className="rounded-md bg-muted p-3">
              <div className="font-medium">{t("حالة الخطة", "Plan Status")}</div>
              <div className="text-muted-foreground">
                {(controls?.planActive ?? status?.planActive) ? t("Pro مفعل", "Pro active") : controls?.reason ?? "Genesis 100 requires Pro plan"}
              </div>
            </div>
            <div className="rounded-md bg-muted p-3">
              <div className="font-medium">{t("التحويلات الخارجية", "External Transfers")}</div>
              <div className="text-muted-foreground">{String(status?.externalTransfersAllowed ?? false)} / {t("السحب يدوي فقط", "manual withdrawal only")}</div>
            </div>
            <div className="rounded-md bg-muted p-3">
              <div className="font-medium">{t("التنفيذ الحي", "Live Execution")}</div>
              <div className="text-muted-foreground">{String(controls?.liveBrokerExecutionAllowed ?? false)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("تفضيلات الإشعارات", "Notification Preferences")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-md border p-3">{t("تقارير البريد", "Email reports")}: {String(notifications?.notifications.emailReportsEnabled ?? false)}</div>
          <div className="rounded-md border p-3">{t("تنبيهات البريد", "Email alerts")}: {String(notifications?.notifications.emailAlertsEnabled ?? false)}</div>
          <div className="rounded-md border p-3">{t("تقارير SMS", "SMS reports")}: {String(notifications?.notifications.smsReportsEnabled ?? false)}</div>
          <div className="rounded-md border p-3">
            SMS: {notifications?.notifications.smsAvailable ? "available" : notifications?.notifications.smsUnavailableReason ?? "SMS provider is not configured"}
          </div>
          <div className="rounded-md border p-3 md:col-span-2">
            {t("تكرار التقارير", "Report frequencies")}: {(notifications?.notifications.reportFrequencies ?? periods).join(", ")}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4" />{t("تخصيص رأس المال", "Capital Allocation")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm"><span>{t("نقد", "Cash")}</span><span>{money(status?.wallet.cashBalance ?? 0)}</span></div>
            <Progress value={((status?.wallet.cashBalance ?? 0) / Math.max(1, status?.wallet.capital ?? 1)) * 100} />
            <div className="flex justify-between text-sm"><span>{t("مستثمر", "Invested")}</span><span>{money(status?.wallet.investedBalance ?? 0)}</span></div>
            <Progress value={((status?.wallet.investedBalance ?? 0) / Math.max(1, status?.wallet.capital ?? 1)) * 100} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />{t("السلامة والمخاطر", "Safety & Risk")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(riskWarnings.length ? riskWarnings : status?.safeguards ?? []).slice(0, 5).map((w) => (
              <div key={w} className="rounded-md bg-muted p-2 text-muted-foreground">{w}</div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("أعلى الأصول تقييماً", "Top Ranked Assets")}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="p-2">Symbol</th><th className="p-2">Bucket</th><th className="p-2">Score</th><th className="p-2">Confidence</th><th className="p-2">Provider</th><th className="p-2">Recommendation</th></tr>
            </thead>
            <tbody>
              {topScores.map((s) => (
                <tr key={s.symbol} className="border-t">
                  <td className="p-2 font-medium">{s.symbol}</td>
                  <td className="p-2">{s.bucket}</td>
                  <td className="p-2">{s.finalGenesisScore.toFixed(1)}</td>
                  <td className="p-2">{s.confidenceScore.toFixed(1)}</td>
                  <td className="p-2">{s.provider ?? "-"}</td>
                  <td className="p-2"><Badge variant="outline">{s.recommendation}</Badge></td>
                </tr>
              ))}
              {!topScores.length && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">{t("شغّل دورة AI لعرض التصنيف.", "Run an AI cycle to populate rankings.")}</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("التخصيص المقترح", "Proposed Allocation")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {topAllocations.map((a) => (
              <div key={a.symbol} className="space-y-1">
                <div className="flex justify-between text-sm"><span>{a.symbol}</span><span>{pct(a.targetWeight)} / {money(a.targetValue)}</span></div>
                <Progress value={a.targetWeight * 100} />
              </div>
            ))}
            {!topAllocations.length && <p className="text-sm text-muted-foreground">{t("لا يوجد تخصيص بعد.", "No allocation yet.")}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("آخر قرارات AI", "Latest AI Decisions")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {decisions.slice(0, 8).map((d) => (
              <div key={`${d.timestamp}-${d.symbol}`} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between"><span className="font-medium">{d.symbol}</span><Badge variant="outline">{d.executionMode}</Badge></div>
                <p className="mt-1 text-muted-foreground">{d.action}: {d.reason}</p>
              </div>
            ))}
            {!decisions.length && <p className="text-sm text-muted-foreground">{t("لا توجد قرارات بعد.", "No decisions yet.")}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("تقارير Genesis 100", "Genesis 100 Reports")}</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {periods.map((p) => (
            <Button key={p} variant="outline" size="sm" asChild>
              <a href={`/api/public/genesis100/report?period=${p}`} target="_blank" rel="noreferrer">
                <Download className="mr-2 h-3 w-3" />{p}
              </a>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
