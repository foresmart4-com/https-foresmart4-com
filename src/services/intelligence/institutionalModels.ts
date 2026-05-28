/**
 * Institutional Investment Models Intelligence — Phase 51
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Identifies which publicly known institutional investment frameworks are
 * most relevant to the current portfolio and market context, surfaces
 * competing portfolio philosophies, and explains analytical tradeoffs.
 *
 * Framework families (public concepts only — no proprietary strategies):
 *   Endowment Models        — Yale-style long-horizon diversification, illiquidity awareness,
 *                             strategic diversification across asset classes
 *   Hedge Fund Frameworks   — risk parity, macro allocation logic, volatility management,
 *                             asymmetric exposure, drawdown sensitivity (public concepts only)
 *   Sovereign Wealth Logic  — capital preservation, reserve management, long-duration capital,
 *                             strategic patience, regime awareness
 *   Portfolio Governance    — allocation discipline, risk budgeting, resilience logic,
 *                             concentration awareness, liquidity management
 *
 * Design rules:
 * - All frameworks are educational and analytical — never trade instructions
 * - No "fund X bought Y" — no fund identity, no trade copying, no signal replication
 * - No claim of superior certainty — competing philosophies always preserved
 * - No imitation of proprietary strategies — public concepts only
 * - Hedged language throughout: "consistent with", "similar to", "suggests", "may reflect"
 * - modelState describes framework alignment, not a directional recommendation
 * - Competing philosophies explicitly represented to preserve intellectual diversity
 *
 * Safety assertions (always enforced):
 *   isTradeInstruction  — always false; no buy/sell guidance
 *   isExecution         — always false; no broker or order logic
 *   isFundImitation     — always false; no specific fund strategy replication
 */

import type { StressLevel } from "@/services/market/marketIntelEngine";
import type { MacroCycleState } from "@/services/macro/globalMacroMemory";
import type { BehavioralLabel } from "@/services/intelligence/behavioralMarket";
import type { PortfolioConstructionLabel } from "@/services/portfolio/portfolioConstruction";
import type { FirewallState } from "@/services/governance/decisionFirewall";
import type { CrossMarketRegimeLabel } from "@/services/intelligence/crossMarketRegime";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModelState =
  | "diversified_institutional"   // endowment-style: multi-asset, long-horizon, illiquidity-aware
  | "resilient_framework"         // risk parity: volatility-weighted, drawdown-managed, macro-balanced
  | "concentrated_framework"      // high-conviction: focused allocation, fundamental-driven thesis
  | "regime_sensitive"            // macro-aware: regime-adaptive, tactical, opportunistic allocation
  | "liquidity_sensitive"         // liquidity-first: stress-aware, short-duration bias, preservation adjacent
  | "preservation_oriented"       // sovereign-style: long-duration capital, capital protection mandate
  | "high_risk_concentration"     // governance flag: concentration warrants review; diversification limited
  | "insufficient_model_context"; // insufficient signals for institutional framework assessment

export type FrameworkFamily =
  | "endowment"              // long-horizon diversification, illiquidity premium, strategic allocation
  | "risk_parity"            // volatility-weighted balancing, drawdown management, macro-balanced
  | "macro_hedge"            // regime-driven, asymmetric exposure, flexible mandate, global macro
  | "sovereign_wealth"       // capital preservation, reserve management, long-duration patience
  | "portfolio_governance";  // allocation discipline, risk budgeting, liquidity management, resilience

export type CompetingPhilosophy =
  | "risk_parity_vs_conviction"   // volatility-weighted vs concentrated fundamental view
  | "endowment_vs_tactical"       // long-horizon diversification vs tactical concentration
  | "preservation_vs_growth"      // capital protection mandate vs return maximisation
  | "macro_vs_fundamental"        // regime-driven allocation vs bottom-up fundamental analysis
  | "liquidity_vs_illiquidity"    // liquid portfolio vs illiquidity premium capture
  | "none";                       // no material competing philosophy detected

export interface InstitutionalModelsInput {
  question: string;
  marketRegime: string;
  stressLevel: StressLevel;
  riskOnScore: number;                        // -100..+100 risk appetite
  concentrationScore: number;                 // 0-100 from portfolioIntel
  macroCycle: MacroCycleState;
  behavioralLabel: BehavioralLabel;
  portfolioConstructionLabel: PortfolioConstructionLabel;
  firewallState: FirewallState;
  crossMarketLabel: CrossMarketRegimeLabel;
  ar: boolean;
}

