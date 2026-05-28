/**
 * Portfolio Risk Intelligence Engine — Phase 27
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Extends existing portfolioIntelEngine with:
 *  - Portfolio risk classification (balanced/concentrated/defensive/growth_sensitive/macro_vulnerable/unclear)
 *  - Stress vulnerability mapping from Phase-21 proactive signals
 *  - Dominant vulnerability identification
 *  - Hedge presence detection
 *  - Compact context string for AI portfolioImpact enrichment
 *
 * Design rules:
 * - No fake precision: uses category-level qualitative risk when only watchlist exists
 * - No execution language: risk is advisory — monitor/review/investigate only
 * - unclear is the default when watchlist is empty or data is insufficient
 * - Conservative: vulnerability only flagged when active proactive signal confirms it
 */

import type { WatchlistAsset } from "@/lib/watchlistStore";
import type { PortfolioIntelSummary } from "@/services/portfolio/portfolioIntelEngine";
import type { ResearchCandidate } from "@/services/research/proactiveEngine";

// ─── Types ───────────────────────────────────────────────────────────────────

export type PortfolioRiskLabel =
  | "balanced"          // diverse categories, no dominant stress, no regime conflict
  | "concentrated"      // single-category dominance >60%
  | "defensive"         // commodities + fx ≥ 50% — safe-haven/defensive posture
  | "growth_sensitive"  // crypto + US equities ≥ 65% — high-beta risk exposure
  | "macro_vulnerable"  // saudi ≥ 25% + active oil/DXY stress signal
  | "unclear";          // empty watchlist or insufficient data

export interface StressedExposure {
  category: WatchlistAsset["category"];
  trigger: string;  // which proactive signal triggered this
  note: string;     // 1-sentence advisory description
}

export interface PortfolioRiskResult {
  riskLabel: PortfolioRiskLabel;
  dominantVulnerability: string | null;  // most actionable risk note
  stressedExposures: StressedExposure[];
  hedgeNote: string | null;              // defensive offset if present
  riskContext: string;                   // compact ≤180 chars for AI injection
  riskLabelNote: string;                 // 1-sentence advisory for UI
  hasActiveVulnerability: boolean;
}

// ─── Category helpers ─────────────────────────────────────────────────────────

function categoryPct(items: WatchlistAsset[], cat: WatchlistAsset["category"]): number {
  if (!items.length) return 0;
  return items.filter((a) => a.category === cat).length / items.length;
}

function hasSymbol(items: WatchlistAsset[], pattern: RegExp): boolean {
  return items.some((a) => pattern.test(a.symbol));
}

// ─── Risk label derivation ────────────────────────────────────────────────────

function deriveRiskLabel(
  items: WatchlistAsset[],
  intel: PortfolioIntelSummary,
  proactiveCandidates: ResearchCandidate[],
): PortfolioRiskLabel {
  if (!items.length || !intel.compactContext) return "unclear";

  const saudiPct    = categoryPct(items, "saudi");
  const cryptoPct   = categoryPct(items, "crypto");
  const usPct       = categoryPct(items, "us");
  const commPct     = categoryPct(items, "commodities");
  const fxPct       = categoryPct(items, "fx");
  const highBetaPct = cryptoPct + usPct;
  const defensivePct = commPct + fxPct;

  // macro_vulnerable: meaningful Saudi exposure AND active oil/DXY stress signal
  const hasOilStress = proactiveCandidates.some((c) => c.trigger === "oil-fiscal-stress");
  const hasDxyStress = proactiveCandidates.some(
    (c) => c.trigger === "btc-liquidity-weakness" || c.trigger === "gold-haven-conflict",
  );
  if (saudiPct >= 0.25 && (hasOilStress || hasDxyStress)) return "macro_vulnerable";

  // concentrated: single-category dominance from existing HHI
  if (intel.concentrationScore > 60) return "concentrated";

  // defensive: commodities + fx dominant
  if (defensivePct >= 0.5) return "defensive";

  // growth_sensitive: high-beta dominant
  if (highBetaPct >= 0.65) return "growth_sensitive";

  return "balanced";
}

