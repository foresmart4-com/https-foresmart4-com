/**
 * Decision Memory Intelligence — Phase 53
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Derives governed compressed analytical patterns from current session
 * intelligence signals. This is reasoning memory — not trade memory.
 *
 * Memory classes:
 *   framework_strength       — current framework showing coherence with signals
 *   framework_failure        — current framework contradicted by validation or stress
 *   regime_pattern           — recurring macro cycle behaviour detected
 *   risk_lesson              — specific risk surfaced by current analysis
 *   uncertainty_lesson       — key unresolved variable identified by governance
 *   competing_framework_case — two competing philosophies both have evidence
 *
 * Memory states:
 *   durable_pattern      — strong consistent cross-module signal confirmation
 *   candidate_memory     — pattern emerging; not yet confirmed across modules
 *   debated_pattern      — competing interpretations both supported; no consensus
 *   weak_pattern         — thin or mixed signals; pattern tentative
 *   governance_review    — governance or firewall flag warrants human attention
 *
 * Design rules:
 * - Bounded: derives at most 2 pattern observations per call
 * - Compressed: no raw logs, no personal data, no context explosion
 * - No autonomous growth: outputs are derived fresh each call, not appended
 * - No automatic truth: patterns are probabilistic and conditional
 * - Competing schools always preserved: disagreement is surfaced, not resolved
 * - No certainty amplification: hedged language enforced throughout
 * - Governance supervises: firewall and governance state override pattern output
 *
 * Safety assertions:
 *   isTradeMemory       — always false; analytical patterns only
 *   isExecution         — always false; no broker or order logic
 *   isAutonomousGrowth  — always false; no persistent storage or self-appending
 */

import type { FirewallState } from "@/services/governance/decisionFirewall";
import type { GovernanceState } from "@/services/governance/governanceOS";
import type { CalibrationScore } from "@/services/learning/decisionScoring";
import type { DebateBalance } from "@/services/intelligence/debateEngine";
import type { ThesisLabState } from "@/services/intelligence/thesisLab";
import type { StrategicBias } from "@/services/intelligence/strategicEngine";
import type { CompetingPhilosophy, ModelState } from "@/services/intelligence/institutionalModels";
import type { ValidationState } from "@/services/intelligence/institutionalValidation";
import type { BehavioralLabel } from "@/services/intelligence/behavioralMarket";
import type { MacroCycleState } from "@/services/macro/globalMacroMemory";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MemoryClass =
  | "framework_strength"       // framework showing current coherence with market signals
  | "framework_failure"        // framework contradicted by validation or stress signals
  | "regime_pattern"           // persistent macro cycle behaviour detected this session
  | "risk_lesson"              // specific risk surfaced by current analysis
  | "uncertainty_lesson"       // key unresolved variable identified by governance
  | "competing_framework_case";// competing philosophies both have current evidence

export type MemoryState =
  | "durable_pattern"    // strong cross-module signal confirmation
  | "candidate_memory"   // pattern emerging but not yet confirmed
  | "debated_pattern"    // competing interpretations both supported
  | "weak_pattern"       // thin or mixed signals; pattern tentative
  | "governance_review"; // governance or firewall flag warrants human attention

export interface DecisionMemoryInput {
  modelState: ModelState;
  validationState: ValidationState;
  competingPhilosophy: CompetingPhilosophy;
  governanceState: GovernanceState;
  firewallState: FirewallState;
  calibrationScore: CalibrationScore;
  debateBalance: DebateBalance;
  thesisState: ThesisLabState;
  strategicBias: StrategicBias;
  behavioralLabel: BehavioralLabel;
  macroCycle: MacroCycleState;
  ar: boolean;
}

export interface DecisionMemoryResult {
  memoryState: MemoryState;
  primaryMemoryClass: MemoryClass;
  patternNote: string;          // 1 sentence, hedged language
  riskLesson: string | null;    // 1 sentence risk observation; null when not applicable
  contextString: string;        // compact ≤180 chars for Genesis injection
  // Safety assertions — always enforced; no exceptions
  readonly isTradeMemory: false;
  readonly isExecution: false;
  readonly isAutonomousGrowth: false;
}

// ─── Signal scoring ───────────────────────────────────────────────────────────