export interface InstitutionalModelsResult {
  modelState: ModelState;
  primaryFramework: FrameworkFamily;
  competingPhilosophy: CompetingPhilosophy;
  philosophyNote: string;           // 1 sentence, hedged language
  competingNote: string | null;     // 1 sentence on the competing view; null when none
  requiresHumanReview: boolean;     // true when concentration or preservation flag active
  contextString: string;            // compact ≤200 chars for Genesis injection
  // Safety assertions — always enforced; no exceptions
  readonly isTradeInstruction: false;
  readonly isExecution: false;
  readonly isFundImitation: false;
}

// ─── Keyword patterns ─────────────────────────────────────────────────────────
// All patterns are simple substring checks — O(1) per pattern, bounded set.

const ENDOWMENT_PATTERN = /endowment|diversif|long.?horizon|long.?term|multi.?asset|illiquid|private equity|real asset|alternative|strategic alloc|asset class/i;
const RISK_PARITY_PATTERN = /risk.?parity|volatility.?weight|drawdown|vol.?target|balanced.?portfolio|equal.?risk|risk.?budget|low.?vol/i;
const MACRO_HEDGE_PATTERN = /macro|regime|asymmetric|tactical|flexible mandate|opportunistic|global macro|discretionary|systematic|momentum|trend/i;
const SOVEREIGN_PATTERN = /preserv|sovereign|reserve|patient capital|long.?durat|capital protect|wealth fund|intergener|perpetual|stability fund/i;
const GOVERNANCE_PATTERN = /governance|allocation discipline|risk budget|resilience|concentration|liquidity|rebalance|drawdown limit|risk control/i;
const FUNDAMENTAL_PATTERN = /fundamental|valuation|earnings|bottom.?up|quality|growth|value invest|intrinsic|cash flow|conviction/i;
const CONCENTRATION_PATTERN = /concentrat|single.?asset|high.?conviction|overweight|position.?size|best.?ideas|focus/i;
const PRESERVATION_PATTERN = /capital preserv|downside protect|avoid loss|principal protect|conservative|not lose|wealth preserv/i;

// ─── Framework score ──────────────────────────────────────────────────────────

interface FrameworkScores {
  endowment: number;
  risk_parity: number;
  macro_hedge: number;
  sovereign_wealth: number;
  portfolio_governance: number;
}

function scoreFrameworks(input: InstitutionalModelsInput): FrameworkScores {
  const q = input.question;
  const { stressLevel, riskOnScore, concentrationScore, macroCycle,
          behavioralLabel, portfolioConstructionLabel, crossMarketLabel } = input;

  // Endowment: diversification + long-horizon signals
  let endowment = ENDOWMENT_PATTERN.test(q) ? 4 : 0;
  if (portfolioConstructionLabel === "resilient_portfolio") endowment += 2;
  if (macroCycle === "stable_cycle" || macroCycle === "easing_cycle") endowment += 1;
  if (concentrationScore < 35) endowment += 2;

  // Risk parity: volatility + balance signals
  let risk_parity = RISK_PARITY_PATTERN.test(q) ? 4 : 0;
  if (stressLevel === "elevated" || stressLevel === "high") risk_parity += 2;
  if (portfolioConstructionLabel === "correlation_risk") risk_parity += 2;
  if (crossMarketLabel === "conflicting_regime") risk_parity += 1;

  // Macro hedge: regime + tactical signals
  let macro_hedge = MACRO_HEDGE_PATTERN.test(q) ? 3 : 0;
  if (macroCycle === "transition_cycle" || macroCycle === "fragmented_cycle") macro_hedge += 2;
  if (crossMarketLabel === "conflicting_regime" || crossMarketLabel === "regime_divergence") macro_hedge += 2;
  if (Math.abs(riskOnScore) >= 50) macro_hedge += 1;

  // Sovereign wealth: preservation + patience signals
  let sovereign_wealth = (SOVEREIGN_PATTERN.test(q) || PRESERVATION_PATTERN.test(q)) ? 4 : 0;
  if (macroCycle === "tightening_cycle" && stressLevel === "high") sovereign_wealth += 2;
  if (behavioralLabel === "fear_dominant") sovereign_wealth += 1;
  if (riskOnScore < -40) sovereign_wealth += 1;

  // Portfolio governance: concentration + discipline signals
  let portfolio_governance = GOVERNANCE_PATTERN.test(q) ? 3 : 0;
  if (concentrationScore >= 60) portfolio_governance += 2;
  if (portfolioConstructionLabel === "concentrated_portfolio" || portfolioConstructionLabel === "hedge_needed_review") portfolio_governance += 2;
  if (portfolioConstructionLabel === "unbalanced_portfolio") portfolio_governance += 1;

  return { endowment, risk_parity, macro_hedge, sovereign_wealth, portfolio_governance };
}

