/**
 * Proactive Research Engine — Phase 21
 * Pure function — no network calls, no side effects, no AI calls, no localStorage.
 * Generates advisory research candidates from existing session/watchlist/market data.
 *
 * Design rules:
 * - Advisory only: all language uses "potential", "may", "watch condition", never "buy/sell now"
 * - No execution: suggestedAction types are analyze_asset | create_alert | add_watchlist |
 *   summarize_portfolio | navigate | none — no broker or order actions
 * - Max 4 candidates, deduplicated by asset, sorted by severity
 * - Fires on watchlist+market data changes via useMemo — no background polling
 */

import type { WatchlistAsset } from "@/lib/watchlistStore";
import type { ThesisEntry } from "@/services/learning/thesisMemory";
import type { IntelligenceEvent } from "@/services/learning/sessionIntelStore";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AssetMovement {
  symbol: string;
  changePct: number;
  category: string;
}

export interface PortfolioAlignmentInput {
  aligned: boolean;
  note: string;
}

export type ResearchTrigger =
  | "significant-move"
  | "oil-fiscal-stress"
  | "gold-haven-conflict"
  | "btc-liquidity-weakness"
  | "thesis-regime-conflict"
  | "portfolio-misalignment";

export interface ResearchCandidate {
  id: string;
  asset: string;
  trigger: ResearchTrigger;
  reason: string;           // advisory explanation — educational language only
  confidence: number;       // 0-100: signal strength (not a price target)
  invalidation: string | null;
  caveat: string | null;
  suggestedPrompt: string;  // pre-written question to populate genesis input — user decides to send
  suggestedAction: {
    type: "analyze_asset" | "create_alert" | "add_watchlist" | "summarize_portfolio" | "navigate" | "none";
    label: string;
    symbol?: string;
    route?: string;
  };
  severity: "high" | "medium" | "low";
}

export interface ProactiveInput {
  assets: AssetMovement[];
  watchlistItems: WatchlistAsset[];
  theses: ThesisEntry[];
  sessionBus: IntelligenceEvent | null;
  portfolioAlignment: PortfolioAlignmentInput | null;
  portfolioHasContext: boolean; // true when portfolioIntel.compactContext is non-empty
  ar: boolean;
}

// ─── Severity rank helper ─────────────────────────────────────────────────────

const SEV_RANK: Record<ResearchCandidate["severity"], number> = { high: 3, medium: 2, low: 1 };

// ─── Signal detectors (pure functions) ───────────────────────────────────────

function detectOilFiscalStress(
  assets: AssetMovement[],
  watchlistItems: WatchlistAsset[],
  ar: boolean,
): ResearchCandidate | null {
  const oil = assets.find((a) => /^(OIL|WTI|CL=F|BRT|BRENT|CL\b)/i.test(a.symbol));
  if (!oil || oil.changePct > -2) return null;
  const hasSaudi = watchlistItems.some((w) => /^(2222|SABIC|TASI|ARNB|STC|2010|1010|NLB)/i.test(w.symbol));
  if (!hasSaudi) return null;

  return {
    id: "oil-fiscal",
    asset: "2222.SR",
    trigger: "oil-fiscal-stress",
    severity: oil.changePct <= -3.5 ? "high" : "medium",
    confidence: 60,
    reason: ar
      ? `النفط ينخفض ${oil.changePct.toFixed(1)}% — ضغط محتمل على الفضاء المالي السعودي (breakeven ~75-80 دولار). أرامكو ومؤشر تاسي قد يواجهان عائقاً عبر قناة الإيرادات الحكومية.`
      : `Oil down ${oil.changePct.toFixed(1)}% — potential Saudi fiscal space pressure (breakeven ~$75-80/bbl). Aramco and TASI holdings may face headwind via government spending and Aramco earnings channel.`,
    invalidation: ar
      ? "استقرار النفط فوق 78 دولاراً"
      : "Oil stabilising above $78/bbl",
    caveat: ar
      ? "تحليل تعليمي استشاري — ليس توصية تنفيذية."
      : "Advisory and educational — not an execution recommendation.",
    suggestedPrompt: ar
      ? "كيف يؤثر تراجع أسعار النفط الحالي على الوضع المالي السعودي وتوقعات مؤشر تاسي عبر قناة أرامكو؟"
      : "How does the current oil price decline affect the Saudi fiscal position and TASI outlook via the Aramco earnings and government spending channel?",
    suggestedAction: {
      type: "analyze_asset",
      label: ar ? "تحليل أرامكو / تاسي" : "Analyze Aramco / TASI",
      symbol: "2222.SR",
    },
  };
}

