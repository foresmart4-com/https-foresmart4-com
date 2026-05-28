/**
 * Portfolio Construction Intelligence — Phase 48
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Evaluates portfolio structure quality including concentration risk,
 * diversification, hedge logic, correlation pressure, and resilience
 * against current market regime and behavioral conditions.
 *
 * Construction labels:
 *   resilient_portfolio        — diversified, regime-aligned, no dominant stress
 *   concentrated_portfolio     — single-category dominance; limited diversification
 *   unbalanced_portfolio       — macro misalignment or asymmetric exposure
 *   hedge_needed_review        — active vulnerability + no offset + adverse sentiment
 *   correlation_risk           — assets likely to move together under current regime
 *   insufficient_portfolio_data — empty or too-few-position watchlist
 *
 * Behavioral → portfolio interaction:
 *   crowded_positioning + concentrated → elevates to hedge_needed_review
 *   fear_dominant + active vulnerability + no hedge → elevates to hedge_needed_review
 *   greed_dominant + concentrated → flags correlated overextension
 *   narrative_driven + concentrated → caution note on narrative-concentration link
 *
 * Design rules:
 * - Advisory only: no rebalance now, no trade instruction, no execution language
 * - Human review preserved: recommendations are observations, not commands
 * - No forced escalation: insufficient_portfolio_data when watchlist is empty
 * - Hedged language only: "may warrant", "review appropriate", "consider monitoring"
 */

import type { PortfolioRiskLabel } from "@/services/portfolio/portfolioRiskEngine";
import type { StressLevel } from "@/services/market/marketIntelEngine";
import type { FirewallState } from "@/services/governance/decisionFirewall";
import type { CrossMarketRegimeLabel } from "@/services/intelligence/crossMarketRegime";
import type { MacroCycleState } from "@/services/macro/globalMacroMemory";
import type { BehavioralLabel } from "@/services/intelligence/behavioralMarket";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PortfolioConstructionLabel =
  | "resilient_portfolio"         // diversified, aligned, limited stress
  | "concentrated_portfolio"      // single-category dominance; limited diversification
  | "unbalanced_portfolio"        // macro misalignment or asymmetric exposure
  | "hedge_needed_review"         // active vulnerability + adverse conditions + no offset
  | "correlation_risk"            // assets likely to move together; limited diversification benefit
  | "insufficient_portfolio_data";// empty watchlist or too few positions

export type ConstructionFactor =
  | "high_concentration"    // one category dominates
  | "regime_misalignment"   // watchlist misaligned with macro regime
  | "no_hedge_offset"       // active vulnerability but no defensive offset detected
  | "correlation_pressure"  // tightening cycle + correlated positions
  | "behavioral_risk"       // adverse behavioral pressure on concentrated exposure
  | "diversification_ok"    // adequate category spread
  | "hedge_present"         // defensive offset detected
  | "regime_aligned";       // watchlist aligned with current macro regime

export interface PortfolioConstructionInput {
  riskLabel: PortfolioRiskLabel;
  hasActiveVulnerability: boolean;
  hasHedgeOffset: boolean;              // portfolioRisk.hedgeNote !== null
  concentrationScore: number;           // 0-100 (HHI × 100) from portfolioIntel
  regimeAligned: boolean;               // portfolioIntel.regimeAlignment.aligned
  watchlistCount: number;               // watchlistItems.length
  behavioralLabel: BehavioralLabel;     // Phase-44 — behavioral interaction
  macroCycle: MacroCycleState;          // Phase-43
  firewallState: FirewallState;
  stressLevel: StressLevel;
  crossMarketLabel: CrossMarketRegimeLabel;
  ar: boolean;
}

export interface PortfolioConstructionResult {
  label: PortfolioConstructionLabel;
  activeFactors: ConstructionFactor[];
  concentrationRisk: "high" | "moderate" | "low";
  correlationRisk: "elevated" | "moderate" | "low";
  hedgeAdequacy: "adequate" | "review_warranted" | "no_data";
  behavioralInteraction: string | null;    // 1 sentence noting interaction
  narrative: string;                       // 1-2 sentences, hedged language
  contextString: string;                   // compact ≤120 chars; empty when insufficient
  requiresHumanReview: boolean;            // true for hedge_needed_review
}

// ─── Factor evaluation ─────────────────────────────────────────────────────────