// ─── Model state derivation ───────────────────────────────────────────────────

function deriveModelState(
  input: InstitutionalModelsInput,
  scores: FrameworkScores,
): ModelState {
  const { concentrationScore, stressLevel, macroCycle,
          portfolioConstructionLabel, behavioralLabel, riskOnScore } = input;

  // Hard governance flag: extreme concentration always surfaces first
  if (concentrationScore >= 75 || portfolioConstructionLabel === "hedge_needed_review") {
    return "high_risk_concentration";
  }

  // Preservation orientation: sovereign keywords + stress + defensive signals
  const isPreservation = scores.sovereign_wealth >= 4;
  if (isPreservation) return "preservation_oriented";

  // Find the highest-scoring framework
  const top = (Object.entries(scores) as [FrameworkFamily, number][])
    .sort((a, b) => b[1] - a[1])[0];

  if (!top || top[1] < 2) {
    // Secondary derivation from structural signals when no keyword match
    if (concentrationScore >= 50) return "concentrated_framework";
    if (stressLevel === "high" && concentrationScore >= 30) return "liquidity_sensitive";
    if (macroCycle === "transition_cycle" || macroCycle === "fragmented_cycle") return "regime_sensitive";
    return "insufficient_model_context";
  }

  const [family] = top;
  switch (family) {
    case "endowment":          return "diversified_institutional";
    case "risk_parity":        return "resilient_framework";
    case "macro_hedge":        return "regime_sensitive";
    case "sovereign_wealth":   return "preservation_oriented";
    case "portfolio_governance":
      if (concentrationScore >= 50) return "concentrated_framework";
      if (stressLevel === "high" || stressLevel === "elevated") return "liquidity_sensitive";
      return behavioralLabel === "fear_dominant" ? "liquidity_sensitive" : "diversified_institutional";
  }
}

// ─── Primary framework selection ──────────────────────────────────────────────

function derivePrimaryFramework(
  modelState: ModelState,
  scores: FrameworkScores,
): FrameworkFamily {
  switch (modelState) {
    case "diversified_institutional": return "endowment";
    case "resilient_framework":       return "risk_parity";
    case "concentrated_framework":    return "portfolio_governance";
    case "regime_sensitive":          return "macro_hedge";
    case "liquidity_sensitive":       return "portfolio_governance";
    case "preservation_oriented":     return "sovereign_wealth";
    case "high_risk_concentration":   return "portfolio_governance";
    case "insufficient_model_context": {
      const top = (Object.entries(scores) as [FrameworkFamily, number][])
        .sort((a, b) => b[1] - a[1])[0];
      return top?.[0] ?? "portfolio_governance";
    }
  }
}

// ─── Competing philosophy detection ──────────────────────────────────────────

function detectCompetingPhilosophy(
  input: InstitutionalModelsInput,
  modelState: ModelState,
  scores: FrameworkScores,
): CompetingPhilosophy {
  const q = input.question;
  const { concentrationScore } = input;
  const hasConviction = FUNDAMENTAL_PATTERN.test(q) || CONCENTRATION_PATTERN.test(q);
  const hasPreservation = PRESERVATION_PATTERN.test(q) || SOVEREIGN_PATTERN.test(q);
  const hasIlliquidity = ENDOWMENT_PATTERN.test(q) && /illiquid|private|alt/i.test(q);

  // Risk parity vs concentrated conviction — volatility-weighted vs fundamental
  if (modelState === "resilient_framework" && hasConviction) return "risk_parity_vs_conviction";
  if (modelState === "concentrated_framework" && scores.risk_parity >= 2) return "risk_parity_vs_conviction";

  // Endowment diversification vs tactical concentration
  if (modelState === "diversified_institutional" && (concentrationScore >= 45 || scores.macro_hedge >= 3)) {
    return "endowment_vs_tactical";
  }

  // Preservation vs growth — when sovereign/preservation meets risk-on environment
  if (hasPreservation && input.riskOnScore > 20) return "preservation_vs_growth";
  if (modelState === "preservation_oriented" && scores.macro_hedge >= 2) return "preservation_vs_growth";

  // Macro vs fundamental — regime-driven vs bottom-up
  if (modelState === "regime_sensitive" && hasConviction) return "macro_vs_fundamental";

  // Liquidity vs illiquidity premium — when stress meets endowment-style allocation
  if ((modelState === "liquidity_sensitive" || modelState === "high_risk_concentration") && hasIlliquidity) {
    return "liquidity_vs_illiquidity";
  }

  return "none";
}

