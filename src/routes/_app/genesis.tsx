import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { askGenesis, type GenesisReply, type GenesisSuggestedAction } from "@/lib/genesis.functions";
import { createAlert } from "@/lib/alerts.functions";
import { getMarketData } from "@/lib/market-data";
import { useI18n } from "@/lib/i18n";
import { addToWatchlist, useWatchlist } from "@/lib/watchlistStore";
import { memoryAgent } from "@/services/agents/memoryAgent";
import { genesisMemory } from "@/services/learning/genesisMemory";
import { aiMemory } from "@/services/learning/aiMemory";
import { clearMemory as clearSignalMemory, getMemory } from "@/services/learning/signalMemory";
import { ece, driftReport, strategyScores } from "@/services/learning/selfLearningEngine";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { DataStatusBadge } from "@/components/DataStatusBadge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Sparkles, Send, Activity, AlertTriangle, Brain, CheckCircle2,
  TrendingUp, TrendingDown, Minus, Navigation, Eye, Bell,
  ChevronRight, RefreshCw, Scale, PieChart,
  ThumbsUp, ThumbsDown, ChevronDown, Trash2, Database,
} from "lucide-react";

export const Route = createFileRoute("/_app/genesis")({
  component: GenesisPage,
  head: () => ({
    meta: [
      { title: "Genesis AI Copilot — ForeSmart" },
      { name: "description", content: "Genesis — ForeSmart's interactive AI investment copilot with scenario analysis and safe internal actions." },
    ],
  }),
});

interface Exchange {
  id: string;
  question: string;
  reply: GenesisReply;
  engine: "ai" | "heuristic";
  actionState: "pending" | "confirmed" | "dismissed" | "deferred" | null;
  feedback: "helpful" | "unhelpful" | null;
}

const CONFIDENCE_COLOR = {
  low: "text-warning",
  moderate: "text-primary",
  high: "text-success",
};

const SUGGESTED_EN = [
  "What is the market outlook for gold this quarter?",
  "Analyze the risk/reward of Bitcoin at current levels",
  "Compare gold vs Bitcoin vs S&P 500 risk-adjusted returns",
  "What macro risks should I monitor this month?",
  "Suggest a defensive portfolio strategy",
  "Summarize my portfolio's current risk profile and top exposures",
];
const SUGGESTED_AR = [
  "ما توقعات السوق للذهب هذا الربع؟",
  "حلّل مخاطر ومكافآت البيتكوين عند مستوياته الحالية",
  "قارن بين الذهب والبيتكوين وS&P 500 من حيث العوائد المعدّلة بالمخاطر",
  "ما أبرز المخاطر الكلية التي يجب مراقبتها هذا الشهر؟",
  "اقترح استراتيجية محفظة دفاعية",
  "لخّص ملف مخاطر محفظتي الحالية وأبرز التعرضات",
];

const RISK_LABEL: Record<string, { en: string; ar: string }> = {
  conservative: { en: "Conservative", ar: "محافظ" },
  balanced: { en: "Balanced", ar: "متوازن" },
  aggressive: { en: "Aggressive", ar: "عدواني" },
};

// Allowlist of internal routes Genesis may navigate to. Admin / ops routes are excluded.
const GENESIS_ALLOWED_ROUTES = new Set([
  "/alerts", "/watchlist", "/markets", "/market-intelligence", "/market-universe",
  "/portfolio-ai", "/portfolios", "/signals", "/global-intel", "/advisor",
  "/opportunity-scanner", "/scanner", "/heatmap", "/calendar",
  "/ai-dashboard", "/genesis", "/growth-plan", "/backtest-lab",
  "/stocks-portfolio", "/paper-trading",
]);

function sanitizeGenesisAction(action: GenesisSuggestedAction): GenesisSuggestedAction | null {
  const safe: GenesisSuggestedAction = { ...action };
  if (safe.route !== undefined) {
    // Strip query/hash, validate against allowlist.
    const path = safe.route.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";
    if (!GENESIS_ALLOWED_ROUTES.has(path)) return null;
    safe.route = path;
  }
  if (safe.symbol !== undefined) {
    safe.symbol = safe.symbol.trim().toUpperCase().slice(0, 20).replace(/[^A-Z0-9._-]/g, "");
    if (!safe.symbol) return null;
  }
  if (safe.price !== undefined && (typeof safe.price !== "number" || !isFinite(safe.price) || safe.price <= 0 || safe.price > 1e12)) return null;
  if (safe.condition !== undefined && safe.condition !== "above" && safe.condition !== "below") return null;
  return safe;
}

function GenesisPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const ask = useServerFn(askGenesis);
  const alertFn = useServerFn(createAlert);
  const marketFn = useServerFn(getMarketData);
  const { data: market } = useQuery({ queryKey: ["market"], queryFn: () => marketFn() });
  const { items: watchlistItems } = useWatchlist();

  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memorySummary, setMemorySummary] = useState(() => genesisMemory.summary());
  const [profileVersion, setProfileVersion] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Re-reads from localStorage whenever profileVersion bumps (e.g. style preference change).
  const profile = useMemo(() => memoryAgent.getProfile(), [profileVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const confModifier = useMemo(() => memoryAgent.confidenceModifier(), [profileVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const eceVal = ece();
  const drift = driftReport();
  const topStrategy = strategyScores()[0] ?? null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [exchanges, busy]);

  const assets = market?.assets ?? [];
  const marketContext = assets
    .slice(0, 10)
    .map((a) => `${a.symbol}: ${a.price} (${a.changePct >= 0 ? "+" : ""}${a.changePct.toFixed(2)}%)`)
    .join("\n");

  const sorted = [...assets].sort((a, b) => b.changePct - a.changePct);
  const top3 = sorted.slice(0, 3);
  const bot3 = sorted.slice(-3).reverse();
  const opportunityCtx = top3.length
    ? "Top opportunities (24h): " + top3.map((a) => `${a.symbol} ${a.changePct >= 0 ? "+" : ""}${a.changePct.toFixed(2)}%`).join(", ")
    : "";
  const riskCtx = bot3.length
    ? "Risk signals (24h worst): " + bot3.map((a) => `${a.symbol} ${a.changePct.toFixed(2)}%`).join(", ")
    : "";

  const send = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setQuestion("");
    try {
      const p = memoryAgent.getProfile();
      const memCtx = [
        `User risk profile: ${p.riskAppetite}`,
        p.preferredAssets.length ? `Preferred assets: ${p.preferredAssets.slice(0, 5).join(", ")}` : "",
        p.interactions > 0 ? `Total interactions: ${p.interactions}` : "",
        p.responseStyle ? `Response style preference: ${p.responseStyle} — ${p.responseStyle === "brief" ? "keep answers concise" : "provide detailed explanations"}` : "",
        p.preferredMarkets?.length ? `Preferred markets: ${p.preferredMarkets.join(", ")}` : "",
      ].filter(Boolean).join(" | ");

      const decisionCtx = [
        `System calibration: ECE=${eceVal.toFixed(3)}${drift.isDrifting ? " ⚠ performance drift detected" : ""}`,
        topStrategy ? `Top strategy: ${topStrategy.strategy} win-rate ${(topStrategy.winRate * 100).toFixed(0)}% (${topStrategy.bestRegime ?? "any"} regime)` : "",
        `Confidence modifier: ${confModifier.toFixed(2)}x (${confModifier >= 1 ? "above" : "below"} baseline)`,
      ].filter(Boolean).join(" | ");

      // Recent session context for follow-up continuity (last 3 headlines, excluding current question).
      const recentHistory = genesisMemory.list().slice(-3);
      const sessionCtx = recentHistory.length
        ? `Recent session context: ${recentHistory.map((e) => e.headline.slice(0, 50)).join(" → ")}`
        : "";

      // Watchlist context — exposes user's tracked symbols for portfolio-aware reasoning.
      const watchlistCtx = watchlistItems.length
        ? `User watchlist (${watchlistItems.length} assets): ${watchlistItems.slice(0, 5).map((a) => a.symbol).join(", ")}`
        : "";

      // Signal history context — compact win-rate and dominant regime from learning layer.
      const sigMem = getMemory();
      const resolved = sigMem.filter((s) => s.outcome && s.outcome !== "pending");
      const sigWinRate = resolved.length > 0 ? Math.round((resolved.filter((s) => s.outcome === "success").length / resolved.length) * 100) : null;
      const regimeCounts = new Map<string, number>();
      for (const s of sigMem) regimeCounts.set(s.regime, (regimeCounts.get(s.regime) ?? 0) + 1);
      const topRegime = [...regimeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const signalCtx = sigMem.length > 5
        ? `Signal history: ${sigMem.length} signals${sigWinRate !== null ? `, ${sigWinRate}% win-rate` : ""}${topRegime ? `, dominant regime: ${topRegime}` : ""}`
        : "";

      const fullContext = [memCtx, decisionCtx, watchlistCtx, signalCtx, opportunityCtx, riskCtx, marketContext, sessionCtx].filter(Boolean).join("\n");
      const res = await ask({ data: { question: trimmed, language: lang, marketContext: fullContext } });

      if (res.error === "rate_limited") {
        toast.error(ar ? "تم تجاوز الحد، حاول لاحقاً" : "Rate limit exceeded, try again shortly");
        return;
      }
      if (res.error === "payment_required") {
        toast.error(ar ? "أضف رصيداً في إعدادات Lovable AI" : "Add credits in Lovable AI settings");
        return;
      }
      if (!res.reply) return;

      // Track interaction
      memoryAgent.trackGenesisQuestion();

      // Adaptive preference: track which asset Genesis discussed so it surfaces in preferred assets.
      if (res.reply.suggestedAction?.symbol) {
        memoryAgent.trackAssetInteraction(res.reply.suggestedAction.symbol);
      }

      // Persist to history
      genesisMemory.append({
        ts: Date.now(),
        question: trimmed,
        headline: res.reply.headline.slice(0, 80),
        confidence: res.reply.confidence,
        engineUsed: res.engine,
        actionType: res.reply.suggestedAction?.type ?? null,
      });
      setMemorySummary(genesisMemory.summary());

      setExchanges((prev) => [
        ...prev,
        {
          id: `ex_${Date.now()}`,
          question: trimmed,
          reply: res.reply!,
          engine: res.engine,
          actionState: res.reply?.suggestedAction?.type && res.reply.suggestedAction.type !== "none" ? "pending" : null,
          feedback: null,
        },
      ]);
    } catch {
      toast.error(ar ? "تعذر الاتصال بـ Genesis" : "Could not reach Genesis");
    } finally {
      setBusy(false);
    }
  };

  const executeAction = async (exId: string, rawAction: GenesisSuggestedAction) => {
    const action = sanitizeGenesisAction(rawAction);
    if (!action) {
      toast.error(ar ? "إجراء غير مسموح به" : "Action not permitted");
      return;
    }
    setExchanges((prev) => prev.map((e) => e.id === exId ? { ...e, actionState: "confirmed" } : e));

    if (action.type === "add_watchlist" && action.symbol) {
      const added = addToWatchlist({
        symbol: action.symbol.toUpperCase(),
        name: action.symbol,
        category: "other",
        price: 0,
        change24h: 0,
      });
      if (added) toast.success(ar ? `تمت إضافة ${action.symbol} إلى المراقبة` : `${action.symbol} added to watchlist`);
      else toast.info(ar ? `${action.symbol} موجود بالفعل في المراقبة` : `${action.symbol} already in watchlist`);
      return;
    }
    if (action.type === "create_alert" && action.symbol && action.price != null && action.condition) {
      try {
        await alertFn({
          data: {
            symbol: action.symbol.toUpperCase(),
            asset_name: action.symbol,
            condition: action.condition,
            target_price: action.price,
          },
        });
        toast.success(
          ar
            ? `تم إنشاء تنبيه لـ ${action.symbol} ${action.condition === "above" ? "فوق" : "تحت"} ${action.price}`
            : `Alert created: ${action.symbol} ${action.condition} ${action.price}`,
        );
      } catch {
        toast.error(ar ? "تعذّر إنشاء التنبيه" : "Could not create alert");
        setExchanges((prev) => prev.map((e) => e.id === exId ? { ...e, actionState: "pending" } : e));
      }
      return;
    }
    if (action.type === "create_alert") {
      void navigate({ to: "/alerts" as any });
      return;
    }
    if (action.type === "analyze_asset" && action.symbol) {
      void navigate({ to: "/market-intelligence" as any });
      return;
    }
    if (action.type === "compare_assets") {
      void navigate({ to: (action.route as any) ?? "/market-intelligence" });
      return;
    }
    if (action.type === "summarize_portfolio") {
      void navigate({ to: (action.route as any) ?? "/portfolio-ai" });
      return;
    }
    if (action.type === "navigate" && action.route) {
      void navigate({ to: action.route as any });
      return;
    }
  };

  const dismissAction = (exId: string) => {
    setExchanges((prev) => prev.map((e) => e.id === exId ? { ...e, actionState: "dismissed" } : e));
  };

  const deferAction = (exId: string) => {
    setExchanges((prev) => prev.map((e) => e.id === exId ? { ...e, actionState: "deferred" } : e));
    toast(ar ? "تم حفظ الاقتراح — يمكنك مراجعته لاحقاً" : "Suggestion saved — review it when ready");
  };

  const recordFeedback = (exId: string, rating: "helpful" | "unhelpful") => {
    const ex = exchanges.find((e) => e.id === exId);
    if (!ex || ex.feedback) return;
    setExchanges((prev) => prev.map((e) => e.id === exId ? { ...e, feedback: rating } : e));
    memoryAgent.recordRecommendation({
      asset: ex.reply.suggestedAction?.symbol ?? "MARKET",
      bias: ex.reply.confidenceLabel === "high" ? "bullish" : ex.reply.confidenceLabel === "low" ? "bearish" : "neutral",
      confidence: ex.reply.confidence / 100,
      hit: rating === "helpful",
    });
    toast.success(ar ? "شكراً على ملاحظاتك" : "Feedback recorded");
  };

  const handleClearMemory = () => {
    aiMemory.clear();
    clearSignalMemory();
    memoryAgent.clear();
    genesisMemory.clear();
    setMemorySummary(genesisMemory.summary());
    toast.success(ar ? "تم مسح الذاكرة بالكامل" : "All memory cleared");
  };

  const suggestions = ar ? SUGGESTED_AR : SUGGESTED_EN;

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6">

      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <div className="ornament-border relative mb-6 overflow-hidden rounded-2xl shadow-elegant">
        <div className="gradient-hero absolute inset-0 pointer-events-none" />
        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl gradient-primary shadow-glow">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                <Brain className="h-3.5 w-3.5" />
                {ar ? "مساعد الاستثمار الذكي" : "Interactive Investment Copilot"}
              </div>
              <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
                <span className="text-gradient">Genesis</span>
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {ar
                  ? "تحليل سيناريوهات استثمارية مستقبلية مع نسب ثقة معايرة — يقترح Genesis الإجراء المناسب ويطلب موافقتك قبل تنفيذه."
                  : "Forward-looking scenario analysis with calibrated confidence — Genesis proposes an action and waits for your confirmation before executing."}
              </p>
            </div>
          </div>
        </div>
        <div className="relative z-10 border-t border-border/40 bg-card/30 px-5 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3 w-3 shrink-0 text-warning" />
            <span className="font-semibold text-warning">{ar ? "تحذير:" : "Disclaimer:"}</span>
            {ar
              ? "تحليل تعليمي فقط — Genesis لا ينفذ أوامر شراء أو بيع حقيقية."
              : "Educational analysis only — Genesis cannot and does not execute real buy or sell orders."}
            <span className="ms-auto flex items-center gap-1.5">
              <span className="text-muted-foreground/60">{ar ? "ملف المخاطر:" : "Risk profile:"}</span>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                {ar ? (RISK_LABEL[profile.riskAppetite]?.ar ?? profile.riskAppetite) : (RISK_LABEL[profile.riskAppetite]?.en ?? profile.riskAppetite)}
              </span>
            </span>
            <DataStatusBadge status="simulation" />
          </div>
        </div>
      </div>

      {/* ─── Memory Panel ───────────────────────────────────────────────── */}
      <div className="mb-4 rounded-xl border border-border/40 bg-card/50">
        <button
          onClick={() => setMemoryOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <div className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5 shrink-0" />
            <span className="font-semibold uppercase tracking-wider">
              {ar ? "ذاكرة Genesis" : "Genesis Memory"}
            </span>
            {memorySummary.total > 0 && (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {memorySummary.total}
              </span>
            )}
          </div>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", memoryOpen && "rotate-180")} />
        </button>

        {memoryOpen && (
          <div className="border-t border-border/40 px-4 pb-4 pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MemoryStat
                label={ar ? "الأسئلة" : "Questions"}
                value={String(memorySummary.total || 0)}
              />
              <MemoryStat
                label={ar ? "متوسط الثقة" : "Avg confidence"}
                value={memorySummary.total ? `${memorySummary.avgConfidence}%` : "—"}
              />
              <MemoryStat
                label={ar ? "نسبة AI" : "AI ratio"}
                value={memorySummary.total ? `${memorySummary.aiRatio}%` : "—"}
              />
              <MemoryStat
                label={ar ? "المعايرة ECE" : "Calibration ECE"}
                value={eceVal > 0 ? eceVal.toFixed(3) : "—"}
                highlight={drift.isDrifting ? "warning" : undefined}
              />
            </div>

            {profile.preferredAssets.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {ar ? "الأصول المفضلة" : "Preferred assets"}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.preferredAssets.slice(0, 8).map((a) => (
                    <span key={a} className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-xs font-mono">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Response style preference */}
            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {ar ? "أسلوب الردود" : "Response style"}
              </div>
              <div className="flex gap-2">
                {(["brief", "detailed"] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => {
                      memoryAgent.setResponseStyle(style);
                      setProfileVersion((v) => v + 1);
                    }}
                    className={cn(
                      "rounded-md border px-3 py-1 text-xs font-semibold transition-colors",
                      profile.responseStyle === style
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {style === "brief"
                      ? (ar ? "مختصر" : "Brief")
                      : (ar ? "مفصّل" : "Detailed")}
                  </button>
                ))}
              </div>
            </div>

            {drift.isDrifting && (
              <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {ar
                  ? `انحراف في الأداء: ${(drift.recentWinRate * 100).toFixed(0)}% مقابل ${(drift.baselineWinRate * 100).toFixed(0)}% خط الأساس`
                  : `Performance drift: ${(drift.recentWinRate * 100).toFixed(0)}% vs ${(drift.baselineWinRate * 100).toFixed(0)}% baseline`}
              </div>
            )}

            <button
              onClick={handleClearMemory}
              className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              {ar ? "مسح كل الذاكرة" : "Clear all memory"}
            </button>
          </div>
        )}
      </div>

      {/* ─── Exchanges ──────────────────────────────────────────────────── */}
      <div className="space-y-6">
        {exchanges.length === 0 && !busy && (
          <EmptyState ar={ar} suggestions={suggestions} onSelect={(s) => send(s)} />
        )}

        {exchanges.map((ex) => (
          <ExchangeCard
            key={ex.id}
            exchange={ex}
            ar={ar}
            confModifier={confModifier}
            onConfirm={(action) => executeAction(ex.id, action)}
            onDismiss={() => dismissAction(ex.id)}
            onDefer={() => deferAction(ex.id)}
            onFeedback={(rating) => recordFeedback(ex.id, rating)}
          />
        ))}

        {busy && <ThinkingState ar={ar} />}
        <div ref={bottomRef} />
      </div>

      {/* ─── Composer ───────────────────────────────────────────────────── */}
      <div className="mt-6 rounded-2xl border border-border gradient-card p-4 shadow-card">
        <Textarea
          rows={3}
          placeholder={ar ? "اسأل Genesis عن أي موضوع استثماري..." : "Ask Genesis about any investment topic…"}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(question); } }}
          className="resize-none border-border/60 bg-background/40 text-sm"
        />
        {exchanges.length === 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setQuestion(s)}
                className="rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          {exchanges.length > 0 && (
            <button
              onClick={() => setExchanges([])}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3 w-3" />
              {ar ? "محادثة جديدة" : "New conversation"}
            </button>
          )}
          <div className="ms-auto">
            <Button onClick={() => void send(question)} disabled={busy || !question.trim()} className="gradient-primary text-primary-foreground shadow-glow">
              <Send className="me-2 h-4 w-4" />
              {busy ? (ar ? "جارٍ التحليل..." : "Analysing…") : (ar ? "إرسال" : "Send")}
            </Button>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] italic text-muted-foreground">
        {ar
          ? "Genesis لا ينفذ أي أوامر تداول حقيقية ولا يتصل بأي وسيط مالي. جميع التحليلات تعليمية ومحاكاتية فقط."
          : "Genesis does not execute real trades and has no connection to any broker or financial execution system. All analysis is educational and simulative only."}
      </p>
    </div>
  );
}