function detectGoldHavenConflict(
  assets: AssetMovement[],
  sessionBus: IntelligenceEvent | null,
  ar: boolean,
): ResearchCandidate | null {
  const gold = assets.find((a) => /^(XAU|GOLD|PAXG|GC=F)/i.test(a.symbol));
  if (!gold || gold.changePct < 0.5) return null;
  const isRiskOn =
    sessionBus?.dominantBias === "bullish" ||
    sessionBus?.regime?.includes("risk_on") ||
    sessionBus?.regime?.includes("bull_trending");
  if (!isRiskOn) return null;

  return {
    id: "gold-haven",
    asset: "XAU",
    trigger: "gold-haven-conflict",
    severity: gold.changePct >= 1.5 ? "high" : "medium",
    confidence: 56,
    reason: ar
      ? `الذهب يرتفع +${gold.changePct.toFixed(1)}% بينما التحيّز الجلسة يميل للصعود — تباين محتمل بين ملاذ آمن ونظام risk-on. إشارة مراجعة نظام السوق.`
      : `Gold +${gold.changePct.toFixed(1)}% while session bias is risk-on — potential safe-haven vs risk-on regime conflict worth reviewing for macro thesis implications.`,
    invalidation: ar
      ? "تراجع الذهب وعودة الأسهم لزخمها الصاعد"
      : "Gold reverting as equities regain upward momentum",
    caveat: ar
      ? "قد يكون الذهب في نمط ضغط أسعار حقيقية (real-rate compression) لا ملاذاً آمناً."
      : "Gold may be in real-rate compression mode rather than safe-haven mode — these imply different macro conclusions.",
    suggestedPrompt: ar
      ? "الذهب يرتفع بينما التحيّز الكلي يميل للصعود — هل هذا نمط ضغط الأسعار الحقيقية أم ملاذ آمن؟ ما دلالته على الأطروحة الكلية؟"
      : `Gold is up ${gold.changePct.toFixed(1)}% while the macro bias appears risk-on — is this a real-rate compression signal or a safe-haven bid, and what does the divergence imply for the macro thesis?`,
    suggestedAction: {
      type: "analyze_asset",
      label: ar ? "تحليل الذهب" : "Analyze Gold",
      symbol: "XAU",
    },
  };
}

function detectBtcLiquidityWeakness(
  assets: AssetMovement[],
  watchlistItems: WatchlistAsset[],
  sessionBus: IntelligenceEvent | null,
  ar: boolean,
): ResearchCandidate | null {
  const btc = assets.find((a) => /^BTC/i.test(a.symbol));
  if (!btc || btc.changePct > -3) return null;
  // Upgrade severity if session was risk-on (adds surprise factor)
  const wasRiskOn = sessionBus?.dominantBias === "bullish";
  const btcWatched = watchlistItems.some((w) => /^BTC/i.test(w.symbol));

  return {
    id: "btc-liquidity",
    asset: "BTC",
    trigger: "btc-liquidity-weakness",
    severity: btc.changePct <= -5 || (wasRiskOn && btcWatched) ? "high" : "medium",
    confidence: 54,
    reason: ar
      ? `BTC ينخفض ${btc.changePct.toFixed(1)}% — إشارة وكيل سيولة محتملة تشير لتشديد في شهية المخاطرة. يستحق مراجعة توافق المحفظة مع النظام الكلي.`
      : `BTC down ${btc.changePct.toFixed(1)}% — potential liquidity-proxy signal indicating tightening risk appetite. Portfolio regime alignment may warrant review.`,
    invalidation: ar
      ? "استقرار BTC فوق مستوى الدعم البنيوي"
      : "BTC stabilising above its structural support level",
    caveat: ar
      ? "قد يكون BTC في نمط تخفيف مخاطر لا في نمط انهيار سيولة."
      : "BTC may be in asset-specific derisking mode rather than a systemic liquidity signal.",
    suggestedPrompt: ar
      ? `BTC ينخفض ${btc.changePct.toFixed(1)}% — هل هذا نمط وكيل سيولة يشير لتشديد شهية المخاطرة عالمياً؟ ما انعكاساته على التحليل الكلي والمحفظة؟`
      : `BTC is down ${btc.changePct.toFixed(1)}% — is this a liquidity-proxy signal indicating tightening global risk appetite, and what are the implications for the macro outlook and portfolio positioning?`,
    suggestedAction: {
      type: "analyze_asset",
      label: ar ? "تحليل BTC" : "Analyze BTC",
      symbol: "BTC",
    },
  };
}