// ─── Philosophy notes ─────────────────────────────────────────────────────────

const PHILOSOPHY_NOTES_EN: Record<ModelState, string> = {
  diversified_institutional:   "Context is consistent with an endowment-style framework: long-horizon diversification across asset classes with explicit illiquidity awareness.",
  resilient_framework:         "Context suggests a risk-parity orientation: volatility-weighted allocation logic and drawdown sensitivity are consistent with balanced institutional exposure.",
  concentrated_framework:      "Context reflects a high-conviction, concentrated allocation framework: fundamental-driven thesis with deliberate position sizing.",
  regime_sensitive:            "Context is consistent with a macro-adaptive framework: regime identification shapes allocation logic and tactical flexibility.",
  liquidity_sensitive:         "Context suggests a liquidity-first posture: stress conditions and concentration awareness are consistent with capital-preservation-adjacent allocation discipline.",
  preservation_oriented:       "Context is consistent with a sovereign-wealth or reserve-management orientation: long-duration capital, strategic patience, and capital protection logic.",
  high_risk_concentration:     "Concentration signal warrants governance review: the current allocation profile may limit diversification benefit and warrants human assessment of resilience.",
  insufficient_model_context:  "Insufficient context for institutional framework classification: signals do not clearly align with a dominant portfolio philosophy.",
};

const PHILOSOPHY_NOTES_AR: Record<ModelState, string> = {
  diversified_institutional:   "السياق متسق مع إطار تشبه الصناديق الوقفية: تنويع طويل الأجل عبر فئات الأصول مع وعي واضح بعلاوة غياب السيولة.",
  resilient_framework:         "السياق يُشير إلى توجه تعادل المخاطر: توزيع موزون على التقلب ووعي بمخاطر التراجع يتسق مع التعرض المؤسسي المتوازن.",
  concentrated_framework:      "السياق يعكس إطار تخصيص مركّز عالي القناعة: أطروحة مدفوعة بالأساسيات مع تحديد حجم المركز عن قصد.",
  regime_sensitive:            "السياق متسق مع إطار تكيفي مع الماكرو: تحديد النظام يُشكّل منطق التخصيص والمرونة التكتيكية.",
  liquidity_sensitive:         "السياق يُشير إلى توجه يُقدّم السيولة: ظروف الضغط والوعي بالتركز يتسقان مع انضباط التخصيص المجاور لحفظ رأس المال.",
  preservation_oriented:       "السياق متسق مع توجه صندوق الثروة السيادي أو إدارة الاحتياطيات: رأس مال طويل الأجل وصبر استراتيجي ومنطق حماية رأس المال.",
  high_risk_concentration:     "إشارة التركز تستوجب مراجعة الحوكمة: ملف التخصيص الحالي قد يُقيّد منافع التنويع ويستدعي تقييماً بشرياً للمرونة.",
  insufficient_model_context:  "سياق غير كافٍ لتصنيف الإطار المؤسسي: الإشارات لا تتوافق بوضوح مع فلسفة محفظة مهيمنة.",
};

const COMPETING_NOTES_EN: Record<CompetingPhilosophy, string | null> = {
  risk_parity_vs_conviction:  "Competing view: a concentrated fundamental approach would argue that volatility-weighting dilutes high-conviction opportunities relative to risk-adjusted return potential.",
  endowment_vs_tactical:      "Competing view: a tactical concentration approach would argue that broad diversification sacrifices return density when regime clarity is high.",
  preservation_vs_growth:     "Competing view: a return-maximisation framework would argue that strict preservation orientation may forgo risk premia that are asymmetrically favourable in the current cycle.",
  macro_vs_fundamental:       "Competing view: a bottom-up fundamental approach would argue that regime-driven allocation can underweight asset-specific mispricing that macro models systematically miss.",
  liquidity_vs_illiquidity:   "Competing view: an illiquidity-premium framework would argue that stress-driven liquidity preference may forgo the structural return advantage of patient, long-horizon capital.",
  none: null,
};