function EmptyState({ ar, suggestions, onSelect }: { ar: boolean; suggestions: string[]; onSelect: (s: string) => void }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/10 p-8 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl gradient-primary shadow-glow">
        <Sparkles className="h-7 w-7 text-primary-foreground" />
      </div>
      <h2 className="font-display text-xl font-bold">{ar ? "مرحباً بك في Genesis" : "Welcome to Genesis"}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        {ar
          ? "اطرح أي سؤال استثماري للحصول على تحليل سيناريوهات بنسب ثقة معايرة."
          : "Ask any investment question for scenario analysis with calibrated confidence scores."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {suggestions.slice(0, 5).map((s) => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className="rounded-full border border-border/70 bg-muted/30 px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThinkingState({ ar }: { ar: boolean }) {
  return (
    <div className="rounded-2xl border border-border gradient-card p-5 shadow-card">
      <div className="flex items-center gap-2 text-sm text-primary">
        <Activity className="h-4 w-4 animate-pulse" />
        {ar ? "Genesis يحلل الأسواق والعوامل الكلية..." : "Genesis is analysing markets and macro factors…"}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/40" />)}
      </div>
    </div>
  );
}

function ExchangeCard({ exchange, ar, confModifier, onConfirm, onDismiss, onDefer, onFeedback }: {
  exchange: Exchange;
  ar: boolean;
  confModifier: number;
  onConfirm: (a: GenesisSuggestedAction) => void;
  onDismiss: () => void;
  onDefer: () => void;
  onFeedback: (rating: "helpful" | "unhelpful") => void;
}) {
  const { reply, engine, actionState } = exchange;
  const displayConfidence = Math.round(Math.min(99, Math.max(1, reply.confidence * confModifier)));
  const effectiveLabel: "low" | "moderate" | "high" =
    displayConfidence >= 70 ? "high" : displayConfidence >= 45 ? "moderate" : "low";
  const confidenceColor = CONFIDENCE_COLOR[effectiveLabel] ?? "text-primary";

  return (
    <div className="space-y-4">
      {/* Question bubble */}
      <div className={cn("flex", ar ? "justify-start" : "justify-end")}>
        <div className="max-w-lg rounded-2xl border border-border/60 bg-muted/30 px-4 py-2.5 text-sm">
          {exchange.question}
        </div>
      </div>

      {/* Genesis response card */}
      <div className="rounded-2xl border border-border gradient-card shadow-card overflow-hidden">
        {/* Response header */}
        <div className="flex items-center justify-between gap-3 border-b border-border/40 px-5 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Genesis</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-semibold", confidenceColor)}>
              {ar ? "الثقة" : "Confidence"}: {displayConfidence}%
            </span>
            <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1",
              engine === "ai"
                ? "bg-primary/10 text-primary ring-primary/30"
                : "bg-muted/40 text-muted-foreground ring-border"
            )}>
              {engine === "ai" ? "AI" : (ar ? "محلي" : "Heuristic")}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Confidence bar + label */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{ar ? "مستوى الثقة" : "Confidence level"}</span>
              <span className={cn("font-semibold", confidenceColor)}>
                {effectiveLabel === "high"
                  ? (ar ? "مرتفعة" : "High")
                  : effectiveLabel === "moderate"
                    ? (ar ? "متوسطة" : "Moderate")
                    : (ar ? "منخفضة" : "Low")}
              </span>
            </div>
            <Progress value={displayConfidence} className="h-1.5" />
          </div>

          {/* Regime badge */}
          {reply.regime && (
            <div className="flex items-center gap-1.5">
              <Activity className="h-3 w-3 text-primary/60" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {ar ? "النظام السوقي:" : "Regime:"}
              </span>
              <span className="rounded-md border border-primary/25 bg-primary/8 px-2 py-0.5 text-[10px] font-bold text-primary">
                {reply.regime.replace(/_/g, " ")}
              </span>
            </div>
          )}

          {/* Headline */}
          <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1">
              {ar ? "الخلاصة" : "Headline"}
            </div>
            <p className="text-sm font-semibold leading-snug">{reply.headline}</p>
          </div>

          {/* Institutional evidence */}
          {reply.evidence && reply.evidence.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                {ar ? "الأدلة المؤسسية" : "Institutional Evidence"}
              </div>
              <ul className="space-y-1.5">
                {reply.evidence.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-success/60" />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Outlook */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              {ar ? "النظرة التحليلية" : "Analytical Outlook"}
            </div>
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{reply.outlook}</p>
          </div>

          {/* Portfolio impact */}
          {reply.portfolioImpact && (
            <div className="rounded-xl border border-success/25 bg-success/5 px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <PieChart className="h-3.5 w-3.5 text-success/70" />
                <div className="text-[10px] uppercase tracking-wider text-success font-semibold">
                  {ar ? "الأثر على محفظتك" : "Portfolio Impact"}
                </div>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">{reply.portfolioImpact}</p>
            </div>
          )}

          {/* Scenarios */}
          {reply.scenarios?.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                {ar ? "السيناريوهات" : "Scenarios"}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {reply.scenarios.map((s, i) => (
                  <ScenarioCard key={i} scenario={s} index={i} ar={ar} />
                ))}
              </div>
            </div>
          )}

          {/* Risks */}
          {reply.risks?.length > 0 && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                {ar ? "المخاطر التي تستدعي المراقبة" : "Risks to monitor"}
              </div>
              <ul className="space-y-1 ps-4 text-sm text-foreground/90">
                {reply.risks.map((r, i) => <li key={i} className="list-disc">{r}</li>)}
              </ul>
            </div>
          )}

          {/* Uncertainty warning — explains WHY confidence is low (set by institutional brain) */}
          {reply.uncertaintyWarning && (
            <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-2.5 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{reply.uncertaintyWarning}</span>
            </div>
          )}

          {/* Confidence gate — advisory-only warning when confidence is very low */}
          {displayConfidence < 40 && reply.suggestedAction && reply.suggestedAction.type !== "none" && actionState === "pending" && (
            <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-2 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {ar
                ? `ثقة منخفضة (${displayConfidence}%) — هذا الاقتراح استشاري فقط`
                : `Low confidence (${displayConfidence}%) — this suggestion is advisory only`}
            </div>
          )}

          {/* Action card — hidden when confidence too low to be actionable */}
          {reply.suggestedAction && reply.suggestedAction.type !== "none" && actionState === "pending" && displayConfidence >= 25 && (
            <ActionCard
              action={reply.suggestedAction}
              ar={ar}
              onConfirm={() => onConfirm(reply.suggestedAction!)}
              onDismiss={onDismiss}
              onDefer={onDefer}
            />
          )}

          {actionState === "confirmed" && (
            <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-2.5 text-sm text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {ar ? "تم تنفيذ الإجراء بنجاح" : "Action executed successfully"}
            </div>
          )}

          {actionState === "dismissed" && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <ChevronRight className="h-3 w-3 shrink-0" />
              {ar ? "تم تجاهل الاقتراح" : "Suggestion dismissed"}
            </div>
          )}

          {actionState === "deferred" && (
            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-xs text-primary/80">
              <Brain className="h-3.5 w-3.5 shrink-0" />
              {ar ? "تم حفظ الاقتراح — راجعه عندما تكون مستعداً" : "Suggestion saved — review when ready"}
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-center text-[11px] italic text-muted-foreground">{reply.disclaimer}</p>

          {/* Feedback row */}
          <div className="flex items-center justify-center gap-3 pt-1">
            {exchange.feedback ? (
              <span className="text-[11px] text-muted-foreground/60">
                {exchange.feedback === "helpful"
                  ? (ar ? "شكراً — تم تسجيل ملاحظتك الإيجابية" : "Thanks — positive feedback recorded")
                  : (ar ? "شكراً — سيساعدنا ذلك على التحسين" : "Thanks — will help us improve")}
              </span>
            ) : (
              <>
                <span className="text-[11px] text-muted-foreground/60">{ar ? "هل كان هذا مفيداً؟" : "Was this helpful?"}</span>
                <button
                  onClick={() => onFeedback("helpful")}
                  className="flex items-center gap-1 rounded-md border border-border/50 bg-muted/20 px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-success/40 hover:bg-success/10 hover:text-success"
                >
                  <ThumbsUp className="h-3 w-3" />
                  {ar ? "نعم" : "Yes"}
                </button>
                <button
                  onClick={() => onFeedback("unhelpful")}
                  className="flex items-center gap-1 rounded-md border border-border/50 bg-muted/20 px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                >
                  <ThumbsDown className="h-3 w-3" />
                  {ar ? "لا" : "No"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const SCENARIO_STYLES = [
  "border-success/30 bg-success/5",
  "border-primary/30 bg-primary/5",
  "border-warning/30 bg-warning/5",
];
const SCENARIO_ICONS = [TrendingUp, Minus, TrendingDown];
const SCENARIO_LABEL_COLORS = ["text-success", "text-primary", "text-warning"];

function ScenarioCard({ scenario, index, ar }: { scenario: { label: string; probability: string; impact: string }; index: number; ar: boolean }) {
  const Icon = SCENARIO_ICONS[index % 3] ?? Minus;
  const border = SCENARIO_STYLES[index % 3];
  const labelColor = SCENARIO_LABEL_COLORS[index % 3];
  return (
    <div className={cn("rounded-xl border p-3", border)}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={cn("h-3.5 w-3.5", labelColor)} />
        <span className={cn("text-xs font-semibold", labelColor)}>{scenario.label}</span>
      </div>
      <div className="text-xs text-muted-foreground mb-1">
        {ar ? "الاحتمال:" : "Probability:"} <span className="font-medium text-foreground">{scenario.probability}</span>
      </div>
      <p className="text-xs leading-relaxed text-foreground/80">{scenario.impact}</p>
    </div>
  );
}

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  add_watchlist: Eye,
  create_alert: Bell,
  analyze_asset: Brain,
  compare_assets: Scale,
  summarize_portfolio: PieChart,
  navigate: Navigation,
  none: ChevronRight,
};

function MemoryStat({ label, value, highlight }: { label: string; value: string; highlight?: "warning" }) {
  return (
    <div className={cn(
      "rounded-lg border p-2.5 text-center",
      highlight === "warning" ? "border-warning/30 bg-warning/5" : "border-border/40 bg-muted/20",
    )}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={cn("mt-0.5 text-sm font-bold", highlight === "warning" ? "text-warning" : "text-foreground")}>
        {value}
      </div>
    </div>
  );
}

function ActionCard({ action, ar, onConfirm, onDismiss, onDefer }: {
  action: GenesisSuggestedAction;
  ar: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  onDefer: () => void;
}) {
  const Icon = ACTION_ICONS[action.type] ?? ChevronRight;
  const isConditionalAlert = action.type === "create_alert" && action.symbol && action.price != null && action.condition;
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">
          {ar ? "إجراء مقترح من Genesis" : "Genesis suggested action"}
        </span>
        <span className="rounded-md border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-bold text-warning">
          {ar ? "مسودة" : "Draft"}
        </span>
      </div>

      {/* Conditional preview for price-triggered alerts */}
      {isConditionalAlert && (
        <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-xs font-mono">
          <span className="text-muted-foreground">{ar ? "إذا" : "IF"}</span>
          <span className="font-semibold text-foreground">{action.symbol}</span>
          <span className={cn(
            "font-semibold",
            action.condition === "above" ? "text-success" : "text-destructive",
          )}>
            {action.condition === "above" ? (ar ? "تجاوز" : ">") : (ar ? "انخفض عن" : "<")}
          </span>
          <span className="font-semibold text-foreground">{action.price!.toLocaleString()}</span>
          <span className="mx-1 text-muted-foreground">→</span>
          <Bell className="h-3 w-3 text-primary" />
          <span className="text-primary">{ar ? "إنشاء تنبيه" : "Create alert"}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Icon className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium">{action.label}</span>
          {action.symbol && !action.assets?.length && !isConditionalAlert && (
            <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-xs font-mono">
              {action.symbol}
            </span>
          )}
          {action.assets?.map((a) => (
            <span key={a} className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-xs font-mono">
              {a}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onDismiss}>
            {ar ? "تجاهل" : "Dismiss"}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs text-primary border-primary/30" onClick={onDefer}>
            {ar ? "لاحقاً" : "Later"}
          </Button>
          <Button size="sm" className="h-7 text-xs gradient-primary text-primary-foreground shadow-glow" onClick={onConfirm}>
            {ar ? "تأكيد" : "Confirm"}
          </Button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {ar
          ? "لن يُنفَّذ هذا الإجراء إلا بعد الضغط على «تأكيد»."
          : "This action will only execute after you press Confirm."}
      </p>
    </div>
  );
}