// ─── Stress vulnerability mapper ──────────────────────────────────────────────

function mapStressedExposures(
  items: WatchlistAsset[],
  proactiveCandidates: ResearchCandidate[],
  ar: boolean,
): StressedExposure[] {
  const exposures: StressedExposure[] = [];
  const hasCat = (cat: WatchlistAsset["category"]) => items.some((a) => a.category === cat);

  for (const c of proactiveCandidates) {
    if (c.severity === "low") continue; // only medium/high severity triggers

    if (c.trigger === "oil-fiscal-stress" && hasCat("saudi")) {
      exposures.push({
        category: "saudi",
        trigger: c.trigger,
        note: ar
          ? "أسهم السعودية/الخليج عرضة لضغط قناة الإيرادات المالية النفطية"
          : "Saudi/Gulf holdings exposed to oil→fiscal channel pressure",
      });
    }

    if (c.trigger === "btc-liquidity-weakness" && hasCat("crypto")) {
      exposures.push({
        category: "crypto",
        trigger: c.trigger,
        note: ar
          ? "مراكز الكريبتو عرضة لإشارة وكيل السيولة HLT"
          : "Crypto holdings exposed to BTC liquidity-proxy weakness signal",
      });
    }

    if (c.trigger === "gold-haven-conflict") {
      if (hasCat("us") || hasCat("crypto")) {
        exposures.push({
          category: hasCat("us") ? "us" : "crypto",
          trigger: c.trigger,
          note: ar
            ? "نزعة الملاذ الآمن في الذهب قد تعني ضغطاً على أصول المخاطرة في المحفظة"
            : "Gold safe-haven bid may signal risk-off pressure on growth-sensitive holdings",
        });
      }
    }

    if (c.trigger === "thesis-regime-conflict") {
      const matchedItem = items.find(
        (a) => a.symbol.toUpperCase() === c.asset.toUpperCase(),
      );
      if (matchedItem) {
        exposures.push({
          category: matchedItem.category,
          trigger: c.trigger,
          note: ar
            ? `أطروحة ${c.asset} قد تتعارض مع النظام الكلي الحالي`
            : `${c.asset} thesis may conflict with current macro regime`,
        });
      }
    }

    if (c.trigger === "significant-move") {
      const matchedItem = items.find(
        (a) => a.symbol.toUpperCase() === c.asset.toUpperCase(),
      );
      if (matchedItem && c.severity === "high") {
        exposures.push({
          category: matchedItem.category,
          trigger: c.trigger,
          note: ar
            ? `${c.asset}: حركة سعرية ملحوظة تستحق مراجعة الأطروحة`
            : `${c.asset}: significant price movement warrants thesis review`,
        });
      }
    }
  }

  // Deduplicate by category — keep highest-severity
  const seen = new Map<WatchlistAsset["category"], StressedExposure>();
  for (const e of exposures) {
    if (!seen.has(e.category)) seen.set(e.category, e);
  }
  return [...seen.values()].slice(0, 3);
}

// ─── Hedge detection ──────────────────────────────────────────────────────────

function detectHedgeNote(items: WatchlistAsset[], proactiveCandidates: ResearchCandidate[], ar: boolean): string | null {
  // Gold in watchlist when risk-off or stress signals active
  const hasGold = hasSymbol(items, /^(XAU|GOLD|GLD|IAU|PAXG)/i);
  const hasRiskOffSignal = proactiveCandidates.some(
    (c) => c.trigger === "gold-haven-conflict" || c.trigger === "btc-liquidity-weakness",
  );
  if (hasGold && hasRiskOffSignal) {
    return ar
      ? "الذهب في المحفظة قد يعمل كتحوط جزئي في بيئة نفور المخاطرة"
      : "Gold holding may serve as partial hedge in risk-off environment";
  }

  // Defensive commodities/FX without gold-specific signal
  const defensivePct = categoryPct(items, "commodities") + categoryPct(items, "fx");
  if (defensivePct >= 0.3 && proactiveCandidates.some((c) => c.severity !== "low")) {
    return ar
      ? "مراكز السلع/العملات تُوفّر تحوطاً جزئياً ضد ضغوط الأصول الخطرة"
      : "Commodities/FX positions provide partial offset against risk-asset pressure";
  }

  return null;
}