interface FactorScores {
  concentrationScore: number;  // 0-16
  misalignmentScore: number;   // 0-10
  hedgeScore: number;          // 0-12 (higher = worse hedge situation)
  correlationScore: number;    // 0-12
  resilienceScore: number;     // 0-12 (higher = more resilient)
  factors: Set<ConstructionFactor>;
}

function evaluateFactors(input: PortfolioConstructionInput): FactorScores {
  const {
    riskLabel, hasActiveVulnerability, hasHedgeOffset, concentrationScore,
    regimeAligned, watchlistCount, behavioralLabel, macroCycle,
    firewallState, stressLevel, crossMarketLabel,
  } = input;

  let concentration = 0;
  let misalignment = 0;
  let hedge = 0;
  let correlation = 0;
  let resilience = 0;
  const factors = new Set<ConstructionFactor>();

  // ── Concentration ─────────────────────────────────────────────────────────
  if (riskLabel === "concentrated") { concentration += 5; factors.add("high_concentration"); }
  if (concentrationScore > 70) { concentration += 4; factors.add("high_concentration"); }
  else if (concentrationScore > 50) { concentration += 2; }
  if (riskLabel === "growth_sensitive") { concentration += 3; }
  if (riskLabel === "macro_vulnerable") { concentration += 2; }

  // ── Regime misalignment ───────────────────────────────────────────────────
  if (!regimeAligned && macroCycle === "tightening_cycle") { misalignment += 5; factors.add("regime_misalignment"); }
  else if (!regimeAligned) { misalignment += 3; factors.add("regime_misalignment"); }
  if (macroCycle === "fragmented_cycle" && riskLabel !== "balanced") { misalignment += 2; }

  // ── Hedge adequacy ────────────────────────────────────────────────────────
  if (hasActiveVulnerability && !hasHedgeOffset) { hedge += 5; factors.add("no_hedge_offset"); }
  else if (hasActiveVulnerability && hasHedgeOffset) { factors.add("hedge_present"); }
  if (!hasHedgeOffset && stressLevel === "high") { hedge += 3; }
  if (firewallState === "blocked" && hasActiveVulnerability) { hedge += 2; }

  // Behavioral amplification of hedge need
  if (
    (behavioralLabel === "fear_dominant" || behavioralLabel === "crowded_positioning") &&
    hasActiveVulnerability && !hasHedgeOffset
  ) { hedge += 3; factors.add("behavioral_risk"); }

  // Greed / narrative driven + concentration = behavioral risk
  if (
    (behavioralLabel === "greed_dominant" || behavioralLabel === "narrative_driven") &&
    (riskLabel === "concentrated" || riskLabel === "growth_sensitive")
  ) { factors.add("behavioral_risk"); }

  // ── Correlation risk ──────────────────────────────────────────────────────
  if (macroCycle === "tightening_cycle" && concentrationScore > 40) { correlation += 4; }
  if (crossMarketLabel === "aligned_regime" && concentrationScore > 35) { correlation += 3; }
  if (stressLevel === "elevated" && riskLabel !== "defensive" && concentrationScore > 30) { correlation += 2; }
  if (stressLevel === "high" && concentrationScore > 25) { correlation += 3; }

  // ── Resilience ────────────────────────────────────────────────────────────
  if (riskLabel === "balanced") { resilience += 4; factors.add("diversification_ok"); }
  if (regimeAligned) { resilience += 2; factors.add("regime_aligned"); }
  if (hasHedgeOffset) { resilience += 2; factors.add("hedge_present"); }
  if (!hasActiveVulnerability) { resilience += 2; }
  if (concentrationScore < 40 && riskLabel !== "concentrated") { resilience += 2; }
  if (watchlistCount >= 4) { resilience += 1; } // some diversification by count
  if (watchlistCount < 2) { resilience -= 3; } // too few for meaningful assessment

  return {
    concentrationScore: Math.min(16, concentration),
    misalignmentScore: Math.min(10, misalignment),
    hedgeScore: Math.min(12, hedge),
    correlationScore: Math.min(12, correlation),
    resilienceScore: Math.min(12, resilience),
    factors,
  };
}

// ─── Label derivation ─────────────────────────────────────────────────────────