interface MemorySignals {
  strengthScore: number;        // framework_strength evidence
  failureScore: number;         // framework_failure evidence
  regimeScore: number;          // regime_pattern evidence
  riskScore: number;            // risk_lesson evidence
  uncertaintyScore: number;     // uncertainty_lesson evidence
  competingScore: number;       // competing_framework_case evidence
}

function scoreMemorySignals(input: DecisionMemoryInput): MemorySignals {
  const {
    modelState, validationState, competingPhilosophy,
    governanceState, calibrationScore, debateBalance,
    thesisState, strategicBias, behavioralLabel, macroCycle,
  } = input;

  // Framework strength: validation resilient + coherent governance + supported thesis
  let strengthScore = 0;
  if (validationState === "historically_resilient" || validationState === "preservation_effective") strengthScore += 3;
  if (governanceState === "coherent") strengthScore += 2;
  if (thesisState === "supported_thesis" || thesisState === "monitored_thesis") strengthScore += 2;
  if (calibrationScore === "well_calibrated" || calibrationScore === "moderately_calibrated") strengthScore += 1;
  if (strategicBias === "constructive" || strategicBias === "opportunistic") strengthScore += 1;

  // Framework failure: validation fragile + governance flags + invalidated thesis
  let failureScore = 0;
  if (validationState === "historically_fragile" || validationState === "stress_vulnerable") failureScore += 3;
  if (governanceState === "conflict_detected" || governanceState === "human_review_priority") failureScore += 2;
  if (thesisState === "invalidated_thesis" || thesisState === "fragile_thesis") failureScore += 2;
  if (calibrationScore === "weakly_calibrated") failureScore += 1;
  if (modelState === "high_risk_concentration") failureScore += 2;

  // Regime pattern: persistent macro cycle + cross-module alignment
  let regimeScore = 0;
  if (macroCycle === "tightening_cycle" || macroCycle === "easing_cycle") regimeScore += 2;
  if (macroCycle === "stable_cycle") regimeScore += 3;
  if (thesisState === "supported_thesis") regimeScore += 1;
  if (validationState === "regime_sensitive") regimeScore += 2;

  // Risk lesson: stress signals + concentration + governance warnings
  let riskScore = 0;
  if (modelState === "high_risk_concentration" || modelState === "stress_vulnerable") riskScore += 3;
  if (modelState === "liquidity_sensitive") riskScore += 2;
  if (validationState === "stress_vulnerable" || validationState === "historically_fragile") riskScore += 2;
  if (governanceState === "conflict_detected" || governanceState === "elevated_uncertainty") riskScore += 1;
  if (behavioralLabel === "fear_dominant" || behavioralLabel === "crowded_positioning") riskScore += 1;

  // Uncertainty lesson: governance flags + calibration weakness + thesis conflict
  let uncertaintyScore = 0;
  if (governanceState === "elevated_uncertainty" || governanceState === "human_review_priority") uncertaintyScore += 3;
  if (calibrationScore === "weakly_calibrated" || calibrationScore === "insufficient_data") uncertaintyScore += 2;
  if (thesisState === "competing_theses" || thesisState === "fragile_thesis") uncertaintyScore += 2;
  if (debateBalance === "contested") uncertaintyScore += 1;

  // Competing framework case: philosophy detected + debate active + calibration mixed
  let competingScore = 0;
  if (competingPhilosophy !== "none") competingScore += 3;
  if (debateBalance === "contested") competingScore += 2;
  if (thesisState === "competing_theses") competingScore += 2;
  if (calibrationScore === "moderately_calibrated") competingScore += 1;
  if (validationState === "regime_sensitive") competingScore += 1;

  return { strengthScore, failureScore, regimeScore, riskScore, uncertaintyScore, competingScore };
}

// ─── Primary memory class selection ──────────────────────────────────────────

function selectPrimaryClass(signals: MemorySignals, input: DecisionMemoryInput): MemoryClass {
  // Governance override: human review priority → uncertainty lesson
  if (input.governanceState === "human_review_priority" || input.firewallState === "blocked") {
    return "uncertainty_lesson";
  }

  const entries: [MemoryClass, number][] = [
    ["framework_strength",       signals.strengthScore],
    ["framework_failure",        signals.failureScore],
    ["regime_pattern",           signals.regimeScore],
    ["risk_lesson",              signals.riskScore],
    ["uncertainty_lesson",       signals.uncertaintyScore],
    ["competing_framework_case", signals.competingScore],
  ];

  const top = entries.sort((a, b) => b[1] - a[1])[0];
  // If top score is very low, default to uncertainty
  if (top[1] < 2) return "uncertainty_lesson";
  return top[0];
}