// ─── Risk label narrative ─────────────────────────────────────────────────────

function buildRiskLabelNote(label: PortfolioRiskLabel, ar: boolean): string {
  const notes: Record<PortfolioRiskLabel, { ar: string; en: string }> = {
    balanced:         { ar: "توزيع متوازن نسبياً — لا مخاطر نظامية واضحة", en: "Relatively balanced — no dominant systemic risk identified" },
    concentrated:     { ar: "تركّز مرتفع في فئة واحدة — مراجعة التوزيع موصى", en: "High single-category concentration — review allocation exposure" },
    defensive:        { ar: "توجه دفاعي — نسبة عالية من الأصول الدفاعية", en: "Defensive posture — high share of defensive/haven assets" },
    growth_sensitive: { ar: "حساسية عالية للنمو — نسبة مرتفعة من الأصول عالية البيتا", en: "High growth sensitivity — elevated high-beta asset share" },
    macro_vulnerable: { ar: "عرضة للمتغيرات الكلية — توقّ لإشارات النفط/DXY", en: "Macro-vulnerable — monitor oil/DXY channel for Saudi/Gulf holdings" },
    unclear:          { ar: "قائمة المراقبة فارغة أو غير كافية للتقييم", en: "Insufficient watchlist data for risk classification" },
  };
  return ar ? notes[label].ar : notes[label].en;
}

// ─── Context string ───────────────────────────────────────────────────────────

function buildRiskContext(
  label: PortfolioRiskLabel,
  stressedExposures: StressedExposure[],
  hedgeNote: string | null,
  ar: boolean,
): string {
  if (label === "unclear") return "";
  const labelStr = ar
    ? ({ balanced: "متوازن", concentrated: "مركّز", defensive: "دفاعي", growth_sensitive: "حساس للنمو", macro_vulnerable: "عرضة للماكرو", unclear: "" }[label])
    : label.replace(/_/g, " ");
  const parts = [`Portfolio risk: ${labelStr}`];
  if (stressedExposures.length > 0) parts.push(`Vulnerability: ${stressedExposures[0].note}`);
  if (hedgeNote) parts.push(`Partial offset: ${hedgeNote}`);
  return parts.join(" | ").slice(0, 180);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Assesses portfolio risk from watchlist composition and live proactive signals.
 * Pure function — deterministic, no I/O.
 */
export function computePortfolioRisk(
  items: WatchlistAsset[],
  intel: PortfolioIntelSummary,
  proactiveCandidates: ResearchCandidate[],
  ar: boolean,
): PortfolioRiskResult {
  if (!items.length) {
    return {
      riskLabel: "unclear",
      dominantVulnerability: null,
      stressedExposures: [],
      hedgeNote: null,
      riskContext: "",
      riskLabelNote: ar ? "قائمة المراقبة فارغة" : "Watchlist is empty",
      hasActiveVulnerability: false,
    };
  }

  const riskLabel = deriveRiskLabel(items, intel, proactiveCandidates);
  const stressedExposures = mapStressedExposures(items, proactiveCandidates, ar);
  const hedgeNote = detectHedgeNote(items, proactiveCandidates, ar);
  const dominantVulnerability = stressedExposures[0]?.note ?? (intel.riskOverlap.detected ? intel.riskOverlap.description : null);
  const riskContext = buildRiskContext(riskLabel, stressedExposures, hedgeNote, ar);
  const riskLabelNote = buildRiskLabelNote(riskLabel, ar);
  const hasActiveVulnerability = stressedExposures.length > 0 || riskLabel === "macro_vulnerable" || riskLabel === "concentrated";

  return { riskLabel, dominantVulnerability, stressedExposures, hedgeNote, riskContext, riskLabelNote, hasActiveVulnerability };
}
