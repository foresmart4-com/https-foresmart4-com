/**
 * Institutional Historical Validation — Phase 52
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Evaluates publicly known institutional investment frameworks against
 * historical macro environments using compressed, hedged analytical patterns.
 *
 * Frameworks evaluated (public concepts only):
 *   endowment          — long-horizon diversification, illiquidity premium
 *   risk_parity        — volatility-weighted, drawdown-managed, macro-balanced
 *   macro_hedge        — regime-adaptive, asymmetric exposure, flexible mandate
 *   sovereign_wealth   — capital preservation, reserve management, patient capital
 *   portfolio_governance — concentration discipline, risk budgeting, resilience
 *
 * Environments assessed:
 *   inflation_environment    — persistent above-target inflation, rising real rates
 *   recession_conditions     — contracting demand, falling growth, broad risk-off
 *   liquidity_stress         — credit spread widening, funding pressure, illiquidity events
 *   volatility_expansion     — elevated uncertainty, correlation shifts, VIX regime
 *   crisis_environment       — acute systemic stress, forced selling, dislocation
 *   macro_transition         — regime inflection, policy pivot, structural shift
 *   policy_tightening        — CB hiking cycle, quantitative tightening, rate normalisation
 *   fragmentation_conditions — regional divergence, multi-speed economy, geopolitical fracture
 *
 * Design rules:
 * - No deterministic historical claims — all observations use conditional language
 * - No hindsight certainty — past patterns are analytical reference, not prediction
 * - Competing frameworks always represented — no single-school dominance
 * - No execution logic — historical validation is advisory and educational only
 * - Hedged language: "historically associated with", "literature suggests", "may have"
 *
 * Safety assertions:
 *   isTradeInstruction  — always false
 *   isExecution         — always false
 *   isCertaintyAmplified — always false; conditional language enforced
 */

import type { StressLevel } from "@/services/market/marketIntelEngine";
import type { MacroCycleState } from "@/services/macro/globalMacroMemory";
import type { BehavioralLabel } from "@/services/intelligence/behavioralMarket";
import type { PortfolioConstructionLabel } from "@/services/portfolio/portfolioConstruction";
import type { FirewallState } from "@/services/governance/decisionFirewall";
import type { CrossMarketRegimeLabel } from "@/services/intelligence/crossMarketRegime";
import type { FrameworkFamily } from "@/services/intelligence/institutionalModels";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ValidationState =
  | "historically_resilient"    // framework historically showed resilience in detected environment
  | "regime_sensitive"          // historically variable; outcomes depend strongly on sub-regime
  | "historically_fragile"      // framework historically showed weaknesses in detected environment
  | "stress_vulnerable"         // concentration or leverage historically amplified drawdowns
  | "preservation_effective"    // preservation-oriented framework aligned with stress context
  | "concentration_sensitive"   // high-conviction framework; assumption concentration was key risk
  | "insufficient_history";     // environment signal too thin or framework-environment pair unclear

export type EnvironmentType =
  | "inflation_environment"     // persistent above-target inflation; real rate compression
  | "recession_conditions"      // contracting demand; broad defensive rotation
  | "liquidity_stress"          // funding stress; bid-ask widening; forced selling pressure
  | "volatility_expansion"      // elevated uncertainty; correlation regime shifts
  | "crisis_environment"        // acute systemic stress; dislocation; correlation breakdown
  | "macro_transition"          // policy inflection; regime change; structural shift
  | "policy_tightening"         // CB hiking cycle; QT; rising nominal and real rates
  | "fragmentation_conditions"  // regional divergence; multi-speed global economy
  | "no_clear_environment";     // insufficient signal for environment classification

// Internal performance label — maps to ValidationState after weighting
type HistoricalCharacteristic =
  | "historically_resilient"
  | "historically_fragile"
  | "stress_vulnerable"
  | "preservation_effective"
  | "concentration_sensitive"
  | "regime_sensitive"
  | "mixed";

export interface InstitutionalValidationInput {
  question: string;
  primaryFramework: FrameworkFamily;
  stressLevel: StressLevel;
  riskOnScore: number;              // -100..+100
  macroCycle: MacroCycleState;
  behavioralLabel: BehavioralLabel;
  portfolioConstructionLabel: PortfolioConstructionLabel;
  firewallState: FirewallState;
  crossMarketLabel: CrossMarketRegimeLabel;
  ar: boolean;
}