const COMPETING_NOTES_AR: Record<CompetingPhilosophy, string | null> = {
  risk_parity_vs_conviction:  "الرأي المنافس: النهج القائم على القناعة العالية يرى أن الوزن بالتقلب يُخفّف الفرص عالية الثقة نسبةً إلى إمكانات العائد المعدّل للمخاطرة.",
  endowment_vs_tactical:      "الرأي المنافس: نهج التركز التكتيكي يرى أن التنويع الواسع يُضحّي بكثافة العائد حين يكون وضوح النظام مرتفعاً.",
  preservation_vs_growth:     "الرأي المنافس: إطار تعظيم العوائد يرى أن التوجه الصارم نحو الحفاظ قد يُضيّع علاوات المخاطر المواتية بشكل غير متماثل في الدورة الحالية.",
  macro_vs_fundamental:       "الرأي المنافس: النهج الأساسي من القاعدة إلى القمة يرى أن التخصيص المدفوع بالنظام قد يُقلّل من وزن الأسعار الخاطئة الخاصة بكل أصل التي تُفوّتها نماذج الماكرو.",
  liquidity_vs_illiquidity:   "الرأي المنافس: إطار علاوة غياب السيولة يرى أن تفضيل السيولة المدفوع بالضغط قد يُضيّع ميزة العائد الهيكلية لرأس المال الصبور طويل الأجل.",
  none: null,
};

// ─── Context string builder ───────────────────────────────────────────────────

function buildContextString(
  modelState: ModelState,
  primaryFramework: FrameworkFamily,
  competingPhilosophy: CompetingPhilosophy,
  ar: boolean,
): string {
  if (modelState === "insufficient_model_context") return "";

  const modelLabel = modelState.replace(/_/g, " ");
  const frameworkLabel = primaryFramework.replace(/_/g, " ");

  // Primary line
  const parts: string[] = [`Institutional model: ${modelLabel}`];

  // Framework philosophy label
  switch (primaryFramework) {
    case "endowment":
      parts.push(`Diversification framework: endowment diversification`);
      break;
    case "risk_parity":
      parts.push(`Portfolio philosophy: risk parity`);
      break;
    case "macro_hedge":
      parts.push(`Portfolio philosophy: macro allocation`);
      break;
    case "sovereign_wealth":
      parts.push(`Capital preservation: sovereign mandate`);
      parts.push(`Governance style: long duration`);
      break;
    case "portfolio_governance":
      if (modelState === "high_risk_concentration") {
        parts.push(`Governance style: concentration review required`);
      } else {
        parts.push(`Governance style: allocation discipline`);
      }
      break;
  }

  // Competing philosophy — compact label only, never the full note (that is in the AI prompt guidance)
  if (competingPhilosophy !== "none") {
    parts.push(`Competing philosophy: ${competingPhilosophy.replace(/_/g, " ")}`);
  }

  return parts.join("; ").slice(0, 200);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeInstitutionalModels(input: InstitutionalModelsInput): InstitutionalModelsResult {
  const { ar, firewallState } = input;

  // Firewall block: return safe insufficient state immediately
  if (firewallState === "blocked") {
    return {
      modelState: "insufficient_model_context",
      primaryFramework: "portfolio_governance",
      competingPhilosophy: "none",
      philosophyNote: ar
        ? "تحليل الأطر المؤسسية معلّق — جدار الحماية محجوب."
        : "Institutional framework analysis suspended — firewall blocked.",
      competingNote: null,
      requiresHumanReview: false,
      contextString: "",
      isTradeInstruction: false,
      isExecution: false,
      isFundImitation: false,
    };
  }

  const scores = scoreFrameworks(input);
  const modelState = deriveModelState(input, scores);
  const primaryFramework = derivePrimaryFramework(modelState, scores);
  const competingPhilosophy = detectCompetingPhilosophy(input, modelState, scores);

  const philosophyNote = ar
    ? PHILOSOPHY_NOTES_AR[modelState]
    : PHILOSOPHY_NOTES_EN[modelState];
  const competingNote = ar
    ? COMPETING_NOTES_AR[competingPhilosophy]
    : COMPETING_NOTES_EN[competingPhilosophy];

  const requiresHumanReview =
    modelState === "high_risk_concentration" ||
    modelState === "preservation_oriented" ||
    input.portfolioConstructionLabel === "hedge_needed_review";

  const contextString = buildContextString(modelState, primaryFramework, competingPhilosophy, ar);

  return {
    modelState,
    primaryFramework,
    competingPhilosophy,
    philosophyNote,
    competingNote,
    requiresHumanReview,
    contextString,
    isTradeInstruction: false,
    isExecution: false,
    isFundImitation: false,
  };
}
