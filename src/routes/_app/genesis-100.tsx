import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  Download,
  Loader2,
  Play,
  ShieldCheck,
  Wallet,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Shield,
  Archive,
  Activity,
  Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/genesis-100")({
  component: Genesis100Page,
  head: () => ({
    meta: [
      { title: "ForeSmart Genesis 100" },
      {
        name: "description",
        content:
          "AI-managed global multi-asset portfolio analysis, paper trading, allocation, risk, and reporting.",
      },
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
  recommendation: string;
  primaryReason?: string;
  supportingReasons?: string[];
  riskWarnings?: string[];
  aiDecisionSummaryEn?: string;
  aiDecisionSummaryAr?: string;
  provider: string | null;
  price: number | null;
  quoteSuccess?: boolean;
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
  riskWarnings: string[];
  proposedOrders: unknown[];
  paperOrders: unknown[];
  realOrders: unknown[];
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
  reasonAr?: string;
  riskWarnings: string[];
}

interface IntelligenceApi {
  status: string;
  gdeltActive: boolean;
  newsCount: number;
  averageSentiment: number;
  topHeadlines: Array<{
    title: string;
    sentiment: number;
    source: string;
    category: string;
  }>;
}

const periods = ["hourly", "daily", "weekly", "monthly", "quarterly", "semiannual", "annual"];

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path} failed with ${res.status}`);
  return res.json() as Promise<T>;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function money(v: number): string {
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

const REC_AR: Record<string, string> = {
  strong_buy: "شراء قوي", buy: "شراء", accumulate: "تجميع", hold: "احتفاظ",
  reduce: "تخفيض", exit: "خروج", watch: "مراقبة", blocked: "محجوب",
  increase: "زيادة", decrease: "تخفيض",
};

const BUCKET_AR: Record<string, string> = {
  us_stock: "أسهم أمريكية", saudi_stock: "أسهم سعودية", etf: "صناديق مؤشرات",
  commodity: "سلع", forex: "عملات", crypto: "عملات رقمية", macro: "اقتصاد كلي",
};

const AI_MODE_AR: Record<string, string> = { off: "إيقاف", semi_ai: "شبه ذكي", full_ai: "ذكاء كامل" };
const REGIME_AR: Record<string, string> = { risk_on: "إقبال على المخاطر", risk_off: "تجنب المخاطر", mixed: "مختلط", defensive: "دفاعي" };
const RISK_AR: Record<string, string> = { low: "منخفض", medium: "متوسط", high: "مرتفع" };
const URGENCY_AR: Record<string, string> = { low: "منخفضة", medium: "متوسطة", high: "عالية", emergency: "طارئة" };

function recBadgeColor(rec: string): string {
  if (rec === "strong_buy" || rec === "buy" || rec === "increase") return "border-emerald-500/50 bg-emerald-500/10 text-emerald-400";
  if (rec === "accumulate") return "border-green-500/40 bg-green-500/10 text-green-400";
  if (rec === "hold") return "border-amber-500/40 bg-amber-500/10 text-amber-400";
  if (rec === "reduce" || rec === "decrease") return "border-orange-500/40 bg-orange-500/10 text-orange-400";
  if (rec === "exit") return "border-rose-500/40 bg-rose-500/10 text-rose-400";
  if (rec === "watch") return "border-sky-500/40 bg-sky-500/10 text-sky-400";
  if (rec === "blocked") return "border-red-600/40 bg-red-600/10 text-red-400";
  return "border-zinc-500/40 bg-zinc-500/10 text-zinc-400";
}

function GoldDivider() {
  return <div className="mx-auto my-1 h-px w-full bg-gradient-to-l from-transparent via-amber-500/40 to-transparent" />;
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <Card className="border-amber-500/10 bg-gradient-to-br from-zinc-900/80 to-zinc-950/90">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
          <Icon className="h-5 w-5 text-amber-500" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-zinc-500">{label}</p>
          <p className="text-xl font-bold text-zinc-100">{value}</p>
          {sub && <p className="text-[11px] text-zinc-500">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Activity className="h-8 w-8 text-zinc-600" />
      <p className="text-sm text-zinc-500">{text}</p>
    </div>
  );
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
  const [, setNotifications] = useState<NotificationsApi | null>(null);
  const [portfolioDecision, setPortfolioDecision] = useState<PortfolioDecisionApi | null>(null);
  const [archive, setArchive] = useState<ArchiveDecisionApi[]>([]);
  const [riskWarnings, setRiskWarnings] = useState<string[]>([]);
  const [intelligence, setIntelligence] = useState<IntelligenceApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedScores = useMemo(() => [...scores].sort((a, b) => (b.decisionConfidencePercent ?? b.confidenceScore) - (a.decisionConfidencePercent ?? a.confidenceScore)), [scores]);
  const topScores = useMemo(() => sortedScores.slice(0, 15), [sortedScores]);
  const topAllocations = useMemo(() => allocations.slice(0, 12), [allocations]);

  const dataWarnings = useMemo(() => {
    const missing = scores.filter((s) => !s.quoteSuccess && !s.provider);
    if (missing.length === 0) return [];
    return [
      t(`${missing.length} أصل بدون بيانات سعرية مباشرة`, `${missing.length} assets without live price data`),
      ...missing.slice(0, 5).map((s) => t(`${s.symbol} — مزود البيانات غير متصل`, `${s.symbol} — data provider unavailable`)),
      ...(missing.length > 5 ? [t(`و ${missing.length - 5} أصول أخرى...`, `and ${missing.length - 5} more...`)] : []),
    ];
  }, [scores, ar]);

  const load = async () => {
    setError(null);
    const [s, a, d, c, n, archiveRes] = await Promise.all([
      getJson<StatusApi>("/api/public/genesis100/status"),
      getJson<{ allocations: AllocationApi[] }>("/api/public/genesis100/allocations"),
      getJson<{ decisions: DecisionApi[] }>("/api/public/genesis100/decisions"),
      getJson<ControlsApi>("/api/public/genesis100/controls"),
      getJson<NotificationsApi>("/api/public/genesis100/notifications"),
      getJson<{ archive: ArchiveDecisionApi[] }>("/api/public/genesis100/archive"),
    ]);
    setStatus(s);
    setAllocations(a.allocations ?? []);
    setDecisions(d.decisions ?? []);
    setControls(c);
    setNotifications(n);
    setArchive(archiveRes.archive ?? []);

    try {
      const intel = await getJson<IntelligenceApi>("/api/public/genesis100/intelligence");
      setIntelligence(intel);
    } catch { /* intelligence endpoint may not exist yet */ }
  };

  useEffect(() => {
    load()
      .catch(() => setError(t("تعذر تحميل بيانات Genesis 100. يرجى المحاولة لاحقاً.", "Failed to load Genesis 100 data. Please try again later.")))
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
      setPortfolioDecision(cycle.portfolioDecision ?? null);
      setArchive(cycle.topDecisions ?? []);
      setRiskWarnings(cycle.riskWarnings ?? []);
      await load();
    } catch {
      setError(t("فشل تشغيل الدورة. يرجى المحاولة لاحقاً.", "Cycle failed. Please try again later."));
    } finally {
      setRunning(false);
    }
  };

  const setAIMode = async (aiMode: ControlsApi["aiMode"]) => {
    setError(null);
    try {
      const next = await getJson<ControlsApi>("/api/public/genesis100/controls", { method: "POST", body: JSON.stringify({ aiMode }) });
      setControls(next);
      await load();
    } catch {
      setError(t("تعذر تحديث وضع الذكاء الاصطناعي.", "Failed to update AI mode."));
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-zinc-500">{t("جاري تحميل Genesis 100...", "Loading Genesis 100...")}</p>
        </div>
      </div>
    );
  }

  const aiMode = controls?.aiMode ?? status?.aiMode ?? "semi_ai";
  const cashBalance = status?.wallet.cashBalance ?? 0;
  const investedBalance = status?.wallet.investedBalance ?? 0;
  const capital = status?.wallet.capital ?? 1;
  const reserveBalance = Math.max(0, capital * 0.05);
  const cashPct = (cashBalance / Math.max(1, capital)) * 100;
  const investedPct = (investedBalance / Math.max(1, capital)) * 100;
  const reservePct = (reserveBalance / Math.max(1, capital)) * 100;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10">
              <Brain className="h-5 w-5 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100">ForeSmart Genesis 100</h1>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="outline" className="border-amber-500/30 text-amber-400">{t("تداول تجريبي فقط", "Paper trading only")}</Badge>
            <Badge variant="outline" className="border-rose-500/30 text-rose-400">{t("التحويلات الخارجية ممنوعة", "External transfers forbidden")}</Badge>
            <Badge variant="outline" className="border-zinc-600 text-zinc-400">{t("يتطلب اشتراك Pro", "Pro plan required")}</Badge>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            {t("محفظة عالمية مدارة بالذكاء الاصطناعي للتحليل والتخصيص والتداول التجريبي. التنفيذ الحقيقي معطل والسحب يدوي فقط.", "AI-managed global multi-asset portfolio for analysis, allocation, and paper trading. Live execution is disabled, manual withdrawal only.")}
          </p>
        </div>
        <Button onClick={runCycle} disabled={running} className="bg-gradient-to-l from-amber-600 to-amber-500 text-zinc-950 hover:from-amber-500 hover:to-amber-400">
          {running ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Play className="ml-2 h-4 w-4" />}
          {t("تشغيل دورة AI", "Run AI Cycle")}
        </Button>
      </div>

      {error && (
        <Card className="border-rose-500/30 bg-rose-950/20">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-rose-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      <GoldDivider />

      {/* Top Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Brain} label={t("وضع الذكاء", "AI Mode")} value={ar ? (AI_MODE_AR[aiMode] ?? aiMode) : aiMode} sub={t("التنفيذ الحقيقي محظور", "Live execution blocked")} />
        <StatCard icon={Wallet} label={t("رأس المال", "Capital")} value={money(capital)} sub={t("محفظة معزولة", "Isolated wallet")} />
        <StatCard icon={TrendingUp} label={t("الهدف الشهري", "Monthly Target")} value={pct(status?.wallet.targetMonthlyReturn ?? 0)} />
        <StatCard icon={ShieldCheck} label={t("ملف المخاطر", "Risk Profile")} value={ar ? (RISK_AR[status?.wallet.riskProfile ?? "balanced"] ?? "متوازن") : (status?.wallet.riskProfile ?? "balanced")} sub={t(`الحد الأقصى للسحب: ${pct(status?.wallet.maxDrawdown ?? 0.12)}`, `Max drawdown: ${pct(status?.wallet.maxDrawdown ?? 0.12)}`)} />
      </div>

      {/* AI Controls */}
      <Card className="border-amber-500/10 bg-zinc-900/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-400"><Brain className="h-4 w-4" />{t("تحكم الذكاء الاصطناعي", "AI Controls")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["off", "semi_ai", "full_ai"] as const).map((mode) => (
              <Button key={mode} variant={aiMode === mode ? "default" : "outline"} className={aiMode === mode ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30" : "border-zinc-700 text-zinc-400 hover:border-zinc-600"} onClick={() => setAIMode(mode)}>
                {ar ? (AI_MODE_AR[mode] ?? mode) : mode === "off" ? "AI Off" : mode === "semi_ai" ? "Semi AI" : "Full AI"}
              </Button>
            ))}
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-xs text-zinc-500">{t("حالة الخطة", "Plan Status")}</p>
              <p className="font-medium text-zinc-300">{(controls?.planActive ?? status?.planActive) ? t("Pro مفعل", "Pro active") : t("مطلوب اشتراك Pro", "Genesis 100 requires Pro plan")}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-xs text-zinc-500">{t("التحويلات الخارجية", "External Transfers")}</p>
              <p className="font-medium text-rose-400">{t("ممنوعة — السحب يدوي فقط", "Forbidden — manual withdrawal only")}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-xs text-zinc-500">{t("التنفيذ الحي", "Live Execution")}</p>
              <p className="font-medium text-amber-400">{t("معطل", "Disabled")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Capital Allocation */}
      <Card className="border-amber-500/10 bg-zinc-900/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-400"><Wallet className="h-4 w-4" />{t("تخصيص رأس المال", "Capital Allocation")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: t("نقد", "Cash"), value: cashBalance, pctVal: cashPct, color: "from-emerald-500 to-emerald-600" },
            { label: t("مستثمر", "Invested"), value: investedBalance, pctVal: investedPct, color: "from-amber-500 to-amber-600" },
            { label: t("احتياطي", "Reserve"), value: reserveBalance, pctVal: reservePct, color: "from-sky-500 to-sky-600" },
          ].map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-zinc-400">{item.label}</span>
                <span className="font-medium text-zinc-200">{money(item.value)} <span className="text-xs text-zinc-500">({item.pctVal.toFixed(1)}%)</span></span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
                <div className={`h-full rounded-full bg-gradient-to-l ${item.color}`} style={{ width: `${Math.min(100, item.pctVal)}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Intelligence Summary */}
      <Card className="border-amber-500/10 bg-zinc-900/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-400"><BarChart3 className="h-4 w-4" />{t("ملخص الذكاء الاستثماري", "Investment Intelligence Summary")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-xs text-zinc-500">{t("نظام السوق", "Market Regime")}</p>
              <p className="text-lg font-semibold text-zinc-200">{ar ? (REGIME_AR[portfolioDecision?.marketRegime ?? ""] ?? t("في الانتظار", "Pending")) : (portfolioDecision?.marketRegime ?? "Pending")}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-xs text-zinc-500">{t("مخاطر المحفظة", "Portfolio Risk")}</p>
              <p className="text-lg font-semibold text-zinc-200">{ar ? (RISK_AR[portfolioDecision?.portfolioRiskLevel ?? ""] ?? t("في الانتظار", "Pending")) : (portfolioDecision?.portfolioRiskLevel ?? "Pending")}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-xs text-zinc-500">{t("احتياطي نقد مقترح", "Recommended Cash Reserve")}</p>
              <p className="text-lg font-semibold text-zinc-200">{pct(portfolioDecision?.recommendedCashReserve ?? 0.05)}</p>
            </div>
          </div>
          {portfolioDecision ? (
            <div className="rounded-lg border border-amber-500/10 bg-amber-500/5 p-4 text-sm text-zinc-300">
              {ar ? portfolioDecision.aiPortfolioSummaryAr : portfolioDecision.aiPortfolioSummaryEn}
            </div>
          ) : (
            <EmptyState text={t("شغّل دورة AI لإنشاء ملخص الذكاء الاستثماري.", "Run an AI cycle to generate the intelligence summary.")} />
          )}
        </CardContent>
      </Card>

      {/* Decision Credibility */}
      {scores.length > 0 && (
        <Card className="border-amber-500/10 bg-zinc-900/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-400"><Shield className="h-4 w-4" />{t("مصداقية القرار", "Decision Credibility")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {(() => {
                const highConf = scores.filter((s) => (s.decisionConfidencePercent ?? s.confidenceScore) >= 70);
                const medConf = scores.filter((s) => (s.decisionConfidencePercent ?? s.confidenceScore) >= 40 && (s.decisionConfidencePercent ?? s.confidenceScore) < 70);
                const lowConf = scores.filter((s) => (s.decisionConfidencePercent ?? s.confidenceScore) < 40);
                return (
                  <>
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-400">{highConf.length}</p>
                      <p className="text-xs text-zinc-500">{t("ثقة عالية (≥70%)", "High confidence (≥70%)")}</p>
                    </div>
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-center">
                      <p className="text-2xl font-bold text-amber-400">{medConf.length}</p>
                      <p className="text-xs text-zinc-500">{t("ثقة متوسطة (40-70%)", "Medium confidence (40-70%)")}</p>
                    </div>
                    <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-center">
                      <p className="text-2xl font-bold text-rose-400">{lowConf.length}</p>
                      <p className="text-xs text-zinc-500">{t("ثقة منخفضة (<40%)", "Low confidence (<40%)")}</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Investment Size by Confidence */}
      {topAllocations.length > 0 && (
        <Card className="border-amber-500/10 bg-zinc-900/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-400"><TrendingUp className="h-4 w-4" />{t("حجم الاستثمار حسب الثقة", "Investment Size by Confidence")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topAllocations.map((a) => (
              <div key={a.symbol} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-300">{a.symbol} <span className="text-xs text-zinc-500">{ar ? (REC_AR[a.action ?? "hold"] ?? a.action) : (a.action ?? "hold")}</span></span>
                  <span className="text-zinc-400">{pct(a.targetWeight)} / {money(a.targetValue)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-gradient-to-l from-amber-500/80 to-amber-600/60" style={{ width: `${Math.min(100, a.targetWeight * 100 * 12)}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-zinc-600">
                  <span>{t("ثقة", "Conf.")} {a.allocationConfidencePercent?.toFixed(1) ?? "-"}%</span>
                  <span>{t("مخاطر", "Risk")} {a.riskPercent?.toFixed(1) ?? "-"}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Data Warnings */}
      {dataWarnings.length > 0 && (
        <Card className="border-amber-700/20 bg-amber-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-amber-400"><AlertTriangle className="h-4 w-4" />{t("تنبيهات البيانات", "Data Alerts")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {dataWarnings.map((w, i) => (<p key={i} className="text-sm text-zinc-400">• {w}</p>))}
          </CardContent>
        </Card>
      )}

      {/* Asset Decision Table */}
      <Card className="border-amber-500/10 bg-zinc-900/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-400"><BarChart3 className="h-4 w-4" />{t("تفاصيل قرارات الأصول", "Asset Decision Details")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm" dir={ar ? "rtl" : "ltr"}>
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="p-2 text-start">{t("الرمز", "Symbol")}</th>
                <th className="p-2 text-start">{t("الفئة", "Category")}</th>
                <th className="p-2 text-start">{t("التقييم", "Score")}</th>
                <th className="p-2 text-start">{t("الثقة", "Confidence")}</th>
                <th className="p-2 text-start">{t("المزود", "Provider")}</th>
                <th className="p-2 text-start">{t("التوصية", "Recommendation")}</th>
              </tr>
            </thead>
            <tbody>
              {topScores.map((s) => (
                <tr key={s.symbol} className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30">
                  <td className="p-2 font-medium text-zinc-200">{s.symbol}</td>
                  <td className="p-2 text-zinc-400">{ar ? (BUCKET_AR[s.bucket] ?? s.bucket) : s.bucket}</td>
                  <td className="p-2 text-zinc-300">{(s.finalDecisionScore ?? s.finalGenesisScore).toFixed(1)}</td>
                  <td className="p-2 text-zinc-300">{(s.decisionConfidencePercent ?? s.confidenceScore).toFixed(1)}%</td>
                  <td className="p-2 text-zinc-500">{s.provider ?? t("غير متصل", "N/A")}</td>
                  <td className="p-2"><Badge variant="outline" className={recBadgeColor(s.recommendation)}>{ar ? (REC_AR[s.recommendation] ?? s.recommendation) : s.recommendation}</Badge></td>
                </tr>
              ))}
              {!topScores.length && <tr><td colSpan={6} className="p-6 text-center text-zinc-500">{t("شغّل دورة AI لعرض تحليل الأصول.", "Run an AI cycle to populate asset analysis.")}</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Decision Firewall */}
      <Card className="border-amber-500/10 bg-zinc-900/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-400"><Shield className="h-4 w-4" />{t("جدار حماية القرار", "Decision Firewall")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(riskWarnings.length ? riskWarnings : status?.safeguards ?? []).slice(0, 8).map((w, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2.5">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500/60" />
              <span className="text-zinc-400">{w}</span>
            </div>
          ))}
          {!riskWarnings.length && !(status?.safeguards ?? []).length && (
            <EmptyState text={t("لا توجد تحذيرات أمان حالياً.", "No safety warnings at this time.")} />
          )}
        </CardContent>
      </Card>

      {/* Latest AI Decisions + Top Decisions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-amber-500/10 bg-zinc-900/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-400"><Activity className="h-4 w-4" />{t("آخر قرارات AI", "Latest AI Decisions")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {decisions.slice(0, 8).map((d) => (
              <div key={`${d.timestamp}-${d.symbol}`} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-200">{d.symbol}</span>
                  <Badge variant="outline" className="border-zinc-700 text-zinc-400">{ar ? (REC_AR[d.executionMode] ?? d.executionMode) : d.executionMode}</Badge>
                </div>
                <p className="mt-1 text-zinc-500">{ar ? (REC_AR[d.action] ?? d.action) : d.action}: {d.reason}</p>
              </div>
            ))}
            {!decisions.length && <EmptyState text={t("لا توجد قرارات بعد.", "No decisions yet.")} />}
          </CardContent>
        </Card>

        <Card className="border-amber-500/10 bg-zinc-900/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-400"><Eye className="h-4 w-4" />{t("أهم قرارات AI", "Top AI Decisions")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {archive.slice(0, 6).map((d) => (
              <div key={d.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-200">{d.symbol} · <span className="text-zinc-400">{ar ? (REC_AR[d.newRecommendation] ?? d.newRecommendation) : d.newRecommendation}</span></span>
                  <Badge variant="outline" className="border-amber-500/30 text-amber-400">{d.decisionConfidencePercent.toFixed(1)}%</Badge>
                </div>
                <p className="mt-1 text-zinc-500">{ar ? (d.reasonAr ?? d.reasonEn) : d.reasonEn}</p>
              </div>
            ))}
            {!archive.length && <EmptyState text={t("لا يوجد أرشيف قرارات بعد.", "No decision archive yet.")} />}
          </CardContent>
        </Card>
      </div>

      {/* Decision Archive */}
      <Card className="border-amber-500/10 bg-zinc-900/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-400"><Archive className="h-4 w-4" />{t("أرشيف القرارات", "Decision Archive")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400 hover:border-amber-500/40 hover:text-amber-400" asChild><a href="/api/public/genesis100/archive" target="_blank" rel="noreferrer">{t("الأرشيف الكامل", "Full Archive")}</a></Button>
            <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400 hover:border-amber-500/40 hover:text-amber-400" asChild><a href="/api/public/genesis100/archive/latest" target="_blank" rel="noreferrer">{t("آخر قرار", "Latest")}</a></Button>
            <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400 hover:border-amber-500/40 hover:text-amber-400" asChild><a href="/api/public/genesis100/archive/summary" target="_blank" rel="noreferrer">{t("ملخص", "Summary")}</a></Button>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-zinc-500">
            {t("كل قرار يحتوي على النسبة المئوية للثقة، السبب، المخاطر، ولقطة السعر.", "Each decision stores confidence %, reason, risks, and quote snapshot.")}
          </div>
        </CardContent>
      </Card>

      {/* News Intelligence */}
      {intelligence && intelligence.gdeltActive && (
        <Card className="border-amber-500/10 bg-zinc-900/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-400">
              <Activity className="h-4 w-4" />{t("ذكاء الأخبار المباشر", "Live News Intelligence")}
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">GDELT</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                <p className="text-xs text-zinc-500">{t("عدد الأخبار", "News Count")}</p>
                <p className="text-lg font-semibold text-zinc-200">{intelligence.newsCount}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                <p className="text-xs text-zinc-500">{t("متوسط المعنويات", "Avg Sentiment")}</p>
                <p className="text-lg font-semibold text-zinc-200">{intelligence.averageSentiment.toFixed(2)}</p>
              </div>
            </div>
            {intelligence.topHeadlines?.slice(0, 4).map((h, i) => (
              <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-2.5 text-sm">
                <p className="text-zinc-300">{h.title}</p>
                <p className="mt-1 text-xs text-zinc-500">{h.source} · {h.category} · {t("معنويات", "sentiment")}: {h.sentiment.toFixed(2)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Reports */}
      <Card className="border-amber-500/10 bg-zinc-900/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-400"><Download className="h-4 w-4" />{t("تقارير Genesis 100", "Genesis 100 Reports")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {periods.map((p) => (
            <Button key={p} variant="outline" size="sm" className="border-zinc-700 text-zinc-400 hover:border-amber-500/40 hover:text-amber-400" asChild>
              <a href={`/api/public/genesis100/report?period=${p}`} target="_blank" rel="noreferrer"><Download className="ml-1 h-3 w-3" />{p}</a>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