export interface InstitutionalValidationResult {
  validationState: ValidationState;
  detectedEnvironment: EnvironmentType;
  historicalLesson: string;         // 1 sentence, hedged language
  stressLesson: string | null;      // 1 sentence when stress-relevant; null otherwise
  resilienceObservation: string | null; // 1 sentence when resilience detected; null otherwise
  competingObservation: string | null;  // 1 sentence on competing framework view; null when none
  contextString: string;            // compact ≤180 chars for Genesis injection
  // Safety assertions — always enforced
  readonly isTradeInstruction: false;
  readonly isExecution: false;
  readonly isCertaintyAmplified: false;
}

// ─── Environment keyword patterns ─────────────────────────────────────────────

const INFLATION_PATTERN   = /inflat|CPI|real rate|yield|stagflat|price level|purchasing power|breakeven/i;
const RECESSION_PATTERN   = /recession|contraction|GDP|demand shock|hard landing|slowdown|deflat|growth scare/i;
const LIQUIDITY_PATTERN   = /liquidity|credit spread|funding|margin call|repo|illiquid|bid.ask|forced sell/i;
const VOLATILITY_PATTERN  = /volatility|VIX|uncertainty|regime shift|correlation|tail|dispersion/i;
const CRISIS_PATTERN      = /crisis|systemic|contagion|dislocation|bank run|financial stress|GFC|panic/i;
const TIGHTENING_PATTERN  = /tighten|hike|rate rise|QT|quantitative tighten|CB pivot|hawkish|restrictive/i;
const FRAGMENT_PATTERN    = /fragmentation|divergence|regional|multi.speed|decoupling|geopolit|fracture/i;

// ─── Environment detection ────────────────────────────────────────────────────

function detectEnvironment(input: InstitutionalValidationInput): EnvironmentType {
  const q = input.question;
  const { stressLevel, riskOnScore, macroCycle, behavioralLabel, crossMarketLabel } = input;

  // Crisis: acute systemic stress
  if (stressLevel === "high" && riskOnScore < -60 || CRISIS_PATTERN.test(q)) {
    return "crisis_environment";
  }
  // Liquidity stress: funding pressure or construction flag
  if (
    (stressLevel === "high" && (LIQUIDITY_PATTERN.test(q) || input.portfolioConstructionLabel === "hedge_needed_review")) ||
    LIQUIDITY_PATTERN.test(q)
  ) {
    return "liquidity_stress";
  }
  // Recession: risk-off + fear dominant
  if ((riskOnScore < -40 && behavioralLabel === "fear_dominant") || RECESSION_PATTERN.test(q)) {
    return "recession_conditions";
  }
  // Policy tightening: CB cycle
  if (macroCycle === "tightening_cycle" || TIGHTENING_PATTERN.test(q)) {
    // Tightening with inflation signal → inflation environment
    if (INFLATION_PATTERN.test(q)) return "inflation_environment";
    return "policy_tightening";
  }
  // Inflation environment (non-tightening)
  if (INFLATION_PATTERN.test(q)) return "inflation_environment";
  // Fragmentation: regional divergence
  if (macroCycle === "fragmented_cycle" || crossMarketLabel === "regime_divergence" || FRAGMENT_PATTERN.test(q)) {
    return "fragmentation_conditions";
  }
  // Macro transition: regime inflection
  if (macroCycle === "transition_cycle" || crossMarketLabel === "conflicting_regime") {
    return "macro_transition";
  }
  // Volatility expansion: stress but not crisis
  if (stressLevel === "elevated" || (stressLevel === "high" && riskOnScore > -60) || VOLATILITY_PATTERN.test(q)) {
    return "volatility_expansion";
  }
  return "no_clear_environment";
}

// ─── Historical performance lookup ────────────────────────────────────────────
// Based on publicly documented institutional research and widely cited academic literature.
// All observations are probabilistic and environment-conditional — not deterministic claims.

type EnvironmentMap = Record<EnvironmentType, HistoricalCharacteristic>;

