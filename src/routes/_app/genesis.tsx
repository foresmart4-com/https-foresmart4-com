import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { askGenesis, type GenesisReply, type GenesisSuggestedAction } from "@/lib/genesis.functions";
import { createAlert } from "@/lib/alerts.functions";
import { getMarketData, type AssetQuote } from "@/lib/market-data";
import { useI18n } from "@/lib/i18n";
import { addToWatchlist, useWatchlist } from "@/lib/watchlistStore";
import { computeMarketIntel, type MarketIntelSummary } from "@/services/market/marketIntelEngine";
import { computePortfolioIntel, type PortfolioIntelSummary } from "@/services/portfolio/portfolioIntelEngine";
import { computeScenarioSim, type ScenarioSimResult } from "@/services/scenarios/scenarioEngine";
import { detectResearchIntent } from "@/services/research/researchEngine";
import { researchMemory } from "@/services/learning/researchMemory";
import { intelligenceGraph, type GraphSummary } from "@/services/learning/intelligenceGraph";
import { extractGraphFromReply } from "@/services/learning/graphExtractor";
import { memoryAgent } from "@/services/agents/memoryAgent";
import { genesisMemory } from "@/services/learning/genesisMemory";
import { memoryIntelligence } from "@/services/learning/memoryIntelligence";
import { aiMemory } from "@/services/learning/aiMemory";
import { clearMemory as clearSignalMemory, getMemory } from "@/services/learning/signalMemory";
import { thesisMemory, type ThesisEntry } from "@/services/learning/thesisMemory";
import { sessionIntelStore } from "@/services/learning/sessionIntelStore";
import { ece, driftReport, strategyScores } from "@/services/learning/selfLearningEngine";
import { pruneContext } from "@/lib/ai/pruneContext";
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
  ThumbsUp, ThumbsDown, ChevronDown, Trash2, Database, Zap, XCircle,
  BookOpen, FileText, Layers, Clock, Network, FlaskConical, Gauge, ShieldAlert,
} from "lucide-react";
import { evaluateReply, scoreToQuality, type MetaReasoningResult } from "@/services/reasoning/metaReasoning";
import { coordinateIntelligence, type CoordinationResult } from "@/services/intelligence/coordinatorEngine";
import { computeProactiveResearch, type ResearchCandidate } from "@/services/research/proactiveEngine";
import { computeStrategicSynthesis, type StrategicSynthesis, type StrategicBias } from "@/services/intelligence/strategicEngine";
import { inferThesisOutcomes, type OutcomeSummary } from "@/services/learning/outcomeEngine";
import { computeDecisionScore, type DecisionScoreResult, type CalibrationScore } from "@/services/learning/decisionScoring";
import { overallStats } from "@/services/learning/selfLearningEngine";

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
  provider?: string;
  tracksUsed?: number;
  dominantBias?: "bullish" | "bearish" | "neutral";
  actionState: "pending" | "confirmed" | "dismissed" | "deferred" | null;
  feedback: "helpful" | "unhelpful" | null;
  comparisonPair: [string, string] | null;
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
  const [researchMode, setResearchMode] = useState(false);
  const [researchCount, setResearchCount] = useState(() => researchMemory.count());
  const [graphSummary, setGraphSummary] = useState<GraphSummary>(() => intelligenceGraph.summary());
  const [memorySummary, setMemorySummary] = useState(() => genesisMemory.weightedSummary());
  const [thesisCount, setThesisCount] = useState(() => thesisMemory.all().length);
  const [continuityScore, setContinuityScore] = useState(() => memoryIntelligence.snapshot().continuityScore);
  const [coordinationResult, setCoordinationResult] = useState<CoordinationResult | null>(null);
  const [profileVersion, setProfileVersion] = useState(0);
  const [dismissedResearch, setDismissedResearch] = useState<Set<string>>(() => new Set());
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

  useEffect(() => {
    memoryIntelligence.compress();
  }, []);

  const assets = market?.assets ?? [];
  const marketIntel = useMemo(() => computeMarketIntel(assets), [assets]); // eslint-disable-line react-hooks/exhaustive-deps
  const portfolioIntel = useMemo(
    () => computePortfolioIntel(watchlistItems, marketIntel, thesisMemory.all()),
    [watchlistItems, marketIntel], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Pre-submission scenario panel — regime-based, no question (keyword score = 0 → pure regime/stress signals)
  const marketScenarios = useMemo(
    () => computeScenarioSim("", marketIntel, watchlistItems, []),
    [marketIntel, watchlistItems], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Proactive research candidates — computed from existing data, no extra API calls.
  // Recomputes whenever market data or watchlist changes. Session bus read is synchronous localStorage.
  const researchCandidates = useMemo(() => {
    const all = computeProactiveResearch({
      assets: assets.map((a) => ({ symbol: a.symbol, changePct: a.changePct, category: a.category })),
      watchlistItems,
      theses: thesisMemory.all(),
      sessionBus: sessionIntelStore.read(),
      portfolioAlignment: portfolioIntel.regimeAlignment,
      portfolioHasContext: Boolean(portfolioIntel.compactContext),
      ar,
    });
    return all.filter((c) => !dismissedResearch.has(c.id));
  }, [assets, watchlistItems, ar, portfolioIntel, dismissedResearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Strategic synthesis — combines session bus, thesis history, proactive signals, portfolio.
  // Pure computation, no I/O. Recalculates when underlying data changes.
  const strategicSynthesis = useMemo(() => computeStrategicSynthesis({
    sessionBus: sessionIntelStore.read(),
    theses: thesisMemory.all(),
    proactiveCandidates: researchCandidates,
    portfolioAligned: portfolioIntel.regimeAlignment.aligned,
    portfolioNote: portfolioIntel.regimeAlignment.note,
    portfolioHasContext: Boolean(portfolioIntel.compactContext),
    marketRegime: marketIntel.regime ?? "",
    ar,
  }), [researchCandidates, portfolioIntel, marketIntel, ar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Thesis outcome assessment — deterministic, recomputed when proactive signals or watchlist changes.
  // Conservative: only classifies clear outcomes; defaults to outcome_unclear. No persistence.
  const thesisOutcomes = useMemo(() => inferThesisOutcomes(
    thesisMemory.all(),
    sessionIntelStore.read(),
    researchCandidates,
    ar,
  ), [researchCandidates, ar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Decision calibration score — unifies ECE, outcome patterns, and track record.
  // Provides compact context for AI injection; shown as tiny badge in stats panel.
  const decisionScore = useMemo(() => {
    const overall = overallStats();
    const thesisStats = thesisMemory.outcomeStats();
    return computeDecisionScore({
      eceVal,
      tradeCount: overall.trades,
      isDrifting: drift.isDrifting,
      confModifier,
      outcomeSummary: thesisOutcomes,
      thesisResolved: thesisStats.resolved,
      thesisAccuracy: thesisStats.accuracy,
      ar,
    });
  }, [eceVal, thesisOutcomes, confModifier, ar]); // eslint-disable-line react-hooks/exhaustive-deps

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
        // Strategic synthesis — bias + opportunity/risk framing + conflict note
        strategicSynthesis.decisionContext,
        // Outcome pressure note — conservative adjustment from prior thesis pattern
        thesisOutcomes.confidencePressure !== 0
          ? `Outcome pressure: ${thesisOutcomes.confidencePressure > 0 ? "+" : ""}${thesisOutcomes.confidencePressure} pts from thesis pattern (${thesisOutcomes.confirmed} confirmed, ${thesisOutcomes.weakened} weakened, ${thesisOutcomes.invalidated} invalidated)`
          : "",
        // Calibration context — unified ECE + outcome + track record score
        decisionScore.calibrationContext,
        // Calibration pressure — additive to outcome pressure, bounded ±4 pts
        decisionScore.calibrationPressure !== 0
          ? `Calibration pressure: ${decisionScore.calibrationPressure > 0 ? "+" : ""}${decisionScore.calibrationPressure} pts (${decisionScore.score}${decisionScore.trustProfile.hasOvershootSignal ? ", overshoot detected" : ""})`
          : "",
      ].filter(Boolean).join(" | ");

      // Memory intelligence context — age-weighted, digest-compressed, continuity-aware.
      const sessionCtx = memoryIntelligence.buildIntelContext();

      // Watchlist context — category-aware, feeds portfolio-aware reasoning.
      const watchlistCtx = watchlistItems.length
        ? `User watchlist (${watchlistItems.length}): ${watchlistItems.slice(0, 6).map((a) => `${a.symbol}(${a.category})`).join(", ")}`
        : "";

      // Portfolio brain context — exposure, concentration, regime alignment, thesis matches.
      const portfolioIntelCtx = portfolioIntel.compactContext;

      // Thesis evolution context — extracts primary asset from question to prioritise
      // same-asset prior thesis; includes evolution rule + calibration memory note.
      const PRIMARY_ASSET_RE = /\b(BTC|ETH|XAU|GOLD|OIL|WTI|SPX|SPY|QQQ|TASI|2222|SABIC|AAPL|TSLA|NVDA|MSFT|AMZN|META|ARAMCO|EURUSD|USDJPY|GBPUSD)\b/i;
      const assetMatch = PRIMARY_ASSET_RE.exec(trimmed);
      const primaryAssetHint = assetMatch ? assetMatch[0].toUpperCase() : undefined;
      const thesisCtx = thesisMemory.buildEvolutionContextWithOutcomes(
        3,
        primaryAssetHint,
        thesisOutcomes.contextString,
      );

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

      // Cross-surface session bus — prior regime from this session if fresh.
      const sessionBus = sessionIntelStore.read();
      const sessionBusCtx = sessionBus
        ? (() => {
            const ageMins = Math.round((Date.now() - sessionBus.ts) / 60_000);
            const ageStr = ageMins < 2 ? "just now" : ageMins < 60 ? `${ageMins}m ago` : `${(ageMins / 60).toFixed(1)}h ago`;
            return [
              `Session regime (${ageStr}): ${sessionBus.regime} at ${sessionBus.confidence}% confidence`,
              sessionBus.dominantBias ? `${sessionBus.dominantBias} bias` : "",
              sessionBus.primaryRisk ? `risk: ${sessionBus.primaryRisk.slice(0, 60)}` : "",
            ].filter(Boolean).join(", ");
          })()
        : "";

      // Scenario simulation context — question-aware keyword + regime matching.
      const scenarioSim = computeScenarioSim(trimmed, marketIntel, watchlistItems, thesisMemory.all());
      const scenarioCtx = scenarioSim.compactContext;

      // Research Terminal context — Phase 8.
      const intent = detectResearchIntent(trimmed, watchlistItems, thesisMemory.all());
      const researchHint = researchMode
        ? (intent.compactHint || `Research mode (market): produce full institutional research report. Populate executiveSummary, keyDrivers, watchItems. Set researchType="market".`)
        : intent.compactHint;

      // Intelligence Graph recall — Phase 9: historical asset/thesis/risk context from prior sessions.
      const graphCtx = intelligenceGraph.compactContext(trimmed, watchlistItems);

      // Meta-reasoning hint — Phase 10: evaluate last reply's reasoning quality to guide next query.
      const lastExchangeReply = exchanges[exchanges.length - 1]?.reply ?? null;
      const metaResult = evaluateReply(lastExchangeReply);
      const metaCtx = metaResult?.compactHint ?? "";

      // Intelligence Coordination Layer — Phase 11: dynamic weight routing and conflict arbitration.
      const coordResult = coordinateIntelligence(
        trimmed,
        {
          mem:         memCtx,
          decision:    decisionCtx,
          research:    researchHint ?? "",
          watchlist:   watchlistCtx,
          thesis:      thesisCtx,
          session:     sessionCtx,
          portfolio:   portfolioIntelCtx,
          bus:         sessionBusCtx,
          signal:      signalCtx,
          marketIntel: marketIntel.compactContext,
          scenario:    scenarioCtx,
          graph:       graphCtx,
          meta:        metaCtx,
          top3:        opportunityCtx,
          bot3:        riskCtx,
          market:      marketContext,
        },
        metaResult,
        marketIntel,
        portfolioIntel,
        researchMode || !!intent.compactHint,
        thesisCount,
        watchlistItems.length,
      );
      setCoordinationResult(coordResult);

      // Prune context with coordinator-adjusted weights (2800 chars max).
      const fullContext = pruneContext(coordResult.layers, 2800);

      const res = await ask({ data: { question: trimmed, language: lang, marketContext: fullContext, responseStyle: p.responseStyle ?? "brief", eceScore: eceVal } });

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

      // Phase 4: Cross-surface session bus — write full IntelligenceEvent (8 fields).
      if (res.reply.regime && res.reply.confidence > 0) {
        const prevBus = sessionIntelStore.read();
        const prevRegime = prevBus?.regime ?? null;
        sessionIntelStore.write({
          regime: res.reply.regime,
          confidence: res.reply.confidence,
          primaryRisk: res.reply.trackViewRisk ?? null,
          dominantBias: (res as { dominantBias?: "bullish" | "bearish" | "neutral" }).dominantBias ?? null,
          topThesis: res.reply.thesis ?? null,
          invalidationTrigger: res.reply.invalidation ?? null,
          tracksUsed: (res as { tracksUsed?: number }).tracksUsed ?? 0,
          msq: res.reply.marketStateQuality ?? "inferred",
        });
        // Record regime transition in intelligence graph when regime changes.
        if (prevRegime && prevRegime !== res.reply.regime) {
          intelligenceGraph.recordRegimeTransition(prevRegime, res.reply.regime, res.reply.confidence);
          setGraphSummary(intelligenceGraph.summary());
        }
      }

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
      setMemorySummary(genesisMemory.weightedSummary());
      setContinuityScore(memoryIntelligence.snapshot().continuityScore);

      // Save thesis to thesis memory if AI produced a directional view.
      if (res.reply.thesis && res.engine === "ai") {
        const regime = res.reply.regime ?? "";
        // Infer direction from regime label, thesis text, or dominant bias
        const thesisLower = res.reply.thesis.toLowerCase();
        const direction: ThesisEntry["direction"] =
          regime.includes("bull") || /\bbullish\b/.test(thesisLower) ? "bullish" :
          regime.includes("bear") || /\bbearish\b/.test(thesisLower) ? "bearish" : "neutral";
        // Asset: prefer AI's suggested action symbol, then question's primary asset, then MARKET
        const savedAsset = res.reply.suggestedAction?.symbol ?? primaryAssetHint ?? "MARKET";
        thesisMemory.save({
          id: `th_${Date.now()}`,
          ts: Date.now(),
          asset: savedAsset,
          direction,
          thesis: res.reply.thesis,
          confidence: res.reply.confidence,
          uncertainty: res.reply.uncertaintyWarning ?? null,
          invalidation: res.reply.invalidation ?? null,
          catalyst: res.reply.catalysts?.[0] ?? null,
          regimeAtSave: res.reply.regime ?? undefined,
        });
        setThesisCount(thesisMemory.all().length);
      }

      setExchanges((prev) => [
        ...prev,
        {
          id: `ex_${Date.now()}`,
          question: trimmed,
          reply: res.reply!,
          engine: res.engine,
          provider: (res as { provider?: string }).provider,
          tracksUsed: (res as { tracksUsed?: number }).tracksUsed,
          dominantBias: (res as { dominantBias?: "bullish" | "bearish" | "neutral" }).dominantBias,
          actionState: res.reply?.suggestedAction?.type && res.reply.suggestedAction.type !== "none" ? "pending" : null,
          feedback: null,
          comparisonPair: intent.comparisonPair,
        },
      ]);

      // Save to research memory when AI produced a research report.
      if (res.reply.researchType && res.engine === "ai") {
        const sectionsPresent: string[] = [];
        if (res.reply.executiveSummary) sectionsPresent.push("executive_summary");
        if (res.reply.keyDrivers?.length) sectionsPresent.push("key_drivers");
        if (res.reply.catalysts?.length) sectionsPresent.push("catalysts");
        if (res.reply.risks?.length) sectionsPresent.push("risks");
        if (res.reply.invalidation) sectionsPresent.push("invalidation");
        if (res.reply.scenarios?.length) sectionsPresent.push("scenarios");
        if (res.reply.portfolioImpact) sectionsPresent.push("portfolio_relevance");
        if (res.reply.confidenceDrivers?.length) sectionsPresent.push("confidence_drivers");
        if (res.reply.watchItems?.length) sectionsPresent.push("watch_items");
        if (res.reply.comparisonTable?.length) sectionsPresent.push("comparison_table");
        researchMemory.save({
          id: `res_${Date.now()}`,
          ts: Date.now(),
          question: trimmed.slice(0, 100),
          topic: intent.primaryTopic,
          type: res.reply.researchType,
          confidence: res.reply.confidence,
          sectionsPresent,
        });
        setResearchCount(researchMemory.count());
      }

      // Extract intelligence graph nodes from this reply — Phase 9
      extractGraphFromReply(res.reply, trimmed, res.engine, watchlistItems);
      setGraphSummary(intelligenceGraph.summary());
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
    genesisMemory.clearAll();
    thesisMemory.clear();
    sessionIntelStore.clear();
    researchMemory.clear();
    intelligenceGraph.clear();
    setMemorySummary(genesisMemory.weightedSummary());
    setThesisCount(0);
    setContinuityScore(0);
    setResearchCount(0);
    setGraphSummary(intelligenceGraph.summary());
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <MemoryStat
                label={ar ? "الأسئلة" : "Questions"}
                value={String(memorySummary.total || 0)}
              />
              <MemoryStat
                label={ar ? "الاستمرارية" : "Continuity"}
                value={memorySummary.total ? `${continuityScore}%` : "—"}
              />
              <MemoryStat
                label={ar ? "ثقة مرجّحة" : "Wtd. confidence"}
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
              <MemoryStat
                label={ar ? "معايرة القرار" : "Decision Score"}
                value={decisionScore.narrativeHint}
                highlight={
                  decisionScore.score === "well_calibrated" ? "success" :
                  decisionScore.score === "weakly_calibrated" ? "warning" :
                  undefined
                }
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

            {/* Saved theses + outcome summary */}
            {thesisCount > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <span>{ar ? `الأطروحات المحفوظة (${thesisCount})` : `Saved theses (${thesisCount})`}</span>
                  {thesisOutcomes.hasActionableOutcome && (
                    <span className="normal-case tracking-normal text-[9px] font-normal flex items-center gap-1">
                      {thesisOutcomes.confirmed > 0 && (
                        <span className="text-success">✓{thesisOutcomes.confirmed}</span>
                      )}
                      {thesisOutcomes.weakened > 0 && (
                        <span className="text-warning">⚠{thesisOutcomes.weakened}</span>
                      )}
                      {thesisOutcomes.invalidated > 0 && (
                        <span className="text-destructive">✗{thesisOutcomes.invalidated}</span>
                      )}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {thesisMemory.getRecent(6).map((t) => {
                    const outcome = thesisOutcomes.assessments.find(a => a.thesisId === t.id);
                    return (
                      <span
                        key={t.id}
                        title={`${t.thesis}${outcome ? ` [${outcome.label}]` : ""}`}
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-xs font-mono cursor-default",
                          t.direction === "bullish" ? "border-success/40 bg-success/10 text-success" :
                          t.direction === "bearish" ? "border-destructive/40 bg-destructive/10 text-destructive" :
                          "border-border/60 bg-muted/40 text-muted-foreground",
                        )}
                      >
                        {t.asset} {t.direction === "bullish" ? "↑" : t.direction === "bearish" ? "↓" : "→"} {t.confidence}%
                        {outcome?.label === "thesis_confirmed" && <span className="ms-1 text-success/70">✓</span>}
                        {outcome?.label === "thesis_weakened" && <span className="ms-1 text-warning/70">⚠</span>}
                        {outcome?.label === "thesis_invalidated" && <span className="ms-1 text-destructive/70">✗</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Research reports */}
            {researchCount > 0 && (
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="h-3 w-3" />
                    {ar ? `تقارير البحث (${researchCount})` : `Research reports (${researchCount})`}
                  </span>
                  <button
                    onClick={() => { researchMemory.clear(); setResearchCount(0); toast.success(ar ? "تم مسح تقارير البحث" : "Research reports cleared"); }}
                    className="text-destructive/60 hover:text-destructive transition-colors normal-case tracking-normal"
                  >
                    {ar ? "مسح" : "Clear"}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {researchMemory.getRecent(4).map((r) => (
                    <div key={r.id} className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/20 px-2.5 py-1.5 text-[11px]">
                      <FileText className="h-3 w-3 shrink-0 text-primary/60" />
                      <span className="font-medium text-foreground/80 truncate flex-1">{r.topic}</span>
                      <span className="shrink-0 rounded-md border border-border/40 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground">{r.type}</span>
                      <span className="shrink-0 text-muted-foreground/60">{r.confidence}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Intelligence Graph — Phase 9 */}
            {graphSummary.nodeCount > 0 && (
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Network className="h-3 w-3" />
                    {ar
                      ? `الرسم البياني الذكي (${graphSummary.nodeCount} عقدة · ${graphSummary.edgeCount} رابط)`
                      : `Intelligence Graph (${graphSummary.nodeCount} nodes · ${graphSummary.edgeCount} edges)`}
                  </span>
                  <button
                    onClick={() => {
                      intelligenceGraph.clear();
                      setGraphSummary(intelligenceGraph.summary());
                      toast.success(ar ? "تم مسح الرسم البياني" : "Intelligence graph cleared");
                    }}
                    className="text-destructive/60 hover:text-destructive transition-colors normal-case tracking-normal"
                  >
                    {ar ? "مسح" : "Clear"}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {graphSummary.topAssets.map((asset) => (
                    <span
                      key={asset}
                      className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-mono text-primary"
                    >
                      {asset}
                    </span>
                  ))}
                  <span className="text-[11px] text-muted-foreground/70">
                    {graphSummary.activeTheses > 0 && `${graphSummary.activeTheses} ${ar ? "أطروحة" : "thes"}`}
                    {graphSummary.activeTheses > 0 && graphSummary.activeRisks > 0 && " · "}
                    {graphSummary.activeRisks > 0 && `${graphSummary.activeRisks} ${ar ? "مخاطر" : "risks"}`}
                    {graphSummary.hasContradictions && (
                      <span className="text-warning"> · ⚠ {ar ? "تعارضات" : "contradictions"}</span>
                    )}
                  </span>
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

      {/* ─── Market Intelligence Panel ──────────────────────────────────── */}
      {marketIntel.compactContext && (
        <MarketIntelPanel intel={marketIntel} ar={ar} />
      )}

      {/* ─── Portfolio Brain Panel ──────────────────────────────────────── */}
      {portfolioIntel.compactContext && (
        <PortfolioBrainPanel intel={portfolioIntel} ar={ar} />
      )}

      {/* ─── Macro Scenario Panel ───────────────────────────────────────── */}
      {marketScenarios.hasMeaningfulData && (
        <ScenarioSimPanel sim={marketScenarios} ar={ar} />
      )}

      {/* ─── Coordination Panel — Phase 11 ─────────────────────────────── */}
      {coordinationResult && (
        <CoordinationPanel result={coordinationResult} ar={ar} />
      )}

      {/* ─── Strategic Bias — Phase 22 ──────────────────────────────────── */}
      {(strategicSynthesis.bias !== "neutral" || strategicSynthesis.hasConflict) && (
        <StrategicBiasPanel synthesis={strategicSynthesis} ar={ar} />
      )}

      {/* ─── Proactive Research Signals — Phase 21 ──────────────────────── */}
      {researchCandidates.length > 0 && (
        <ProactiveResearchPanel
          candidates={researchCandidates}
          ar={ar}
          onSelect={(prompt) => { setQuestion(prompt); }}
          onDismiss={(id) => setDismissedResearch((prev) => new Set([...prev, id]))}
        />
      )}

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
            eceVal={eceVal}
            onConfirm={(action) => executeAction(ex.id, action)}
            onDismiss={() => dismissAction(ex.id)}
            onDefer={() => deferAction(ex.id)}
            onFeedback={(rating) => recordFeedback(ex.id, rating)}
            comparisonPair={ex.comparisonPair}
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
          <div className="flex items-center gap-2">
            {exchanges.length > 0 && (
              <button
                onClick={() => setExchanges([])}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3" />
                {ar ? "محادثة جديدة" : "New conversation"}
              </button>
            )}
            <button
              onClick={() => setResearchMode((v) => !v)}
              title={ar ? "وضع البحث المؤسسي" : "Institutional research mode"}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors",
                researchMode
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border/60 bg-muted/30 text-muted-foreground hover:border-primary/30 hover:text-foreground",
              )}
            >
              <BookOpen className="h-3 w-3" />
              {ar ? "بحث" : "Research"}
              {researchMode && (
                <span className="rounded-full bg-primary/30 px-1 text-[9px] font-bold">{ar ? "مفعّل" : "ON"}</span>
              )}
            </button>
          </div>
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

const SEVERITY_COLOR: Record<ResearchCandidate["severity"], string> = {
  high: "border-warning/40 bg-warning/5",
  medium: "border-primary/30 bg-primary/5",
  low: "border-border/40 bg-muted/10",
};
const SEVERITY_ICON_COLOR: Record<ResearchCandidate["severity"], string> = {
  high: "text-warning",
  medium: "text-primary",
  low: "text-muted-foreground",
};

function ProactiveResearchPanel({
  candidates,
  ar,
  onSelect,
  onDismiss,
}: {
  candidates: ResearchCandidate[];
  ar: boolean;
  onSelect: (prompt: string) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/10 px-4 py-3 space-y-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        <Eye className="h-3 w-3" />
        {ar ? "إشارات بحثية استباقية" : "Proactive Research Signals"}
        <span className="ms-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">
          {ar ? "استشاري فقط" : "Advisory only"}
        </span>
      </div>

      {candidates.map((c) => (
        <div
          key={c.id}
          className={cn(
            "rounded-lg border px-3 py-2.5 space-y-1.5",
            SEVERITY_COLOR[c.severity],
          )}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", SEVERITY_ICON_COLOR[c.severity])} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-foreground/90">{c.asset}</span>
                <span className="rounded-md border border-border/50 bg-muted/30 px-1.5 py-0.5 text-[9px] text-muted-foreground font-medium">
                  {c.trigger.replace(/-/g, " ")}
                </span>
                <span className="text-[10px] text-muted-foreground/70">{c.confidence}%</span>
              </div>
              <p className="text-[11px] text-foreground/70 leading-relaxed mt-0.5">{c.reason}</p>
              {c.caveat && (
                <p className="text-[10px] text-muted-foreground/60 italic mt-0.5">{c.caveat}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <button
              onClick={() => onSelect(c.suggestedPrompt)}
              className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              <Brain className="h-3 w-3" />
              {ar ? "بحث" : "Research"}
            </button>
            <button
              onClick={() => onDismiss(c.id)}
              className="ms-auto text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              {ar ? "تجاهل" : "Dismiss"}
            </button>
          </div>
        </div>
      ))}

      <p className="text-[10px] text-muted-foreground/50 italic text-center">
        {ar
          ? "جميع الإشارات استشارية وتعليمية — لا تنفيذ تلقائي"
          : "All signals are advisory and educational — no automatic execution"}
      </p>
    </div>
  );
}

const BIAS_STYLE: Record<StrategicBias, { border: string; bg: string; text: string; dot: string }> = {
  constructive: { border: "border-success/40",  bg: "bg-success/5",  text: "text-success",          dot: "bg-success" },
  opportunistic:{ border: "border-primary/40",  bg: "bg-primary/5",  text: "text-primary",           dot: "bg-primary" },
  neutral:      { border: "border-border/40",   bg: "bg-muted/5",    text: "text-muted-foreground",  dot: "bg-muted-foreground/50" },
  defensive:    { border: "border-warning/40",  bg: "bg-warning/5",  text: "text-warning",           dot: "bg-warning" },
  uncertain:    { border: "border-border/40",   bg: "bg-muted/5",    text: "text-muted-foreground/70", dot: "bg-muted-foreground/40" },
};

const BIAS_LABEL_AR: Record<StrategicBias, string> = {
  constructive:  "بنّاء",
  opportunistic: "انتهازي",
  neutral:       "محايد",
  defensive:     "دفاعي",
  uncertain:     "غير محدد",
};

function StrategicBiasPanel({ synthesis, ar }: { synthesis: StrategicSynthesis; ar: boolean }) {
  const s = BIAS_STYLE[synthesis.bias];
  const label = ar ? BIAS_LABEL_AR[synthesis.bias] : synthesis.bias;
  const hasDrivers = synthesis.opportunityDrivers.length > 0 || synthesis.riskDrivers.length > 0;

  return (
    <div className={cn("rounded-xl border px-4 py-3 space-y-2", s.border, s.bg)}>
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full shrink-0", s.dot)} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {ar ? "التحيّز الاستراتيجي" : "Strategic Bias"}
        </span>
        <span className={cn("ms-1 rounded-md border px-2 py-0.5 text-[10px] font-bold", s.border, s.text)}>
          {label}
        </span>
        <span className="ms-auto text-[9px] text-muted-foreground/50 italic">
          {ar ? "استشاري فقط" : "Advisory only"}
        </span>
      </div>

      <p className="text-[11px] text-foreground/70 leading-relaxed">{synthesis.biasReason}</p>

      {hasDrivers && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
          {synthesis.opportunityDrivers.slice(0, 2).map((d, i) => (
            <div key={`opp-${i}`} className="flex items-start gap-1 text-success/80">
              <TrendingUp className="h-2.5 w-2.5 mt-0.5 shrink-0" />
              <span>{d}</span>
            </div>
          ))}
          {synthesis.riskDrivers.slice(0, 2).map((r, i) => (
            <div key={`risk-${i}`} className="flex items-start gap-1 text-warning/80">
              <TrendingDown className="h-2.5 w-2.5 mt-0.5 shrink-0" />
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}

      {synthesis.conflictNote && (
        <div className="flex items-start gap-1.5 text-[10px] text-warning/70 italic">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{synthesis.conflictNote}</span>
        </div>
      )}
    </div>
  );
}

function ExchangeCard({ exchange, ar, confModifier, eceVal, onConfirm, onDismiss, onDefer, onFeedback, comparisonPair }: {
  exchange: Exchange;
  ar: boolean;
  confModifier: number;
  eceVal: number;
  onConfirm: (a: GenesisSuggestedAction) => void;
  onDismiss: () => void;
  onDefer: () => void;
  onFeedback: (rating: "helpful" | "unhelpful") => void;
  comparisonPair: [string, string] | null;
}) {
  const { reply, engine, actionState, tracksUsed } = exchange;
  // ECE feedback: compress confidence toward reality when calibration error is high.
  // eceFactor ranges from 0.85 (ECE=0.3+) to 1.0 (perfectly calibrated).
  const eceFactor = eceVal > 0 ? Math.max(0.85, 1 - eceVal * 0.5) : 1;
  const displayConfidence = Math.round(Math.min(99, Math.max(1, reply.confidence * confModifier * eceFactor)));
  const effectiveLabel: "low" | "moderate" | "high" =
    displayConfidence >= 70 ? "high" : displayConfidence >= 45 ? "moderate" : "low";
  const confidenceColor = CONFIDENCE_COLOR[effectiveLabel] ?? "text-primary";

  // Phase 10: Meta-reasoning evaluation — pure client-side, only for AI replies.
  const metaResult: MetaReasoningResult | null = engine === "ai" ? evaluateReply(reply) : null;
  const qualityLabel = reply.reasoningQuality ?? (metaResult ? scoreToQuality(metaResult.reasoningScore) : null);
  const uncertaintyTier = reply.uncertaintyLevel ?? metaResult?.uncertaintyTier ?? null;
  const caveatsToShow: string[] = reply.caveats?.length
    ? reply.caveats
    : (metaResult?.contradiction.details.slice(0, 2) ?? []);

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
              {engine === "ai"
                ? (exchange.provider === "gemini" ? "Gemini AI" : exchange.provider === "lovable" ? "Lovable AI" : "AI")
                : (ar ? "محلي" : "Heuristic")}
            </span>
            {reply.researchType && (
              <span className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary ring-1 ring-primary/20">
                <BookOpen className="h-2.5 w-2.5" />
                {ar ? "بحث" : "Research"}
              </span>
            )}
            {qualityLabel && engine === "ai" && (
              <span className={cn(
                "flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ring-1",
                qualityLabel === "strong"   ? "bg-success/10 text-success ring-success/25" :
                qualityLabel === "adequate" ? "bg-primary/10 text-primary ring-primary/25" :
                                              "bg-warning/10 text-warning ring-warning/30",
              )}>
                <FlaskConical className="h-2.5 w-2.5" />
                {ar
                  ? qualityLabel === "strong" ? "استدلال قوي" : qualityLabel === "adequate" ? "استدلال كافٍ" : "استدلال ضعيف"
                  : qualityLabel}
              </span>
            )}
            {reply.marketStateQuality && engine === "ai" && (
              <span className={cn(
                "flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ring-1",
                reply.marketStateQuality === "live"    ? "bg-success/10 text-success ring-success/25" :
                reply.marketStateQuality === "partial" ? "bg-primary/10 text-primary ring-primary/25" :
                                                          "bg-muted/40 text-muted-foreground ring-border",
              )}>
                <Database className="h-2.5 w-2.5" />
                {ar
                  ? reply.marketStateQuality === "live" ? "بيانات حية" : reply.marketStateQuality === "partial" ? "جزئي" : "مستنتج"
                  : reply.marketStateQuality}
              </span>
            )}
            {tracksUsed != null && engine === "ai" && (
              <span className={cn(
                "flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ring-1",
                tracksUsed >= 5
                  ? "bg-primary/10 text-primary ring-primary/25"
                  : "bg-muted/40 text-muted-foreground ring-border",
              )}>
                <Brain className="h-2.5 w-2.5" />
                {tracksUsed >= 5
                  ? (ar ? `${tracksUsed} وكلاء` : `${tracksUsed} agents`)
                  : (ar ? `سريع ${tracksUsed}×` : `Express ${tracksUsed}×`)}
              </span>
            )}
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Confidence bar + label */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{ar ? "مستوى الثقة" : "Confidence level"}</span>
              <div className="flex items-center gap-2">
                {uncertaintyTier && engine === "ai" && (
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1",
                    uncertaintyTier === "likely"      ? "bg-success/10 text-success ring-success/25" :
                    uncertaintyTier === "possible"    ? "bg-primary/10 text-primary ring-primary/25" :
                    uncertaintyTier === "uncertain"   ? "bg-warning/10 text-warning ring-warning/30" :
                                                        "bg-destructive/10 text-destructive ring-destructive/30",
                  )}>
                    {ar
                      ? uncertaintyTier === "likely" ? "مرجّح" : uncertaintyTier === "possible" ? "محتمل" : uncertaintyTier === "uncertain" ? "غير محدد" : "متعارض"
                      : uncertaintyTier}
                  </span>
                )}
                <span className={cn("font-semibold", confidenceColor)}>
                  {effectiveLabel === "high"
                    ? (ar ? "مرتفعة" : "High")
                    : effectiveLabel === "moderate"
                      ? (ar ? "متوسطة" : "Moderate")
                      : (ar ? "منخفضة" : "Low")}
                </span>
              </div>
            </div>
            <Progress value={displayConfidence} className="h-1.5" />
            {/* Phase 10: Confidence calibration explanation */}
            {reply.confidenceCalibration && engine === "ai" && (
              <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground/80 italic">
                <Gauge className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/50" />
                <span>{reply.confidenceCalibration}</span>
              </div>
            )}
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

          {/* Phase 8: Executive Summary — top of research report */}
          {reply.executiveSummary && (
            <div className="rounded-xl border border-primary/40 bg-primary/8 px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileText className="h-3.5 w-3.5 text-primary/70" />
                <div className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                  {ar ? "الملخص التنفيذي" : "Executive Summary"}
                </div>
                <span className="ms-1 rounded-md border border-border/50 bg-muted/30 px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-bold text-muted-foreground">
                  {ar ? "تعليمي" : "Advisory"}
                </span>
              </div>
              <p className="text-sm font-medium leading-relaxed text-foreground/90">{reply.executiveSummary}</p>
            </div>
          )}

          {/* Investment thesis + reasoning */}
          {reply.thesis && (
            <div className="rounded-xl border border-primary/30 bg-primary/8 px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Brain className="h-3.5 w-3.5 text-primary/70" />
                <div className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                  {ar ? "الأطروحة الاستثمارية" : "Investment Thesis"}
                </div>
              </div>
              <p className="text-sm font-semibold leading-snug">{reply.thesis}</p>
              {reply.reasoning && (
                <p className="mt-1.5 text-xs italic text-foreground/70 leading-relaxed">{reply.reasoning}</p>
              )}
            </div>
          )}

          {/* Phase 12: Agent Arbitration Panel — per-track views + why base thesis wins */}
          {(reply.trackViewMacro || reply.trackViewTechnical || reply.trackViewCrossAsset || reply.trackViewRisk || reply.trackViewPositioning) && engine === "ai" && (
            <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-3 space-y-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Network className="h-3.5 w-3.5 text-muted-foreground/60" />
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {ar ? "رأي كل وكيل" : "Agent Views"}
                </div>
              </div>
              {reply.trackViewMacro && (
                <div className="flex items-start gap-2 text-xs">
                  <TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/50" />
                  <div>
                    <span className="font-semibold text-primary/70">{ar ? "الكلي (A): " : "Macro (A): "}</span>
                    <span className="text-foreground/80">{reply.trackViewMacro}</span>
                  </div>
                </div>
              )}
              {reply.trackViewTechnical && (
                <div className="flex items-start gap-2 text-xs">
                  <Activity className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/50" />
                  <div>
                    <span className="font-semibold text-primary/70">{ar ? "التقني (B): " : "Technical (B): "}</span>
                    <span className="text-foreground/80">{reply.trackViewTechnical}</span>
                  </div>
                </div>
              )}
              {reply.trackViewCrossAsset && (
                <div className="flex items-start gap-2 text-xs">
                  <Layers className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/50" />
                  <div>
                    <span className="font-semibold text-primary/70">{ar ? "متعدد الأصول (C): " : "Cross-Asset (C): "}</span>
                    <span className="text-foreground/80">{reply.trackViewCrossAsset}</span>
                  </div>
                </div>
              )}
              {reply.trackViewRisk && (
                <div className="flex items-start gap-2 text-xs">
                  <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning/60" />
                  <div>
                    <span className="font-semibold text-warning/70">{ar ? "المخاطر (D): " : "Risk (D): "}</span>
                    <span className="text-foreground/80">{reply.trackViewRisk}</span>
                  </div>
                </div>
              )}
              {reply.trackViewPositioning && (
                <div className="flex items-start gap-2 text-xs">
                  <Scale className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/50" />
                  <div>
                    <span className="font-semibold text-primary/70">{ar ? "التموضع (E): " : "Positioning (E): "}</span>
                    <span className="text-foreground/80">{reply.trackViewPositioning}</span>
                  </div>
                </div>
              )}
              {reply.trackViewPortfolio && (
                <div className="flex items-start gap-2 text-xs">
                  <PieChart className="h-3.5 w-3.5 mt-0.5 shrink-0 text-success/50" />
                  <div>
                    <span className="font-semibold text-success/70">{ar ? "المحفظة (F): " : "Portfolio (F): "}</span>
                    <span className="text-foreground/80">{reply.trackViewPortfolio}</span>
                  </div>
                </div>
              )}
              {reply.arbitrationReason && (
                <div className="flex items-start gap-2 rounded-lg border border-success/25 bg-success/5 px-3 py-2 text-xs mt-1">
                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-success/70" />
                  <div>
                    <span className="font-semibold text-success/80">{ar ? "لماذا تتفوق هذه الأطروحة: " : "Why this thesis wins: "}</span>
                    <span className="text-foreground/80">{reply.arbitrationReason}</span>
                  </div>
                </div>
              )}
              {reply.disagreementMap && reply.disagreementMap.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <AlertTriangle className="h-3 w-3 text-warning/60 shrink-0" />
                  {reply.disagreementMap.map((d, i) => (
                    <span key={i} className="rounded-md border border-warning/30 bg-warning/8 px-2 py-0.5 text-[10px] text-warning font-medium">
                      {d}
                    </span>
                  ))}
                </div>
              )}
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

          {/* Phase 8: Key Drivers */}
          {reply.keyDrivers && reply.keyDrivers.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                <Layers className="h-3 w-3" />
                {ar ? "المحركات الرئيسية" : "Key Drivers"}
              </div>
              <ul className="space-y-1.5">
                {reply.keyDrivers.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                    <TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/50" />
                    <span>{d}</span>
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

          {/* Catalysts to watch */}
          {reply.catalysts && reply.catalysts.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                <Zap className="h-3 w-3" />
                {ar ? "المحفزات المرتقبة" : "Catalysts to Watch"}
              </div>
              <ul className="space-y-1.5">
                {reply.catalysts.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                    <Zap className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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

          {/* Thesis invalidation condition */}
          {reply.invalidation && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <XCircle className="h-3.5 w-3.5 text-destructive/70" />
                <div className="text-[10px] uppercase tracking-wider text-destructive font-semibold">
                  {ar ? "شرط إلغاء الأطروحة" : "Thesis Invalidation"}
                </div>
              </div>
              <p className="text-sm text-foreground/90">{reply.invalidation}</p>
            </div>
          )}

          {/* Confidence drivers */}
          {reply.confidenceDrivers && reply.confidenceDrivers.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                {ar ? "محركات الثقة" : "Confidence Drivers"}
              </div>
              <ul className="space-y-1.5">
                {reply.confidenceDrivers.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                    <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-success/60" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Phase 8: Watch Items */}
          {reply.watchItems && reply.watchItems.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {ar ? "عناصر المراقبة" : "Watch Items"}
              </div>
              <ul className="space-y-1.5">
                {reply.watchItems.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                    <Eye className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning/60" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Phase 8: Comparison Table */}
          {reply.comparisonTable && reply.comparisonTable.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                <Scale className="h-3 w-3" />
                {ar ? "جدول المقارنة" : "Comparison Table"}
                {comparisonPair && (
                  <span className="ms-1 font-mono text-[10px] text-primary/70">
                    {comparisonPair[0]} vs {comparisonPair[1]}
                  </span>
                )}
              </div>
              <div className="rounded-xl border border-border/40 overflow-hidden">
                {comparisonPair && (
                  <div className="grid grid-cols-3 border-b border-border/40 bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <div className="px-3 py-1.5">{ar ? "المقياس" : "Metric"}</div>
                    <div className="px-3 py-1.5 border-l border-border/30 text-primary/80">{comparisonPair[0]}</div>
                    <div className="px-3 py-1.5 border-l border-border/30 text-primary/80">{comparisonPair[1]}</div>
                  </div>
                )}
                {reply.comparisonTable.map((row, i) => (
                  <div
                    key={i}
                    className={cn(
                      "grid grid-cols-3 text-xs",
                      i > 0 && "border-t border-border/30",
                      i % 2 === 0 ? "bg-background/40" : "bg-muted/10",
                    )}
                  >
                    <div className="px-3 py-2 font-medium text-muted-foreground">{row.metric}</div>
                    <div className="px-3 py-2 text-foreground/90 border-l border-border/30">{row.a}</div>
                    <div className="px-3 py-2 text-foreground/90 border-l border-border/30">{row.b}</div>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] italic text-muted-foreground/60">
                {ar ? "للأغراض التعليمية — لا يُعتمد كأساس للتداول." : "Educational comparison only — not a basis for trading decisions."}
              </p>
            </div>
          )}

          {/* View change condition */}
          {reply.viewChange && (
            <div className="flex items-start gap-2 rounded-xl border border-border/50 bg-muted/20 px-4 py-2.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <div>
                <span className="font-semibold text-muted-foreground">{ar ? "تغيير الرأي: " : "View change: "}</span>
                <span className="text-foreground/80">{reply.viewChange}</span>
              </div>
            </div>
          )}

          {/* Phase 7: Scenario simulation output */}
          {reply.simulatedScenario && (
            <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-primary/70" />
                <div className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                  {ar ? "محاكاة السيناريو" : "Scenario Simulation"}
                </div>
                <span className="ms-1 rounded-md border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-bold text-warning">
                  {ar ? "تعليمي" : "Advisory"}
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground/90">{reply.simulatedScenario}</p>
              {reply.expectedImpact && (
                <p className="text-sm text-foreground/80 leading-relaxed">{reply.expectedImpact}</p>
              )}
              {reply.watchlistSensitivity && (
                <div className="flex items-start gap-2 text-xs text-foreground/80">
                  <PieChart className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
                  <span><span className="font-semibold text-primary/80">{ar ? "محفظتك: " : "Your watchlist: "}</span>{reply.watchlistSensitivity}</span>
                </div>
              )}
              {reply.thesisSensitivity && (
                <div className="flex items-start gap-2 text-xs text-foreground/80">
                  <Brain className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
                  <span><span className="font-semibold text-primary/80">{ar ? "الأطروحات: " : "Theses: "}</span>{reply.thesisSensitivity}</span>
                </div>
              )}
            </div>
          )}

          {/* Phase 6: Multi-agent synthesis — supporting / opposing / consensus */}
          {(reply.supportingCase || reply.opposingCase || reply.consensusStrength) && (
            <div className="space-y-2">
              {/* Consensus strength badge */}
              {reply.consensusStrength && (
                <div className="flex items-center gap-2">
                  <Scale className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {ar ? "إجماع الوكلاء:" : "Agent consensus:"}
                  </span>
                  <span className={cn(
                    "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    reply.consensusStrength === "strong"    ? "bg-success/10 text-success ring-1 ring-success/25" :
                    reply.consensusStrength === "moderate"  ? "bg-primary/10 text-primary ring-1 ring-primary/25" :
                    reply.consensusStrength === "weak"      ? "bg-muted/40 text-muted-foreground ring-1 ring-border/40" :
                    "bg-warning/10 text-warning ring-1 ring-warning/30",
                  )}>
                    {ar
                      ? reply.consensusStrength === "strong" ? "قوي"
                        : reply.consensusStrength === "moderate" ? "معتدل"
                        : reply.consensusStrength === "weak" ? "ضعيف" : "متعارض"
                      : reply.consensusStrength}
                  </span>
                  {reply.disagreementNote && (
                    <span className="flex items-center gap-1 text-[10px] text-warning">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {reply.disagreementNote}
                    </span>
                  )}
                </div>
              )}

              {/* Strongest supporting case */}
              {reply.supportingCase && (
                <div className="flex items-start gap-2 rounded-xl border border-success/25 bg-success/5 px-3 py-2 text-xs">
                  <TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0 text-success/70" />
                  <div>
                    <span className="font-semibold text-success/80">{ar ? "أقوى الحجج الداعمة: " : "Supporting case: "}</span>
                    <span className="text-foreground/80">{reply.supportingCase}</span>
                  </div>
                </div>
              )}

              {/* Devil's advocate — strongest opposing case */}
              {reply.opposingCase && (
                <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning/5 px-3 py-2 text-xs">
                  <TrendingDown className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning/70" />
                  <div>
                    <span className="font-semibold text-warning/80">{ar ? "محامي الشيطان: " : "Devil's advocate: "}</span>
                    <span className="text-foreground/80">{reply.opposingCase}</span>
                  </div>
                </div>
              )}

              {/* Phase 11: Cross-asset confirmation (Track C) */}
              {reply.crossAssetConfirmation && (
                <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                  <Layers className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
                  <div>
                    <span className="font-semibold text-primary/80">{ar ? "تأكيد الأصول المتقاطعة: " : "Cross-asset confirmation: "}</span>
                    <span className="text-foreground/80">{reply.crossAssetConfirmation}</span>
                  </div>
                </div>
              )}

              {/* Phase 11: Positioning signal (Track E) */}
              {reply.positioningSignal && (
                <div className="flex items-start gap-2 rounded-xl border border-muted/50 bg-muted/20 px-3 py-2 text-xs">
                  <Scale className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
                  <div>
                    <span className="font-semibold text-muted-foreground">{ar ? "إشارة التموضع: " : "Positioning signal: "}</span>
                    <span className="text-foreground/80">{reply.positioningSignal}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Uncertainty warning — explains WHY confidence is low (set by institutional brain) */}
          {reply.uncertaintyWarning && (
            <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-2.5 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{reply.uncertaintyWarning}</span>
            </div>
          )}

          {/* Phase 10: Caveats / contradiction detection — logical tensions in own reasoning */}
          {caveatsToShow.length > 0 && engine === "ai" && (
            <div className="rounded-xl border border-warning/25 bg-warning/5 px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldAlert className="h-3.5 w-3.5 text-warning/70" />
                <div className="text-[10px] uppercase tracking-wider text-warning font-semibold">
                  {ar ? "تحفظات منطقية" : "Reasoning Caveats"}
                </div>
                {metaResult?.overconfidenceRisk && (
                  <span className="ms-auto rounded-md border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[9px] font-bold text-warning uppercase tracking-wide">
                    {ar ? "خطر الثقة المبالغ فيها" : "Overconfidence risk"}
                  </span>
                )}
              </div>
              <ul className="space-y-1.5">
                {caveatsToShow.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-warning/60" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Phase 10: Overconfidence flag without caveats (stand-alone warning) */}
          {metaResult?.overconfidenceRisk && caveatsToShow.length === 0 && engine === "ai" && (
            <div className="flex items-center gap-2 rounded-xl border border-warning/25 bg-warning/5 px-4 py-2 text-xs text-warning">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              {ar
                ? `مراجعة الثقة: ${displayConfidence}% قد يعكس ثقة مبالغاً فيها نسبة للأدلة المتاحة`
                : `Confidence review: ${displayConfidence}% may reflect overconfidence relative to available evidence`}
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

function MemoryStat({ label, value, highlight }: { label: string; value: string; highlight?: "warning" | "success" }) {
  return (
    <div className={cn(
      "rounded-lg border p-2.5 text-center",
      highlight === "warning" ? "border-warning/30 bg-warning/5" :
      highlight === "success" ? "border-success/30 bg-success/5" :
      "border-border/40 bg-muted/20",
    )}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={cn("mt-0.5 text-sm font-bold",
        highlight === "warning" ? "text-warning" :
        highlight === "success" ? "text-success" :
        "text-foreground",
      )}>
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

// ─── Coordination Panel — Phase 11 ──────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  safety:             "text-destructive",
  contradiction:      "text-destructive",
  confidence_warning: "text-warning",
  thesis:             "text-primary",
  portfolio:          "text-primary",
  regime:             "text-warning",
  standard:           "text-muted-foreground",
};

function CoordinationPanel({ result, ar }: { result: CoordinationResult; ar: boolean }) {
  const boosted    = Object.entries(result.routingDecision).filter(([, v]) => v === "boosted").map(([k]) => k);
  const suppressed = Object.entries(result.routingDecision).filter(([, v]) => v === "suppressed").map(([k]) => k);
  const hasActivity = result.prioritySignal !== "standard" || result.conflicts.length > 0 || boosted.length > 0;
  if (!hasActivity) return null;

  const priorityColor = PRIORITY_COLOR[result.prioritySignal] ?? "text-muted-foreground";

  return (
    <div className="mb-4 rounded-xl border border-border/40 bg-card/30 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
        <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-muted-foreground">
          <Layers className="h-3 w-3 shrink-0" />
          {ar ? "تنسيق الاستخبارات" : "Intelligence Coord"}
        </div>

        <span className={cn("font-semibold", priorityColor)}>
          {result.prioritySignal.replace(/_/g, "-")}
        </span>

        {result.conflicts.length > 0 && (
          <>
            <span className="text-border/80">|</span>
            <span className="flex items-center gap-1 text-warning">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {result.conflicts.length} {ar
                ? "تعارض"
                : `conflict${result.conflicts.length > 1 ? "s" : ""}`}
            </span>
          </>
        )}

        {boosted.length > 0 && (
          <>
            <span className="text-border/80">|</span>
            <span className="text-success font-medium">
              {ar ? "مُعزَّز:" : "boosted:"} {boosted.slice(0, 3).join(", ")}
            </span>
          </>
        )}

        {suppressed.length > 0 && (
          <>
            <span className="text-border/80">|</span>
            <span className="text-muted-foreground/60">
              {ar ? "مخفَّض:" : "suppressed:"} {suppressed.slice(0, 2).join(", ")}
            </span>
          </>
        )}
      </div>

      {result.coordinationNote && (
        <div className="mt-1.5 flex items-start gap-1.5 text-[10px] text-muted-foreground/80 italic">
          <Brain className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/50" />
          <span>{result.coordinationNote}</span>
        </div>
      )}
    </div>
  );
}

// ─── Market Intelligence Panel ───────────────────────────────────────────────

const REGIME_COLOR: Record<string, string> = {
  risk_on:  "text-success",
  risk_off: "text-destructive",
  volatile: "text-warning",
  mixed:    "text-warning",
  neutral:  "text-muted-foreground",
};

const STRESS_COLOR: Record<string, string> = {
  low:      "text-success",
  moderate: "text-primary",
  elevated: "text-warning",
  high:     "text-destructive",
};

// ─── Scenario Simulation Panel (pre-submission, regime-based) ─────────────────

const PROB_COLOR: Record<string, string> = {
  low:      "text-muted-foreground",
  moderate: "text-warning",
  high:     "text-destructive",
};

function ScenarioSimPanel({ sim, ar }: { sim: ScenarioSimResult; ar: boolean }) {
  const top = sim.topScenarios.slice(0, 2);
  if (!top.length) return null;

  return (
    <div className="mb-4 rounded-xl border border-border/40 bg-card/30 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
        {/* Label */}
        <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-muted-foreground">
          <Zap className="h-3 w-3 shrink-0" />
          {ar ? "سيناريوهات الماكرو" : "Macro Scenarios"}
        </div>

        {top.map((scenario, i) => (
          <span key={scenario.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-border/80">|</span>}
            <span className="font-medium text-foreground/80">{scenario.label}</span>
            <span className={cn("font-normal", PROB_COLOR[scenario.probability] ?? "text-muted-foreground")}>
              ({scenario.probability})
            </span>
            <span className="ms-0.5 font-normal text-muted-foreground/70 font-mono text-[10px]">
              {scenario.impactSummary}
            </span>
          </span>
        ))}

        {/* Top scenario watchlist sensitivity */}
        {top[0]?.watchlistImpacts.some((w) => w.impact !== 0) && (
          <>
            <span className="text-border/80">|</span>
            <span className="flex items-center gap-1 text-muted-foreground/80">
              <PieChart className="h-3 w-3 shrink-0" />
              {top[0].watchlistImpacts
                .filter((w) => w.impact !== 0)
                .slice(0, 4)
                .map((w) => (
                  <span
                    key={w.symbol}
                    className={cn(
                      "font-medium",
                      w.direction === "positive" ? "text-success" :
                      w.direction === "negative" ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {w.symbol}
                  </span>
                ))}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Portfolio Brain Panel ────────────────────────────────────────────────────

function PortfolioBrainPanel({ intel, ar }: { intel: PortfolioIntelSummary; ar: boolean }) {
  const hasWarning = intel.riskOverlap.detected || !intel.regimeAlignment.aligned;
  const topCats = intel.categoryExposure.slice(0, 3);

  return (
    <div className="mb-4 rounded-xl border border-border/40 bg-card/30 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
        {/* Label */}
        <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-muted-foreground">
          <PieChart className="h-3 w-3 shrink-0" />
          {ar ? "دماغ المحفظة" : "Portfolio Brain"}
        </div>

        {/* Category breakdown */}
        {topCats.map((e) => (
          <span key={e.category} className="text-foreground/80 font-medium">
            {e.category}
            <span className="ms-0.5 font-normal text-muted-foreground/70">{e.weightPct}%</span>
          </span>
        ))}

        {/* Concentration badge */}
        {intel.concentrationScore > 50 && (
          <>
            <span className="text-border/80">|</span>
            <span className={cn(
              "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
              intel.concentrationScore > 75
                ? "bg-destructive/10 text-destructive ring-1 ring-destructive/20"
                : "bg-warning/10 text-warning ring-1 ring-warning/20",
            )}>
              {ar ? "تركيز" : "conc"} {intel.concentrationScore}/100
            </span>
          </>
        )}

        {/* Risk overlap warning */}
        {intel.riskOverlap.detected && (
          <>
            <span className="text-border/80">|</span>
            <span className="flex items-center gap-1 text-warning">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {intel.riskOverlap.description}
            </span>
          </>
        )}

        {/* Regime alignment */}
        {intel.regimeAlignment.note && (
          <>
            <span className="text-border/80">|</span>
            <span className={cn(
              "flex items-center gap-1",
              intel.regimeAlignment.aligned ? "text-success" : "text-warning",
            )}>
              {!intel.regimeAlignment.aligned && <AlertTriangle className="h-3 w-3 shrink-0" />}
              {intel.regimeAlignment.note}
            </span>
          </>
        )}

        {/* Thesis match count */}
        {intel.relevantThesisCount > 0 && (
          <>
            <span className="text-border/80">|</span>
            <span className="flex items-center gap-1 text-primary font-medium">
              <Brain className="h-3 w-3 shrink-0" />
              {intel.relevantThesisCount} {ar ? "أطروحة" : `thesis match${intel.relevantThesisCount > 1 ? "es" : ""}`}
            </span>
          </>
        )}

        {/* All-clear when no warnings */}
        {!hasWarning && !intel.regimeAlignment.note && (
          <>
            <span className="text-border/80">|</span>
            <span className="text-success text-[10px] font-medium">
              {ar ? "تنويع جيد" : "diversified"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function MarketIntelPanel({ intel, ar }: { intel: MarketIntelSummary; ar: boolean }) {
  const regimeColor = REGIME_COLOR[intel.regime] ?? "text-muted-foreground";
  const stressColor = STRESS_COLOR[intel.stressLevel] ?? "text-muted-foreground";
  const riskDir =
    intel.riskOnScore > 15 ? "risk-on" :
    intel.riskOnScore < -15 ? "risk-off" : "neutral";

  return (
    <div className="mb-4 rounded-xl border border-border/40 bg-card/30 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
        {/* Label */}
        <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-muted-foreground">
          <Activity className="h-3 w-3 shrink-0" />
          {ar ? "استخبارات السوق" : "Market Intel"}
        </div>

        {/* Regime */}
        <span className={cn("font-semibold", regimeColor)}>
          {intel.regime.replace(/_/g, "-")}
          <span className="ms-1 font-normal text-muted-foreground/70">{intel.regimeConf}%</span>
        </span>

        {/* Regime transition warning */}
        {intel.regimeTransition && (
          <span className="flex items-center gap-1 text-warning">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {ar ? "تحول نظام" : "regime shift"}
          </span>
        )}

        <span className="text-border/80">|</span>

        {/* Stress */}
        <span className={cn("font-medium", stressColor)}>
          {ar ? "ضغط" : "stress"} {intel.stressScore}/100
        </span>

        {/* Risk-on/off badge */}
        <span className={cn(
          "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
          riskDir === "risk-on"  ? "bg-success/10 text-success ring-1 ring-success/20" :
          riskDir === "risk-off" ? "bg-destructive/10 text-destructive ring-1 ring-destructive/20" :
          "bg-muted/40 text-muted-foreground ring-1 ring-border/40",
        )}>
          {riskDir}
        </span>

        {/* Breadth */}
        <span className="text-muted-foreground">
          {intel.breadth.bullN}↑ {intel.breadth.bearN}↓ / {intel.breadth.total}
        </span>

        {/* Rotation signal */}
        {intel.rotation.signal !== "none" && (
          <>
            <span className="text-border/80">|</span>
            <span className="text-primary font-medium">
              {intel.rotation.signal.replace(/_/g, " ")}
              {intel.rotation.leading.length > 0 && (
                <span className="ms-1 font-normal text-muted-foreground/70">
                  ({intel.rotation.leading.join(", ")})
                </span>
              )}
            </span>
          </>
        )}

        {/* Divergence warning */}
        {intel.divergence.detected && (
          <>
            <span className="text-border/80">|</span>
            <span className="flex items-center gap-1 text-warning">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {intel.divergence.description}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