function detectThesisRegimeConflict(
  theses: ThesisEntry[],
  sessionBus: IntelligenceEvent | null,
  watchlistItems: WatchlistAsset[],
  ar: boolean,
): ResearchCandidate | null {
  if (!sessionBus?.dominantBias) return null;
  const watchedSymbols = new Set(watchlistItems.map((w) => w.symbol.toUpperCase()));
  const now = Date.now();
  const MAX_AGE_MS = 7 * 24 * 60 * 60_000; // 7 days — ignore very stale theses
  const sBias = sessionBus.dominantBias;

  const conflict = theses
    .filter((t) => {
      if (t.asset === "MARKET") return false;
      if (now - t.ts > MAX_AGE_MS) return false;
      if (!watchedSymbols.has(t.asset.toUpperCase())) return false;
      return (
        (t.direction === "bullish" && sBias === "bearish") ||
        (t.direction === "bearish" && sBias === "bullish")
      );
    })
    .sort((a, b) => b.ts - a.ts)[0];

  if (!conflict) return null;

  const ageDays = (now - conflict.ts) / 86400000;
  const ageStr =
    ageDays < 1 ? (ar ? "اليوم" : "today") :
    ageDays < 2 ? (ar ? "أمس" : "yesterday") :
    ar ? `منذ ${Math.round(ageDays)} يوم` : `${Math.round(ageDays)}d ago`;
  const conflictBias = sBias === "bearish" ? (ar ? "هابط" : "bearish") : (ar ? "صاعد" : "bullish");
  const priorBias = conflict.direction === "bullish" ? (ar ? "صاعد" : "bullish") : (ar ? "هابط" : "bearish");

  return {
    id: `thesis-conflict-${conflict.asset}`,
    asset: conflict.asset,
    trigger: "thesis-regime-conflict",
    severity: "medium",
    confidence: 52,
    reason: ar
      ? `الأطروحة السابقة لـ${conflict.asset} (${priorBias}، ${conflict.confidence}%، ${ageStr}) قد تتعارض مع التحيّز الكلي الحالي (${conflictBias}). مراجعة الأطروحة موصى بها.`
      : `Prior ${conflict.asset} thesis (${priorBias}, ${conflict.confidence}%, ${ageStr}) may conflict with current ${conflictBias} regime bias — thesis revision may be warranted.`,
    invalidation: conflict.invalidation ?? null,
    caveat: ar
      ? "التعارض قد يعكس نظاماً انتقالياً وليس خطأً في الأطروحة."
      : "Conflict may reflect a transitional regime rather than a thesis error.",
    suggestedPrompt: ar
      ? `مراجعة الأطروحة على ${conflict.asset} في ضوء التحيّز الكلي الحالي (${conflictBias}) — هل الرأي السابق لا يزال صالحاً أم يستدعي التحديث؟`
      : `Review the ${conflict.asset} thesis in light of the current ${conflictBias} macro regime bias — does the prior view still hold, or has the evidence shifted enough to warrant a revision?`,
    suggestedAction: {
      type: "analyze_asset",
      label: ar ? `مراجعة ${conflict.asset}` : `Review ${conflict.asset}`,
      symbol: conflict.asset,
    },
  };
}