const HISTORICAL_PERFORMANCE: Record<FrameworkFamily, EnvironmentMap> = {
  endowment: {
    inflation_environment:    "mixed",                  // real assets helped; bond duration hurt
    recession_conditions:     "historically_resilient", // diversification + long-horizon dampened drawdowns
    liquidity_stress:         "historically_fragile",   // illiquid holdings hard to exit in acute stress
    volatility_expansion:     "historically_resilient", // long-horizon horizon reduced vol impact
    crisis_environment:       "mixed",                  // diversification helped; illiquidity exposed in acute crisis
    macro_transition:         "regime_sensitive",       // allocation shifts lagged fast regime changes
    policy_tightening:        "mixed",                  // rate sensitivity in bond allocation; real assets buffered
    fragmentation_conditions: "historically_resilient", // multi-geographic diversification supported resilience
    no_clear_environment:     "regime_sensitive",
  },
  risk_parity: {
    inflation_environment:    "historically_fragile",   // bonds + equities both fell under persistent inflation
    recession_conditions:     "historically_resilient", // bond component typically appreciated in demand-shock recessions
    liquidity_stress:         "stress_vulnerable",      // leverage amplification in stress events
    volatility_expansion:     "stress_vulnerable",      // vol-targeting triggered derisking when vol spiked
    crisis_environment:       "mixed",                  // bond component helped; correlation breakdown was core risk
    macro_transition:         "regime_sensitive",       // designed for stable regime; transitions exposed assumptions
    policy_tightening:        "historically_fragile",   // bond component pressured; leverage constraints tightened
    fragmentation_conditions: "regime_sensitive",       // regional bond-equity correlation assumptions challenged
    no_clear_environment:     "regime_sensitive",
  },
  macro_hedge: {
    inflation_environment:    "historically_resilient", // flexible mandate; macro funds designed to capture rate trades
    recession_conditions:     "historically_resilient", // flexible mandate allowed defensive or short positioning
    liquidity_stress:         "regime_sensitive",       // performance depended on positioning at stress onset
    volatility_expansion:     "historically_resilient", // vol expansion created macro dislocation opportunities
    crisis_environment:       "historically_resilient", // flexible mandate allowed rapid repositioning
    macro_transition:         "historically_resilient", // regime transitions created core macro trade opportunities
    policy_tightening:        "historically_resilient", // tightening cycles historically provided macro entry points
    fragmentation_conditions: "historically_resilient", // regional divergence created multi-market allocation opportunities
    no_clear_environment:     "regime_sensitive",
  },
  sovereign_wealth: {
    inflation_environment:    "mixed",                  // inflation eroded fixed-income real returns; commodities helped
    recession_conditions:     "preservation_effective", // defensive orientation aligned with demand-shock resilience
    liquidity_stress:         "preservation_effective", // long-duration patient capital; no forced-selling pressure
    volatility_expansion:     "preservation_effective", // low drawdown mandate; no leverage to amplify vol
    crisis_environment:       "preservation_effective", // capital protection focus; patient capital structurally advantaged
    macro_transition:         "regime_sensitive",       // preservation mandate may under-react to positive transitions
    policy_tightening:        "mixed",                  // duration exposure pressured; patient capital not forced to sell
    fragmentation_conditions: "regime_sensitive",       // reserve management complex across fragmented global markets
    no_clear_environment:     "preservation_effective",
  },
  portfolio_governance: {
    inflation_environment:    "concentration_sensitive", // single-sector inflation correlation amplified by concentration
    recession_conditions:     "stress_vulnerable",       // drawdown amplified by concentrated exposure
    liquidity_stress:         "stress_vulnerable",       // concentrated positions faced bid-ask widening and forced liquidation
    volatility_expansion:     "stress_vulnerable",       // high-conviction exposure amplified vol impact
    crisis_environment:       "historically_fragile",    // crisis historically the primary risk of concentrated frameworks
    macro_transition:         "concentration_sensitive", // regime change invalidated single-thesis concentrated positions
    policy_tightening:        "concentration_sensitive", // rate-sensitive concentrated holdings had amplified duration risk
    fragmentation_conditions: "mixed",                   // regional concentration could benefit or suffer based on exposure
    no_clear_environment:     "regime_sensitive",
  },
};

// ─── ValidationState derivation ──────────────────────────────────────────────

function deriveValidationState(
  characteristic: HistoricalCharacteristic,
  environment: EnvironmentType,
): ValidationState {
  switch (characteristic) {
    case "historically_resilient": return "historically_resilient";
    case "historically_fragile":   return "historically_fragile";
    case "stress_vulnerable":      return "stress_vulnerable";
    case "preservation_effective": return "preservation_effective";
    case "concentration_sensitive": return "concentration_sensitive";
    case "regime_sensitive":       return "regime_sensitive";
    case "mixed":
      // Mixed: environment signals determine state
      if (environment === "crisis_environment" || environment === "liquidity_stress") return "historically_fragile";
      if (environment === "recession_conditions") return "regime_sensitive";
      return "regime_sensitive";
  }
}