function deriveLabel(
  scores: FactorScores,
  input: PortfolioConstructionInput,
): PortfolioConstructionLabel {
  const { watchlistCount, behavioralLabel, riskLabel } = input;
  const { concentrationScore: cs, hedgeScore: hs, correlationScore: cors,
    resilienceScore: rs, misalignmentScore: ms, factors } = scores;

  // No data
  if (watchlistCount === 0 || riskLabel === "unclear") return "insufficient_portfolio_data";

  // Hedge needed review: active vulnerability + adverse behavior + no offset
  if (
    hs >= 7 ||
    (hs >= 4 && (behavioralLabel === "fear_dominant" || behavioralLabel === "crowded_positioning"))
  ) return "hedge_needed_review";

  // Crowded + concentrated → hedge needed review (interaction)
  if (
    behavioralLabel === "crowded_positioning" &&
    (riskLabel === "concentrated" || riskLabel === "growth_sensitive") &&
    hs >= 2
  ) return "hedge_needed_review";

  // Correlation risk: likely to move together under current regime
  if (cors >= 7 && cs >= 3) return "correlation_risk";

  // Concentrated: single-category dominance
  if (cs >= 7) return "concentrated_portfolio";

  // Unbalanced: macro misalignment or asymmetric exposure
  if (ms >= 5) return "unbalanced_portfolio";

  // Resilient: strong resilience, limited stress
  if (rs >= 7 && cs < 4 && hs < 3 && cors < 4) return "resilient_portfolio";

  // Moderate concentration or unbalance
  if (cs >= 4) return "concentrated_portfolio";
  if (ms >= 3) return "unbalanced_portfolio";

  // Default: resilient (some data, no major flags)
  return "resilient_portfolio";
}

// ─── Derived assessments ──────────────────────────────────────────────────────

function deriveConcentrationRisk(cs: number): "high" | "moderate" | "low" {
  if (cs >= 7) return "high";
  if (cs >= 3) return "moderate";
  return "low";
}

function deriveCorrelationRisk(cors: number): "elevated" | "moderate" | "low" {
  if (cors >= 7) return "elevated";
  if (cors >= 3) return "moderate";
  return "low";
}

function deriveHedgeAdequacy(input: PortfolioConstructionInput): "adequate" | "review_warranted" | "no_data" {
  if (input.watchlistCount === 0) return "no_data";
  if (!input.hasActiveVulnerability) return "adequate";
  if (input.hasHedgeOffset) return "adequate";
  return "review_warranted";
}

// ─── Behavioral interaction note ──────────────────────────────────────────────

function buildBehavioralInteraction(
  label: PortfolioConstructionLabel,
  behavioralLabel: BehavioralLabel,
  ar: boolean,
): string | null {
  if (behavioralLabel === "balanced_behavior" || behavioralLabel === "unclear_behavior") return null;

  type Combo = `${PortfolioConstructionLabel}:${BehavioralLabel}`;
  const key: Combo = `${label}:${behavioralLabel}`;
  const notes: Partial<Record<Combo, { en: string; ar: string }>> = {
    "hedge_needed_review:fear_dominant":       { en: "Fear-dominant behavior may amplify vulnerability in current structure.", ar: "سلوك الخوف السائد قد يُضخّم الهشاشة في البنية الحالية." },
    "hedge_needed_review:crowded_positioning": { en: "Crowded positioning may elevate hedge review priority.", ar: "التموضع المكتظ قد يرفع أولوية مراجعة التحوط." },
    "concentrated_portfolio:greed_dominant":   { en: "Greed-dominant sentiment may have reinforced concentration; review timing.", ar: "المشاعر الطاغية قد عزّزت التركيز — مراجعة التوقيت مناسبة." },
    "concentrated_portfolio:narrative_driven": { en: "Narrative pressure may have driven concentration; diversification logic warrants review.", ar: "الرواية السائدة قد قادت التركيز — منطق التوزيع يستحق المراجعة." },
    "correlation_risk:fear_dominant":          { en: "Fear-driven correlation may be increasing simultaneously across holdings.", ar: "الارتباط المدفوع بالخوف قد يرتفع في آن واحد عبر المراكز." },
    "unbalanced_portfolio:narrative_driven":   { en: "Macro narrative may be masking portfolio misalignment.", ar: "الرواية الكلية قد تحجب عدم توازن المحفظة." },
    "resilient_portfolio:fear_dominant":       { en: "Portfolio structure appears resilient; fear-driven overreaction may be premature.", ar: "بنية المحفظة تبدو قوية؛ التفاعل المفرط للخوف قد يكون سابقاً لأوانه." },
  };

  const note = notes[key];
  if (note) return ar ? note.ar : note.en;

  // Generic behavioral note for unmatched combinations
  if (ar) return `مشاعر ${behavioralLabel.replace(/_/g, " ")} نشطة؛ راجع المحفظة في ضوء الضغط السلوكي الحالي.`;
  return `Behavioral ${behavioralLabel.replace(/_/g, " ")} active; review portfolio in light of current sentiment pressure.`;
}