// ─── Memory state derivation ──────────────────────────────────────────────────

function deriveMemoryState(
  memoryClass: MemoryClass,
  input: DecisionMemoryInput,
  signals: MemorySignals,
): MemoryState {
  // Governance review: firewall or human review priority always overrides
  if (input.firewallState === "blocked" || input.governanceState === "human_review_priority") {
    return "governance_review";
  }
  // Conflict detected: debated or governance conflict
  if (input.governanceState === "conflict_detected" || input.debateBalance === "contested") {
    return "debated_pattern";
  }

  // Internal competition: both strength and competing signals are strong → debated_pattern
  // prevents false framework_strength durable from single-source alignment
  if (signals.competingScore >= 4 && signals.strengthScore >= 4) {
    return "debated_pattern";
  }

  const dominantScore = Math.max(
    signals.strengthScore, signals.failureScore, signals.regimeScore,
    signals.riskScore, signals.uncertaintyScore, signals.competingScore,
  );

  // Threshold raised to 7 to prevent false durable_pattern from single-source alignment
  if (dominantScore >= 7) return "durable_pattern";
  if (dominantScore >= 4) return "candidate_memory";
  if (dominantScore >= 2) return "weak_pattern";
  return "weak_pattern";
}

// ─── Pattern notes ────────────────────────────────────────────────────────────

function buildPatternNote(
  memoryClass: MemoryClass,
  memoryState: MemoryState,
  input: DecisionMemoryInput,
  ar: boolean,
): string {
  const { modelState, validationState, competingPhilosophy, macroCycle } = input;

  if (ar) {
    switch (memoryClass) {
      case "framework_strength":
        return `نمط ${memoryState.replace(/_/g, " ")} محتمل: الإطار المؤسسي الحالي يُبدي تماسكاً مع الإشارات — لكن التوافق المؤقت لا يُثبت الموثوقية الهيكلية.`;
      case "framework_failure":
        return `ملاحظة إطار ضعيف: الإشارات الحالية تتعارض مع الافتراضات التاريخية للإطار — ${validationState.replace(/_/g, " ")} يُشير إلى تحديات محتملة في هذا النظام.`;
      case "regime_pattern":
        return `نمط نظام متكرر: دورة ${macroCycle.replace(/_/g, " ")} تُبدي إشارات متسقة عبر مصادر متعددة — الأنظمة المستمرة نادراً ما تنتهي دون محفز محدد.`;
      case "risk_lesson":
        return `درس مخاطرة محتمل: التركز مع ضغط التحقق يُشير إلى احتمالية تضخيم التراجع — هذا المزيج يُظهر تاريخياً قيوداً في المرونة خلال الضغط.`;
      case "uncertainty_lesson":
        return `درس عدم يقين: إشارات الحوكمة وعدم الاتساق في المعايرة تُلاحظ معاً — مزيج من قيود الأدلة يُقيّد المصداقية التحليلية في هذه المرحلة.`;
      case "competing_framework_case":
        return `توتر إطارين نشط: ${competingPhilosophy.replace(/_/g, " ")} يُشير إلى أن كلا المنهجين مدعومان بالسياق الحالي — التعارض تحليلي وليس قابلاً للحل آلياً.`;
    }
  } else {
    switch (memoryClass) {
      case "framework_strength":
        return `Possible ${memoryState.replace(/_/g, " ")}: the current institutional framework shows coherence with signals — however, temporary alignment does not confirm structural reliability.`;
      case "framework_failure":
        return `Framework weakness observation: current signals contradict the framework's historical assumptions — ${validationState.replace(/_/g, " ")} suggests potential challenges in this regime.`;
      case "regime_pattern":
        return `Recurring regime pattern: ${macroCycle.replace(/_/g, " ")} cycle is showing consistent signals across multiple sources — persistent regimes historically do not end without a specific catalyst.`;
      case "risk_lesson":
        return `Potential risk lesson: concentration with validation stress suggests drawdown amplification risk — this combination has historically shown resilience limitations under pressure.`;
      case "uncertainty_lesson":
        return `Uncertainty lesson: governance flags and calibration inconsistency noted together — a combination of evidence constraints limits analytical confidence at this stage.`;
      case "competing_framework_case":
        return `Active framework tension: ${competingPhilosophy.replace(/_/g, " ")} suggests both approaches have current contextual support — the disagreement is analytical and not mechanically resolvable.`;
    }
  }
}

