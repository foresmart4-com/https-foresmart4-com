// Reasoning Dominance Governor
// Generates a directive that forces institutional reasoning to control the final
// output, preventing template-driven response dominance.
//
// Root causes addressed:
//   - Template-driven response dominance
//   - UI schema overriding cognition
//   - Institutional reasoning not controlling final output
//
// This governor:
//   1. Detects the dominant reasoning pattern from question intent + context
//   2. Generates a directive mandating reasoning-first, template-second
//   3. Enforces institutional memo order: direct verdict → allocator → thesis
//      → counter → analog → conviction → thesis changer → CIO framing
//   4. Prevents generic synthesis by mandating specific field content sequence
//
// The directive is injected AFTER the narrator directive (last in prompt = max
// recency = strongest influence on AI output generation order).
// No AI calls. No network. Pure deterministic. O(1).

export type DominancePattern =
  | "thesis_led"       // thesis + case structure dominates
  | "cio_led"          // CIO allocator framing dominates
  | "historical_led"   // historical analog dominates output order
  | "allocator_led"    // deployment decision dominates
  | "general";         // standard investment reasoning

export interface ReasoningDominanceResult {
  directive: string;
  dominancePattern: DominancePattern;
  reasoningFirst: boolean;
  directiveLength: number;
}

function detectPattern(
  questionIntent: string,
  isSaudi: boolean,
  isInvestment: boolean,
): DominancePattern {
  if (questionIntent === "cio_institutional") return "cio_led";
  if (questionIntent === "historical_query") return "historical_led";
  if (questionIntent === "allocator_query") return "allocator_led";
  if (questionIntent === "thesis_debate") return "thesis_led";
  if (isInvestment && isSaudi) return "cio_led";
  if (isInvestment) return "thesis_led";
  return "general";
}

function buildDirective(pattern: DominancePattern, lang: "ar" | "en"): string {
  const ar = lang === "ar";

  const BASE = ar
    ? "[REASONING DOMINANCE] اكتب كمذكرة استثمارية مؤسسية — لا كملء نموذج. فكّر في تحليلك الكامل أولاً، ثم عيّن الحقول. ابدأ thesis/baseCase بحكم مباشر لا بوصف."
    : "[REASONING DOMINANCE] Write as an institutional investment memorandum — not a form fill. Reason through your full analysis first, then assign fields. Begin thesis/baseCase with a direct verdict, not a description.";

  const PATTERNS: Record<DominancePattern, string> = {
    cio_led: ar
      ? `${BASE} ترتيب التفكير المؤسسي: (1) الحكم المباشر → thesis/baseCase (2) موقف النشر → voiceReasoning.allocator (3) الحالة الصاعدة والهابطة → bullCase/bearCase/opposingCase (4) النظير التاريخي → voiceReasoning.historical (5) ما يختلف الآن → caveats (6) القناعة والحد → confidence + confidenceCalibration (7) مُغيّر الأطروحة → thesisChanger (8) الموقف النهائي لكبير المستثمرين → committeeSynthesis.finalStance.`
      : `${BASE} Institutional reasoning order: (1) Direct verdict → thesis/baseCase (2) Deployment stance → voiceReasoning.allocator (3) Bull + bear case → bullCase/bearCase/opposingCase (4) Historical analog → voiceReasoning.historical (5) What differs now → caveats (6) Conviction + ceiling → confidence + confidenceCalibration (7) Thesis changer → thesisChanger (8) Final CIO stance → committeeSynthesis.finalStance.`,
    thesis_led: ar
      ? `${BASE} (1) الأطروحة مباشرة → thesis (2) الحالة الصاعدة ثم الهابطة (3) موقف المخصص (4) ما يكسر الأطروحة → thesisChanger/invalidation.`
      : `${BASE} (1) Direct thesis verdict first → thesis (2) Bull then bear case (3) Allocator stance (4) What breaks the thesis → thesisChanger/invalidation.`,
    historical_led: ar
      ? `${BASE} (1) ابدأ بالنظير التاريخي المحدد → voiceReasoning.historical (2) ما يختلف اليوم → caveats (3) الحكم الاستثماري المستخلص → thesis.`
      : `${BASE} (1) Lead with specific historical analog → voiceReasoning.historical (2) What differs today → caveats (3) Derived investment verdict → thesis.`,
    allocator_led: ar
      ? `${BASE} (1) قرار النشر أولاً (دخول تدريجي/انتظار/تجنب) → voiceReasoning.allocator (2) الدليل الداعم (3) شرط الإلغاء → invalidation.`
      : `${BASE} (1) Deployment decision first (scale-in / wait / avoid with reason) → voiceReasoning.allocator (2) Supporting evidence (3) Invalidation condition → invalidation.`,
    general: ar
      ? `${BASE} ضع الحكم المباشر في thesis أو baseCase — لا تُفرغ الأطروحة في outlook بصياغة عامة.`
      : `${BASE} Place direct verdict in thesis or baseCase — do not dilute the thesis into generic outlook text.`,
  };

  return PATTERNS[pattern] ?? BASE;
}

export function buildReasoningDominance(
  questionIntent: string,
  isSaudi: boolean,
  isInvestment: boolean,
  lang: "ar" | "en",
): ReasoningDominanceResult {
  if (!isInvestment) {
    return { directive: "", dominancePattern: "general", reasoningFirst: false, directiveLength: 0 };
  }
  const pattern = detectPattern(questionIntent, isSaudi, isInvestment);
  const directive = buildDirective(pattern, lang);
  return {
    directive,
    dominancePattern: pattern,
    reasoningFirst: true,
    directiveLength: directive.length,
  };
}