// ─── Narrative builder ────────────────────────────────────────────────────────

function buildNarrative(
  label: PortfolioConstructionLabel,
  concentrationRisk: "high" | "moderate" | "low",
  behavioralInteraction: string | null,
  ar: boolean,
): string {
  const interactionNote = behavioralInteraction
    ? (ar ? ` ${behavioralInteraction}` : ` ${behavioralInteraction}`)
    : "";

  if (ar) {
    switch (label) {
      case "resilient_portfolio":
        return `البنية الحالية للمحفظة تُشير إلى مرونة نسبية مع تنويع معقول.${interactionNote} استشاري فقط.`;
      case "concentrated_portfolio":
        return `بنية المحفظة تُشير إلى تركيز — المراجعة قد تكون مناسبة.${interactionNote}`;
      case "unbalanced_portfolio":
        return `عدم توازن هيكلي محتمل بين المحفظة والنظام الكلي الحالي.${interactionNote} مراجعة بشرية مناسبة.`;
      case "hedge_needed_review":
        return `هشاشة نشطة دون إزاحة دفاعية واضحة.${interactionNote} المراجعة البشرية موصى بها — لا تنفيذ.`;
      case "correlation_risk":
        return `الضغط الكلي قد يرفع الارتباط عبر المراكز.${interactionNote} التنويع قد يكون منقوصاً في النظام الحالي.`;
      case "insufficient_portfolio_data":
      default:
        return `بيانات محفظة غير كافية للتقييم الهيكلي؛ أضف أصولاً لمراجعة منطق التوزيع.${interactionNote}`;
    }
  }
  switch (label) {
    case "resilient_portfolio":
      return `Current portfolio structure suggests relative resilience with reasonable diversification.${interactionNote} Advisory only.`;
    case "concentrated_portfolio":
      return `Portfolio structure suggests concentration — review may be appropriate.${interactionNote}`;
    case "unbalanced_portfolio":
      return `Potential structural misalignment between portfolio and current macro regime.${interactionNote} Human review appropriate.`;
    case "hedge_needed_review":
      return `Active vulnerability without clear defensive offset.${interactionNote} Human review is recommended — no execution implied.`;
    case "correlation_risk":
      return `Macro regime pressure may be elevating correlation across holdings.${interactionNote} Diversification benefit may be limited in current cycle.`;
    case "insufficient_portfolio_data":
    default:
      return `Insufficient portfolio data for structural assessment; add positions to evaluate allocation logic.${interactionNote}`;
  }
}

// ─── Context string ───────────────────────────────────────────────────────────

function buildContextString(
  label: PortfolioConstructionLabel,
  concentrationRisk: "high" | "moderate" | "low",
  correlationRisk: "elevated" | "moderate" | "low",
): string {
  if (label === "insufficient_portfolio_data" || label === "resilient_portfolio") return "";
  const noteStr = label === "hedge_needed_review" ? "; hedge review recommended"
    : label === "correlation_risk" ? `; correlation ${correlationRisk}`
    : label === "concentrated_portfolio" ? `; concentration ${concentrationRisk}`
    : "";
  return `Portfolio construction: ${label.replace(/_/g, " ")}${noteStr}`.slice(0, 120);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computePortfolioConstruction(
  input: PortfolioConstructionInput,
): PortfolioConstructionResult {
  const { ar, behavioralLabel } = input;

  const scores = evaluateFactors(input);
  const label = deriveLabel(scores, input);
  const concentrationRisk = deriveConcentrationRisk(scores.concentrationScore);
  const correlationRisk = deriveCorrelationRisk(scores.correlationScore);
  const hedgeAdequacy = deriveHedgeAdequacy(input);
  const behavioralInteraction = buildBehavioralInteraction(label, behavioralLabel, ar);
  const narrative = buildNarrative(label, concentrationRisk, behavioralInteraction, ar);
  const contextString = buildContextString(label, concentrationRisk, correlationRisk);

  return {
    label,
    activeFactors: [...scores.factors],
    concentrationRisk,
    correlationRisk,
    hedgeAdequacy,
    behavioralInteraction,
    narrative,
    contextString,
    requiresHumanReview: label === "hedge_needed_review",
  };
}