// ─── Historical lesson notes ──────────────────────────────────────────────────

const ENV_LABELS_EN: Record<EnvironmentType, string> = {
  inflation_environment:    "persistent inflation",
  recession_conditions:     "recession conditions",
  liquidity_stress:         "liquidity stress",
  volatility_expansion:     "volatility expansion",
  crisis_environment:       "acute crisis conditions",
  macro_transition:         "macro regime transitions",
  policy_tightening:        "policy tightening cycles",
  fragmentation_conditions: "market fragmentation",
  no_clear_environment:     "current conditions",
};

const ENV_LABELS_AR: Record<EnvironmentType, string> = {
  inflation_environment:    "التضخم المستمر",
  recession_conditions:     "ظروف الركود",
  liquidity_stress:         "ضغط السيولة",
  volatility_expansion:     "التوسع في التقلب",
  crisis_environment:       "الأزمات الحادة",
  macro_transition:         "انتقالات النظام الكلي",
  policy_tightening:        "دورات التشديد النقدي",
  fragmentation_conditions: "تشرذم الأسواق",
  no_clear_environment:     "الظروف الحالية",
};

const FRAMEWORK_LABELS_EN: Record<FrameworkFamily, string> = {
  endowment:             "Endowment-style diversification",
  risk_parity:           "Risk-parity framework",
  macro_hedge:           "Macro-adaptive framework",
  sovereign_wealth:      "Sovereign wealth framework",
  portfolio_governance:  "Concentrated governance framework",
};

const FRAMEWORK_LABELS_AR: Record<FrameworkFamily, string> = {
  endowment:             "إطار التنويع الوقفي",
  risk_parity:           "إطار تعادل المخاطر",
  macro_hedge:           "الإطار التكيفي مع الماكرو",
  sovereign_wealth:      "إطار الثروة السيادية",
  portfolio_governance:  "إطار الحوكمة المركّزة",
};

function buildHistoricalLesson(
  framework: FrameworkFamily,
  state: ValidationState,
  env: EnvironmentType,
  ar: boolean,
): string {
  const envLabel = ar ? ENV_LABELS_AR[env] : ENV_LABELS_EN[env];
  const fwLabel = ar ? FRAMEWORK_LABELS_AR[framework] : FRAMEWORK_LABELS_EN[framework];

  if (ar) {
    switch (state) {
      case "historically_resilient":
        return `الأدبيات المؤسسية تُشير إلى أن ${fwLabel} أظهر تاريخياً مرونة خلال ${envLabel} — تُسهم الافتراضات الهيكلية في ذلك، غير أن ظروف الماضي قد لا تتكرر.`;
      case "historically_fragile":
        return `الأدبيات المؤسسية تُلاحظ أن ${fwLabel} أظهر تاريخياً نقاط ضعف خلال ${envLabel} — الافتراضات الرئيسية كانت الأكثر ضغطاً في تلك البيئة.`;
      case "stress_vulnerable":
        return `الأطر المركّزة والمدعومة بالرافعة المالية أظهرت تاريخياً تضخيم التراجعات خلال ${envLabel} — حجم المركز وسيولة الخروج كانا افتراضات جوهرية.`;
      case "preservation_effective":
        return `الأطر الموجهة نحو الحفاظ على رأس المال تتوافق تاريخياً مع ${envLabel} — الصبر الاستراتيجي وتجنب ضغط البيع القسري عزّزا المرونة.`;
      case "concentration_sensitive":
        return `الأطر عالية القناعة المركّزة تتطلب رقابة خاصة خلال ${envLabel} — الارتباط بين المراكز وحجمها كانا المتغيّرين الجوهريين.`;
      case "regime_sensitive":
        return `${fwLabel} أظهر تاريخياً أداءً يعتمد على النظام خلال ${envLabel} — تباينت النتائج بشكل ملحوظ وفقاً لتوقيت الانتقال وحجم الدورة.`;
      case "insufficient_history":
        return `سياق غير كافٍ لتصنيف تاريخي موثوق لـ${fwLabel} في ظل ${envLabel} — الإشارات رقيقة أو غامضة.`;
    }
  } else {
    switch (state) {
      case "historically_resilient":
        return `Institutional literature suggests ${fwLabel} historically showed resilience during ${envLabel} — structural assumptions contributed, though past conditions may not replicate.`;
      case "historically_fragile":
        return `Institutional literature notes ${fwLabel} historically showed vulnerabilities during ${envLabel} — core assumptions were the primary stress point in that environment.`;
      case "stress_vulnerable":
        return `Concentrated and leveraged frameworks historically showed amplified drawdowns during ${envLabel} — position sizing and exit liquidity were the critical assumptions.`;
      case "preservation_effective":
        return `Preservation-oriented frameworks historically aligned well with ${envLabel} — strategic patience and absence of forced-selling pressure supported resilience.`;
      case "concentration_sensitive":
        return `High-conviction concentrated frameworks historically required monitoring during ${envLabel} — position correlation and sizing were the key variables.`;
      case "regime_sensitive":
        return `${fwLabel} historically showed regime-dependent performance during ${envLabel} — outcomes varied materially based on transition timing and cycle magnitude.`;
      case "insufficient_history":
        return `Insufficient context for a reliable historical classification of ${fwLabel} under ${envLabel} — signals are thin or ambiguous.`;
    }
  }
}

