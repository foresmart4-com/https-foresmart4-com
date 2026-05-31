import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Brain, Download, Loader2, Play, ShieldCheck, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/genesis-100")({
  component: () => <ErrorBoundary fallbackTitle="تعذر تحميل الصفحة"><Genesis100Page /></ErrorBoundary>,
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
  finalDecisionScore?: number;
  confidenceScore: number;
  decisionConfidencePercent?: number;
  decisionStrengthPercent?: number;
  expectedUpsidePercent?: number | null;
  expectedDownsidePercent?: number | null;
  riskPercent?: number;
  decisionCredibilityPercent?: number;
  stopLossUrgency?: string;
  recommendation: string;
  primaryReason?: string;
  supportingReasons?: string[];
  riskWarnings?: string[];
  aiDecisionSummaryEn?: string;
  provider: string | null;
  price: number | null;
  // Phase A — Gemini intelligence
  arabicReasoning?: string;
  geminiAnalysisUsed?: boolean;
  schoolsBreakdown?: {
    keynesian: number;
    monetarist: number;
    austrian: number;
    behavioral: number;
    valueinvesting: number;
    globalMacro: number;
  } | null;
}

interface PositionMonitorResult {
  orderId: string;
  symbol: string;
  action: string;
  currentPrice: number | null;
  entryPrice: number;
  pnlPercent: number;
  pnlAmount: number;
  stopLossPrice: number;
  takeProfitStage1: number;
  takeProfitStage2: number;
  takeProfitStage3: number;
  daysHeld: number;
  maxHoldingDays: number;
  riskRewardRatio: number;
  arabicAction: string;
  alertLevel: "critical" | "warning" | "info" | "ok";
}

interface AllocationApi {
  symbol: string;
  name: string;
  bucket: string;
  targetWeight: number;
  targetValue: number;
  finalGenesisScore: number;
  allocationConfidencePercent?: number;
  decisionConfidencePercent?: number;
  riskPercent?: number;
  action?: string;
  reason?: string;
  decisionCredibilityPercent?: number;
  credibilityTier?: string;
  allocationMultiplier?: number;
  riskMode?: string;
  maxSingleDecisionCapitalPercent?: number;
  allowedCapitalForDecision?: number;
  stopLossUrgency?: string;
  actionAllowed?: boolean;
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
  portfolioDecision?: PortfolioDecisionApi;
  topDecisions?: ArchiveDecisionApi[];
  decisionArchiveCount?: number;
  positionSizingSummary?: PositionSizingSummaryApi;
  capitalByCredibilityTier?: Record<string, number>;
  blockedLowCredibilityCapital?: number;
  topHighConfidenceAllocations?: AllocationApi[];
  topLowConfidenceWatchlist?: ScoreApi[];
  riskWarnings: string[];
  proposedOrders: unknown[];
  paperOrders: unknown[];
  realOrders: unknown[];
}

interface PositionSizingSummaryApi {
  totalAllowedCapital: number;
  blockedLowCredibilityCapital: number;
  capitalByCredibilityTier: Record<string, number>;
  averageDecisionCredibilityPercent: number;
  highConfidenceCount: number;
  blockedCount: number;
}

interface PortfolioDecisionApi {
  marketRegime: string;
  portfolioRiskLevel: string;
  recommendedCashReserve: number;
  topOpportunities: string[];
  topRisks: string[];
  assetsToIncrease: string[];
  assetsToReduce: string[];
  assetsToRemove: string[];
  assetsToWatch: string[];
  rebalanceUrgency: string;
  nextReviewAt: string;
  aiPortfolioSummaryAr: string;
  aiPortfolioSummaryEn: string;
}

interface ArchiveDecisionApi {
  id: string;
  timestamp: string;
  cycleId: string;
  symbol: string;
  assetName: string;
  newRecommendation: string;
  decisionConfidencePercent: number;
  finalDecisionScore: number;
  targetWeight: number;
  previousWeight: number;
  action: string;
  reasonEn: string;
  riskWarnings: string[];
}

interface IntelligenceApi {
  intelligenceVersion: string;
  marketRegime: string;
  overallMarketSentiment: number;
  riskOnRiskOff: string;
  confidencePercent: number;
  sourceStatus: string;
  enabledSourceCategories: string[];
  aiPortfolioSummaryAr: string;
  aiPortfolioSummaryEn: string;
}