function buildRiskLesson(
  memoryClass: MemoryClass,
  input: DecisionMemoryInput,
  ar: boolean,
): string | null {
  const { modelState, validationState } = input;

  if (memoryClass !== "risk_lesson" && memoryClass !== "framework_failure") return null;
  if (modelState === "insufficient_model_context") return null;

  if (ar) {
    if (modelState === "high_risk_concentration" || modelState === "concentrated_framework") {
      return "التركز يُقيّد منافع التنويع في الأنظمة التي تُعاقب على تكتل المخاطر — مراجعة الهامش المحمي قد تكون مناسبة.";
    }
    if (validationState === "stress_vulnerable") {
      return "الأطر القائمة على الرافعة أو المركّزة تاريخياً ضخّمت الخسائر خلال انهيار السيولة — الأصول المكتظة الموزونة بالتقلب كانت الأكثر عرضة للضغط.";
    }
    if (validationState === "historically_fragile") {
      return "الافتراض الجوهري الذي ضغطه هذا النظام تاريخياً هو الارتباط بين الأصول — إذا كان متسقاً للخطأ، فقد تمتد الخسائر إلى فئات أصول متعددة.";
    }
    return null;
  } else {
    if (modelState === "high_risk_concentration" || modelState === "concentrated_framework") {
      return "Concentration limits diversification benefit in regimes that penalise risk clustering — reviewing the buffer margin may be appropriate.";
    }
    if (validationState === "stress_vulnerable") {
      return "Leveraged or concentrated frameworks historically amplified drawdowns during liquidity collapses — volatility-weighted crowded assets were the most pressure-exposed.";
    }
    if (validationState === "historically_fragile") {
      return "The core assumption pressured by this regime historically is asset correlation — if wrong directionally, losses can extend across multiple asset classes.";
    }
    return null;
  }
}

// ─── Context string builder ───────────────────────────────────────────────────

function buildContextString(
  memoryState: MemoryState,
  memoryClass: MemoryClass,
  riskLesson: string | null,
  ar: boolean,
): string {
  if (memoryState === "weak_pattern" && memoryClass === "uncertainty_lesson") return "";

  const statePart = `Decision memory: ${memoryState.replace(/_/g, " ")}`;
  const classPart = memoryClass !== "uncertainty_lesson"
    ? `; ${memoryClass.replace(/_/g, " ")}`
    : "";

  // Add compact risk lesson label when present
  const riskPart = riskLesson && memoryClass === "risk_lesson"
    ? `; Risk lesson: ${riskLesson.slice(0, 60)}`
    : "";

  return `${statePart}${classPart}${riskPart}`.slice(0, 180);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeDecisionMemory(input: DecisionMemoryInput): DecisionMemoryResult {
  const { firewallState, governanceState, ar } = input;

  // Firewall block: return governance_review immediately
  if (firewallState === "blocked") {
    return {
      memoryState: "governance_review",
      primaryMemoryClass: "uncertainty_lesson",
      patternNote: ar
        ? "ذاكرة القرار معلّقة — جدار الحماية محجوب."
        : "Decision memory suspended — firewall blocked.",
      riskLesson: null,
      contextString: "",
      isTradeMemory: false,
      isExecution: false,
      isAutonomousGrowth: false,
    };
  }

  const signals = scoreMemorySignals(input);
  const primaryMemoryClass = selectPrimaryClass(signals, input);
  const memoryState = deriveMemoryState(primaryMemoryClass, input, signals);
  const patternNote = buildPatternNote(primaryMemoryClass, memoryState, input, ar);
  const riskLesson = buildRiskLesson(primaryMemoryClass, input, ar);
  const contextString = buildContextString(memoryState, primaryMemoryClass, riskLesson, ar);

  return {
    memoryState,
    primaryMemoryClass,
    patternNote,
    riskLesson,
    contextString,
    isTradeMemory: false,
    isExecution: false,
    isAutonomousGrowth: false,
  };
}