function buildStressLesson(framework: FrameworkFamily, env: EnvironmentType, ar: boolean): string | null {
  if (env === "no_clear_environment") return null;

  if (ar) {
    if (framework === "risk_parity" && (env === "inflation_environment" || env === "policy_tightening")) {
      return "تاريخياً: الارتباط بين السندات والأسهم اختلّ خلال بيئات التضخم المستمر، مما شكّل نقطة ضغط جوهرية لأطر تعادل المخاطر.";
    }
    if (framework === "endowment" && (env === "liquidity_stress" || env === "crisis_environment")) {
      return "تاريخياً: الأصول غير السائلة أبطأت إعادة التوازن خلال الأزمات الحادة — التزامات السيولة كانت الافتراض الأكثر ضغطاً.";
    }
    if (framework === "portfolio_governance" && env !== "no_clear_environment") {
      return "تاريخياً: المراكز المركّزة وجدت صعوبة في الخروج أثناء الضغط — غياب التنويع ضخّم حجم التراجع بشكل ملحوظ.";
    }
    return null;
  } else {
    if (framework === "risk_parity" && (env === "inflation_environment" || env === "policy_tightening")) {
      return "Historical note: bond-equity correlation broke down during persistent inflation regimes — a core assumption stress point for risk-parity frameworks.";
    }
    if (framework === "endowment" && (env === "liquidity_stress" || env === "crisis_environment")) {
      return "Historical note: illiquid holdings slowed rebalancing during acute stress — liquidity commitments were the most pressured assumption.";
    }
    if (framework === "portfolio_governance" && env !== "no_clear_environment") {
      return "Historical note: concentrated positions faced amplified exit difficulty under stress — absence of diversification materially enlarged drawdown magnitude.";
    }
    return null;
  }
}

function buildResilienceObservation(state: ValidationState, framework: FrameworkFamily, ar: boolean): string | null {
  if (state !== "historically_resilient" && state !== "preservation_effective") return null;

  if (ar) {
    switch (framework) {
      case "macro_hedge":
        return "الأدبيات تُلاحظ أن الأطر الكلية المرنة تمكّنت من إعادة التموضع عبر الأنظمة — المرونة في التفويض والإدارة النشطة للمخاطر كانا العاملين الداعمين الرئيسيين.";
      case "sovereign_wealth":
        return "الأدبيات تُلاحظ أن رأس المال طويل الأجل الصبور تجنّب ضغط البيع القسري — الأفق الزمني والتزامات التمويل المنخفضة كانا العاملين الهيكليين المدعومين تاريخياً.";
      case "endowment":
        return "الأدبيات تُلاحظ أن التنويع الاستراتيجي عبر فئات الأصول وفّر حماية جزئية — عدة أصول تشاركت الصدمة بدلاً من تركّزها في قناة واحدة.";
      default:
        return null;
    }
  } else {
    switch (framework) {
      case "macro_hedge":
        return "Literature notes flexible macro frameworks were able to reposition across regimes — mandate flexibility and active risk management were the two historically supported structural factors.";
      case "sovereign_wealth":
        return "Literature notes long-duration patient capital avoided forced-selling pressure — time horizon and low funding commitments were the historically supported structural advantages.";
      case "endowment":
        return "Literature notes strategic diversification across asset classes provided partial shock absorption — multiple assets shared the stress rather than concentrating it in one channel.";
      default:
        return null;
    }
  }
}