interface FirewallApi {
  minimumDecisionCredibilityPercent: number;
  approvedDecisionCount: number;
  blockedDecisionCount: number;
  blockedDecisions: Array<{ symbol: string; decisionCredibilityPercent: number; blockedReason: string | null }>;
}

interface SourceRegistryApi {
  sourceStatus: string;
  enabledSourceCategories: string[];
}

interface DebateApi {
  agents: Array<{
    agentId: string;
    stance: string;
    confidencePercent: number;
    reasoningAr: string;
    riskScore: number;
    warnings: string[];
  }>;
}

interface ConsensusApi {
  consensus: {
    consensusVersion: string;
    confidenceConsensus: number;
    agreementPercent: number;
    dominantView: string;
    decisionBias: string;
    finalConsensusAr: string;
    riskConsensus: number;
  };
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
  const [portfolioDecision, setPortfolioDecision] = useState<PortfolioDecisionApi | null>(null);
  const [positionSizingSummary, setPositionSizingSummary] = useState<PositionSizingSummaryApi | null>(null);
  const [archive, setArchive] = useState<ArchiveDecisionApi[]>([]);
  const [intelligence, setIntelligence] = useState<IntelligenceApi | null>(null);
  const [firewall, setFirewall] = useState<FirewallApi | null>(null);
  const [sourceRegistry, setSourceRegistry] = useState<SourceRegistryApi | null>(null);
  const [debate, setDebate] = useState<DebateApi | null>(null);
  const [consensus, setConsensus] = useState<ConsensusApi | null>(null);
  const [riskWarnings, setRiskWarnings] = useState<string[]>([]);
  const [positionMonitor, setPositionMonitor] = useState<PositionMonitorResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topScores = useMemo(() => scores.slice(0, 10), [scores]);
  const topAllocations = useMemo(() => allocations.slice(0, 12), [allocations]);