function detectSignificantMoves(
  assets: AssetMovement[],
  watchlistItems: WatchlistAsset[],
  ar: boolean,
): ResearchCandidate[] {
  const THRESHOLD = 3.5;
  // Already covered by dedicated detectors — skip these tickers to avoid duplicates
  const SKIP = /^(BTC|XAU|GOLD|PAXG|OIL|WTI|CL=F|BRT|BRENT)/i;
  const result: ResearchCandidate[] = [];

  for (const item of watchlistItems.slice(0, 8)) {
    const data = assets.find((a) => a.symbol.toUpperCase() === item.symbol.toUpperCase());
    if (!data || Math.abs(data.changePct) < THRESHOLD) continue;
    if (SKIP.test(item.symbol)) continue;

    const sign = data.changePct >= 0 ? "+" : "";
    result.push({
      id: `move-${item.symbol}`,
      asset: item.symbol,
      trigger: "significant-move",
      severity: Math.abs(data.changePct) >= 5 ? "high" : "medium",
      confidence: 50,
      reason: ar
        ? `${item.symbol} يتحرك ${sign}${data.changePct.toFixed(1)}% — حركة ملحوظة تستحق المراجعة في ضوء الأطروحة القائمة والنظام الكلي.`
        : `${item.symbol} moved ${sign}${data.changePct.toFixed(1)}% — notable movement worth reviewing in the context of the current macro regime and existing thesis.`,
      invalidation: null,
      caveat: ar
        ? "تحليل تعليمي فقط — ليس توصية تنفيذية."
        : "Educational analysis only — not an execution recommendation.",
      suggestedPrompt: ar
        ? `حلّل الحركة الأخيرة في ${item.symbol} — هل تتوافق مع النظام الكلي والأطروحة القائمة أم تشير إلى تباين يستحق المراقبة؟`
        : `Analyze the recent ${sign}${data.changePct.toFixed(1)}% move in ${item.symbol} — is it consistent with the current macro regime and existing thesis, or does it signal a divergence worth monitoring?`,
      suggestedAction: {
        type: "analyze_asset",
        label: ar ? `تحليل ${item.symbol}` : `Analyze ${item.symbol}`,
        symbol: item.symbol,
      },
    });
  }
  return result;
}

function detectPortfolioMisalignment(
  alignment: PortfolioAlignmentInput | null,
  hasContext: boolean,
  ar: boolean,
): ResearchCandidate | null {
  if (!alignment || alignment.aligned || !hasContext) return null;
  return {
    id: "portfolio-misalign",
    asset: "PORTFOLIO",
    trigger: "portfolio-misalignment",
    severity: "low",
    confidence: 48,
    reason: ar
      ? `المحفظة قد لا تتوافق مع النظام الكلي الحالي — ${alignment.note || "مراجعة التخصيص موصى بها."}`
      : `Portfolio may not be aligned with the current macro regime — ${alignment.note || "allocation review may be advisable."}`,
    invalidation: null,
    caveat: ar
      ? "تقييم المحاذاة استشاري فقط."
      : "Alignment assessment is advisory only.",
    suggestedPrompt: ar
      ? "راجع توافق محفظتي مع النظام الكلي الحالي — أي المراكز أكثر عرضة للخطر؟"
      : "Review my watchlist portfolio alignment with the current macro regime — which positions carry the most regime-driven risk?",
    suggestedAction: {
      type: "summarize_portfolio",
      label: ar ? "مراجعة المحفظة" : "Review portfolio",
    },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Computes proactive research candidates from existing session data.
 * Pure function — no side effects, no I/O, deterministic.
 * Returns at most 4 candidates, deduplicated by asset, sorted high → low severity.
 */
export function computeProactiveResearch(input: ProactiveInput): ResearchCandidate[] {
  const { assets, watchlistItems, theses, sessionBus, portfolioAlignment, portfolioHasContext, ar } = input;

  const raw: ResearchCandidate[] = [
    detectOilFiscalStress(assets, watchlistItems, ar),
    detectGoldHavenConflict(assets, sessionBus, ar),
    detectBtcLiquidityWeakness(assets, watchlistItems, sessionBus, ar),
    detectThesisRegimeConflict(theses, sessionBus, watchlistItems, ar),
    ...detectSignificantMoves(assets, watchlistItems, ar),
    detectPortfolioMisalignment(portfolioAlignment, portfolioHasContext, ar),
  ].filter(Boolean) as ResearchCandidate[];

  // Deduplicate by asset: keep highest severity per asset
  const deduped = new Map<string, ResearchCandidate>();
  for (const c of raw) {
    const existing = deduped.get(c.asset);
    if (!existing || SEV_RANK[c.severity] > SEV_RANK[existing.severity]) {
      deduped.set(c.asset, c);
    }
  }

  return [...deduped.values()]
    .sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.confidence - a.confidence)
    .slice(0, 4);
}