function buildCompetingObservation(framework: FrameworkFamily, state: ValidationState, ar: boolean): string | null {
  if (ar) {
    switch (framework) {
      case "risk_parity":
        return "الرأي المنافس: المؤيدون للقناعة المركّزة يرون أن التنويع بالتقلب يُخفّف العائد في الأنظمة الممتازة ويُقدّم الاتساق على حساب الأداء المتفوق.";
      case "endowment":
        return "الرأي المنافس: المطلعون التكتيكيون يرون أن الأهداف الزمنية الثابتة تُقيّد المرونة عندما يُحدّد تحليل النظام فرصاً لإعادة التخصيص.";
      case "portfolio_governance":
        return "الرأي المنافس: النهج الانتقائي الموسّع يرى أن التنويع المناسب يُقلّل الخسائر الناجمة عن التركز دون التضحية الضرورية بالعوائد.";
      case "sovereign_wealth":
        return "الرأي المنافس: الأطر الانتهازية ترى أن الصبر المفرط يُضيّع علاوات مخاطر غير متماثلة في الدورات الإيجابية الواضحة.";
      case "macro_hedge":
        return "الرأي المنافس: المنهج الأساسي البنيوي يرى أن التخصيص المبني على النظام يُضيّع فرص التسعير الخاطئ الخاص بالأصل التي تُفوّتها الاستراتيجيات الكلية التقديرية.";
    }
  } else {
    switch (framework) {
      case "risk_parity":
        return "Competing view: conviction-concentration advocates argue volatility-weighting dilutes return in premium regimes, trading consistency for underperformance during trending markets.";
      case "endowment":
        return "Competing view: tactical practitioners argue fixed allocation targets constrain flexibility when regime analysis identifies reallocation opportunities.";
      case "portfolio_governance":
        return "Competing view: selective broadening approach argues appropriate diversification reduces concentration-driven drawdowns without necessary return sacrifice.";
      case "sovereign_wealth":
        return "Competing view: opportunistic frameworks argue excessive patience forgoes asymmetrically favourable risk premia in clearly positive cycles.";
      case "macro_hedge":
        return "Competing view: structural fundamental approach argues regime-driven allocation misses asset-specific mispricings that discretionary macro strategies systematically overlook.";
    }
  }
}

// ─── Context string builder ───────────────────────────────────────────────────

function buildContextString(
  state: ValidationState,
  env: EnvironmentType,
  framework: FrameworkFamily,
): string {
  if (state === "insufficient_history" || env === "no_clear_environment") return "";

  const envLabel = ENV_LABELS_EN[env];
  const stateLabel = state.replace(/_/g, " ");
  const fwLabel = framework.replace(/_/g, " ");

  return `Historical validation: ${stateLabel} / ${fwLabel} under ${envLabel}`.slice(0, 180);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeInstitutionalValidation(input: InstitutionalValidationInput): InstitutionalValidationResult {
  const { primaryFramework, firewallState, ar } = input;

  // Firewall block: return safe insufficient state immediately
  if (firewallState === "blocked") {
    return {
      validationState: "insufficient_history",
      detectedEnvironment: "no_clear_environment",
      historicalLesson: ar
        ? "التحقق التاريخي معلّق — جدار الحماية محجوب."
        : "Historical validation suspended — firewall blocked.",
      stressLesson: null,
      resilienceObservation: null,
      competingObservation: null,
      contextString: "",
      isTradeInstruction: false,
      isExecution: false,
      isCertaintyAmplified: false,
    };
  }

  const env = detectEnvironment(input);
  const characteristic = HISTORICAL_PERFORMANCE[primaryFramework][env];
  const validationState = deriveValidationState(characteristic, env);

  const historicalLesson = buildHistoricalLesson(primaryFramework, validationState, env, ar);
  const stressLesson = buildStressLesson(primaryFramework, env, ar);
  const resilienceObservation = buildResilienceObservation(validationState, primaryFramework, ar);
  const competingObservation = buildCompetingObservation(primaryFramework, validationState, ar);
  const contextString = buildContextString(validationState, env, primaryFramework);

  return {
    validationState,
    detectedEnvironment: env,
    historicalLesson,
    stressLesson,
    resilienceObservation,
    competingObservation,
    contextString,
    isTradeInstruction: false,
    isExecution: false,
    isCertaintyAmplified: false,
  };
}