  const load = async () => {
    setError(null);
    const [s, a, d, c, n, ar, intel, fw, sr, db, cs, pm] = await Promise.all([
      getJson<StatusApi>("/api/public/genesis100/status").catch(() => null),
      getJson<{ allocations: AllocationApi[] }>("/api/public/genesis100/allocations").catch(() => ({ allocations: [] })),
      getJson<{ decisions: DecisionApi[] }>("/api/public/genesis100/decisions").catch(() => ({ decisions: [] })),
      getJson<ControlsApi>("/api/public/genesis100/controls").catch(() => null),
      getJson<NotificationsApi>("/api/public/genesis100/notifications").catch(() => null),
      getJson<{ archive: ArchiveDecisionApi[] }>("/api/public/genesis100/archive").catch(() => ({ archive: [] })),
      getJson<IntelligenceApi>("/api/public/genesis100/intelligence").catch(() => null),
      getJson<FirewallApi>("/api/public/genesis100/decision-firewall").catch(() => null),
      getJson<SourceRegistryApi>("/api/public/genesis100/source-registry").catch(() => null),
      getJson<DebateApi>("/api/public/genesis100/debate").catch(() => null),
      getJson<ConsensusApi>("/api/public/genesis100/consensus").catch(() => null),
      getJson<{ positions: PositionMonitorResult[] }>("/api/public/genesis100/position-monitor").catch(() => ({ positions: [] })),
    ]);
    setStatus(s);
    setAllocations(a?.allocations ?? []);
    setDecisions(d?.decisions ?? []);
    setControls(c);
    setNotifications(n);
    setArchive(ar?.archive ?? []);
    setIntelligence(intel);
    setFirewall(fw);
    setSourceRegistry(sr);
    setDebate(db);
    setConsensus(cs);
    setPositionMonitor(pm?.positions ?? []);
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
      const cycle = await getJson<CycleApi & { positionMonitor?: PositionMonitorResult[] }>("/api/public/genesis100/run-cycle", { method: "POST" });
      setScores(cycle.scores ?? []);
      setAllocations(cycle.allocations ?? []);
      setDecisions(cycle.decisions ?? []);
      setPortfolioDecision(cycle.portfolioDecision ?? null);
      setPositionSizingSummary(cycle.positionSizingSummary ?? null);
      setArchive(cycle.topDecisions ?? []);
      setRiskWarnings(cycle.riskWarnings ?? []);
      if (cycle.positionMonitor) setPositionMonitor(cycle.positionMonitor);
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
        <CardHeader><CardTitle>{t("ملخص ذكاء AI", "AI Intelligence Summary")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-md border p-3">
            <div className="font-medium">{t("نظام السوق", "Market Regime")}</div>
            <div className="text-muted-foreground">{intelligence?.marketRegime ?? portfolioDecision?.marketRegime ?? "pending"}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="font-medium">{t("معنويات السوق", "Market Sentiment")}</div>
            <div className="text-muted-foreground">{intelligence?.overallMarketSentiment?.toFixed(1) ?? "-"} / {intelligence?.riskOnRiskOff ?? "neutral"}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="font-medium">{t("ثقة الذكاء", "AI Confidence")}</div>
            <div className="text-muted-foreground">{intelligence?.confidencePercent?.toFixed(1) ?? "-"}%</div>
          </div>
          <div className="rounded-md bg-muted p-3 md:col-span-3">
            {ar ? intelligence?.aiPortfolioSummaryAr ?? portfolioDecision?.aiPortfolioSummaryAr : intelligence?.aiPortfolioSummaryEn ?? portfolioDecision?.aiPortfolioSummaryEn ?? t("شغّل دورة AI لإنشاء ملخص الذكاء.", "Run an AI cycle to generate the intelligence summary.")}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("جدار قرارات AI", "Decision Firewall")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid gap-2 md:grid-cols-3">
              <div className="rounded-md border p-2">Min: {firewall?.minimumDecisionCredibilityPercent ?? 51}%</div>
              <div className="rounded-md border p-2">Approved: {firewall?.approvedDecisionCount ?? 0}</div>
              <div className="rounded-md border p-2">Blocked: {firewall?.blockedDecisionCount ?? 0}</div>
            </div>
            {(firewall?.blockedDecisions ?? []).slice(0, 4).map((b) => (
              <div key={b.symbol} className="rounded-md bg-muted p-2 text-muted-foreground">
                {b.symbol}: {b.decisionCredibilityPercent}% - {b.blockedReason}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("سجل مصادر البيانات", "Source Registry")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Badge variant="outline">{sourceRegistry?.sourceStatus ?? "framework_ready_provider_missing"}</Badge>
            <div className="flex flex-wrap gap-2">
              {(sourceRegistry?.enabledSourceCategories ?? []).slice(0, 8).map((c) => (
                <Badge key={c} variant="outline">{c}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("مناظرة الذكاء الاصطناعي", "AI Debate")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(debate?.agents ?? []).slice(0, 8).map((agent) => (
              <div key={agent.agentId} className="rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{agent.agentId}</span>
                  <Badge variant="outline">{agent.stance} · {agent.confidencePercent}%</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{agent.reasoningAr}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("إجماع الوكلاء", "Consensus %")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-md bg-muted p-3">
              {consensus?.consensus.finalConsensusAr ?? t("لا يوجد إجماع بعد.", "No consensus yet.")}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border p-2">{t("الاتفاق", "Agreement")}: {consensus?.consensus.agreementPercent ?? 0}%</div>
              <div className="rounded-md border p-2">{t("المخاطر", "Risk Debate")}: {consensus?.consensus.riskConsensus ?? 0}%</div>
              <div className="rounded-md border p-2">{t("الرأي الغالب", "Dominant")}: {consensus?.consensus.dominantView ?? "-"}</div>
              <div className="rounded-md border p-2">{t("التحيز", "Bias")}: {consensus?.consensus.decisionBias ?? "watch"}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("حجم المراكز حسب الثقة", "Position Sizing by Confidence")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm md:grid-cols-4">
            <div className="rounded-md border p-3">
              <div className="font-medium">{t("متوسط المصداقية", "Average Credibility")}</div>
              <div className="text-muted-foreground">{positionSizingSummary?.averageDecisionCredibilityPercent?.toFixed(1) ?? "-"}%</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="font-medium">{t("عالي الثقة", "High Confidence")}</div>
              <div className="text-muted-foreground">{positionSizingSummary?.highConfidenceCount ?? 0}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="font-medium">{t("محظور لقلة المصداقية", "Blocked Low Credibility")}</div>
              <div className="text-muted-foreground">{positionSizingSummary?.blockedCount ?? 0}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="font-medium">{t("رأس مال محظور", "Blocked Capital")}</div>
              <div className="text-muted-foreground">{money(positionSizingSummary?.blockedLowCredibilityCapital ?? 0)}</div>
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">{t("رأس المال حسب طبقة المصداقية", "Capital by Credibility Tier")}</div>
            <div className="grid gap-2 text-xs md:grid-cols-4">
              {Object.entries(positionSizingSummary?.capitalByCredibilityTier ?? {}).map(([tier, value]) => (
                <div key={tier} className="rounded-md bg-muted p-2">
                  <div className="font-medium">{tier}</div>
                  <div className="text-muted-foreground">{money(Number(value))}</div>
                </div>
              ))}
              {!positionSizingSummary && <div className="text-muted-foreground">{t("شغّل دورة AI لعرض حجم المراكز.", "Run an AI cycle to populate position sizing.")}</div>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("تفاصيل قرارات الأصول", "Asset Decision Details")}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="p-2">Symbol</th>
                <th className="p-2">Bucket</th>
                <th className="p-2">Score</th>
                <th className="p-2">Credibility %</th>
                <th className="p-2">Risk %</th>
                <th className="p-2">Stop Loss</th>
                <th className="p-2">{t("تحليل AI", "AI Source")}</th>
                <th className="p-2">Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {topScores.map((s) => (
                <>
                  <tr key={s.symbol} className="border-t">
                    <td className="p-2 font-medium">{s.symbol}</td>
                    <td className="p-2">{s.bucket}</td>
                    <td className="p-2">{(s.finalDecisionScore ?? s.finalGenesisScore).toFixed(1)}</td>
                    <td className="p-2">{(s.decisionCredibilityPercent ?? s.decisionConfidencePercent ?? s.confidenceScore).toFixed(1)}%</td>
                    <td className="p-2">{(s.riskPercent ?? 0).toFixed(1)}%</td>
                    <td className="p-2">{s.stopLossUrgency ?? "-"}</td>
                    <td className="p-2">
                      {s.geminiAnalysisUsed
                        ? <Badge className="bg-primary/10 text-primary border-primary/30 text-xs">{t("تحليل ذكي", "Gemini AI")}</Badge>
                        : <Badge variant="outline" className="text-xs text-muted-foreground">{t("تحليل احترازي", "Heuristic")}</Badge>}
                    </td>
                    <td className="p-2"><Badge variant="outline">{s.recommendation}</Badge></td>
                  </tr>
                  {s.arabicReasoning && (
                    <tr key={`${s.symbol}-ar`} className="bg-muted/30">
                      <td colSpan={8} className="px-3 pb-2 text-xs text-muted-foreground" dir="rtl">
                        <span className="font-medium text-foreground">{s.symbol}: </span>{s.arabicReasoning}
                        {s.schoolsBreakdown && (
                          <span className="ml-2 text-xs opacity-70">
                            {" "}[K:{s.schoolsBreakdown.keynesian} M:{s.schoolsBreakdown.monetarist} A:{s.schoolsBreakdown.austrian} B:{s.schoolsBreakdown.behavioral} V:{s.schoolsBreakdown.valueinvesting} G:{s.schoolsBreakdown.globalMacro}]
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {!topScores.length && <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">{t("شغّل دورة AI لعرض التصنيف.", "Run an AI cycle to populate rankings.")}</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Phase C — Position Monitor Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            {t("مراقبة المراكز المفتوحة", "Open Position Monitor")}
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 text-xs">{t("محاكاة ورقية فقط", "Paper only")}</Badge>
            {positionMonitor.some(p => p.alertLevel === "critical") && (
              <Badge className="bg-destructive text-destructive-foreground text-xs animate-pulse">{t("تنبيه: وقف خسارة!", "STOP LOSS HIT")}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {positionMonitor.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("لا توجد مراكز مفتوحة. شغّل دورة AI أولاً.", "No open positions. Run an AI cycle first.")}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3" dir="rtl">محاكاة ورقية — لا تنفيذ حقيقي. هذه تنبيهات استشارية. يجب على الإنسان تأكيد أي إجراء.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="p-2">Symbol</th>
                      <th className="p-2">{t("دخول", "Entry")}</th>
                      <th className="p-2">{t("حالي", "Current")}</th>
                      <th className="p-2">PnL %</th>
                      <th className="p-2">{t("وقف الخسارة", "Stop Loss")}</th>
                      <th className="p-2">TP1</th>
                      <th className="p-2">TP2</th>
                      <th className="p-2">TP3</th>
                      <th className="p-2">{t("أيام", "Days")}</th>
                      <th className="p-2">{t("الحالة", "Status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positionMonitor.map((p) => {
                      const alertClass =
                        p.alertLevel === "critical" ? "bg-destructive/10 border-destructive/30" :
                        p.alertLevel === "warning" ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300/30" :
                        p.alertLevel === "info" ? "bg-primary/5 border-primary/20" : "";
                      return (
                        <tr key={p.orderId} className={`border-t ${alertClass}`}>
                          <td className="p-2 font-medium">{p.symbol}</td>
                          <td className="p-2">{p.entryPrice.toFixed(4)}</td>
                          <td className="p-2">{p.currentPrice?.toFixed(4) ?? "—"}</td>
                          <td className={`p-2 font-medium ${p.pnlPercent >= 0 ? "text-green-600" : "text-destructive"}`}>
                            {p.pnlPercent >= 0 ? "+" : ""}{p.pnlPercent.toFixed(2)}%
                          </td>
                          <td className="p-2 text-destructive text-xs">{p.stopLossPrice.toFixed(4)}</td>
                          <td className="p-2 text-green-600 text-xs">{p.takeProfitStage1.toFixed(4)}</td>
                          <td className="p-2 text-green-600 text-xs">{p.takeProfitStage2.toFixed(4)}</td>
                          <td className="p-2 text-green-600 text-xs">{p.takeProfitStage3.toFixed(4)}</td>
                          <td className="p-2">{p.daysHeld}/{p.maxHoldingDays}</td>
                          <td className="p-2">
                            <Badge
                              variant="outline"
                              className={
                                p.alertLevel === "critical" ? "border-destructive text-destructive" :
                                p.alertLevel === "warning" ? "border-amber-500 text-amber-700" :
                                p.alertLevel === "info" ? "border-primary text-primary" : ""
                              }
                            >
                              {p.action.replace(/_/g, " ")}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {positionMonitor.filter(p => p.alertLevel !== "ok").map(p => (
                <div key={`alert-${p.orderId}`} className="rounded-md bg-muted/50 p-2 text-xs" dir="rtl">
                  <span className="font-medium">{p.symbol}:</span> {p.arabicAction}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("التخصيص المقترح", "Proposed Allocation")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {topAllocations.map((a) => (
              <div key={a.symbol} className="space-y-1">
                <div className="flex justify-between text-sm"><span>{a.symbol} · {a.action ?? "hold"}</span><span>{pct(a.targetWeight)} / {money(a.targetValue)}</span></div>
                <Progress value={a.targetWeight * 100} />
                <div className="text-xs text-muted-foreground">
                  credibility {a.decisionCredibilityPercent?.toFixed(1) ?? "-"}% · tier {a.credibilityTier ?? "-"} · allowed {money(a.allowedCapitalForDecision ?? 0)} · stop-loss {a.stopLossUrgency ?? "-"}
                </div>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("أهم قرارات AI", "Top AI Decisions")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {archive.slice(0, 6).map((d) => (
              <div key={d.id} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{d.symbol} · {d.newRecommendation}</span>
                  <Badge variant="outline">{d.decisionConfidencePercent.toFixed(1)}%</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{d.reasonEn}</p>
              </div>
            ))}
            {!archive.length && <p className="text-sm text-muted-foreground">{t("لا يوجد أرشيف قرارات بعد.", "No decision archive yet.")}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("أرشيف القرارات", "Decision Archive")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild><a href="/api/public/genesis100/archive" target="_blank" rel="noreferrer">Archive</a></Button>
              <Button variant="outline" size="sm" asChild><a href="/api/public/genesis100/archive/latest" target="_blank" rel="noreferrer">Latest</a></Button>
              <Button variant="outline" size="sm" asChild><a href="/api/public/genesis100/archive/summary" target="_blank" rel="noreferrer">Summary</a></Button>
            </div>
            <div className="rounded-md bg-muted p-3">
              {t("كل قرار يحتوي على النسبة المئوية للثقة، السبب، المخاطر، ولقطة السعر.", "Each decision stores confidence %, reason, risks, and quote snapshot.")}
            </div>
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
