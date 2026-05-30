// Experience Validator
// Scores a Genesis response rendering for institutional quality.
// Flags "regime_dashboard_failure" when cards dominate over reasoning.
//
// Scoring dimensions:
//   memoDominance      — is memo/reasoning the primary content? (0-100)
//   reasoningVisibility — is committee reasoning surfaced? (0-100)
//   questionCompliance  — is the question directly answered? (0-100)
//   cardDependence      — how regime/card-heavy is the response? (0=best, 100=worst)
//   institutionalQuality — composite quality score (0-100)
//
// PASS criteria: institutionalQuality >= 70, cardDependence <= 30

export interface ExperienceScore {
  memoDominance: number;        // 0-100: does the memo/reasoning dominate?
  reasoningVisibility: number;  // 0-100: is reasoning surfaced early?
  questionCompliance: number;   // 0-100: is the question directly answered?
  cardDependence: number;       // 0-100: lower is better (0 = no card dependence)
  institutionalQuality: number; // 0-100: composite
  flags: ExperienceFlag[];
  grade: "PASS" | "FAIL";
  diagnosis: string;
  diagnosisAr: string;
}

export type ExperienceFlag =
  | "regime_dashboard_failure"   // regime is primary surfaced element
  | "memo_absent"                // no institutional memo in response
  | "reasoning_hidden"           // committee reasoning not present
  | "cards_dominate"             // card count > reasoning depth
  | "question_unanswered"        // headline doesn't directly answer the question
  | "allocator_logic_absent"     // no allocator voice or reasoning
  | "historical_analog_absent"   // no historical analog surfaced
  | "counter_thesis_absent"      // no counter-thesis or bear case

export interface ValidationInput {
  reply: {
    institutionalMemo?: string;
    headline?: string;
    thesis?: string;
    regime?: string;
    voiceReasoning?: { allocator?: string; macro?: string; historical?: string; policy?: string; behavioral?: string };
    committeeSynthesis?: { finalStance?: string; agreement?: string; disagreement?: string };
    frameworkSynthesis?: string;
    perspectiveMap?: string;
    bullCase?: string;
    bearCase?: string;
    baseCase?: string;
    macroChain?: string;
    evidence?: string[];
    keyDrivers?: string[];
    scenarios?: Array<{ label: string; probability: string; impact: string }>;
    opposingCase?: string;
    caveats?: string[];
    invalidation?: string;
    confidence?: number;
    reasoningDepth?: string;
    qualityTier?: string;
    judgmentGrade?: string;
  };
  engine: "ai" | "heuristic";
  question: string;
}

function scorePresence(value: string | undefined | null, weight: number): number {
  if (!value || !value.trim()) return 0;
  const len = value.trim().length;
  if (len < 30) return Math.round(weight * 0.3);
  if (len < 100) return Math.round(weight * 0.7);
  return weight;
}

export function validateExperience(input: ValidationInput): ExperienceScore {
  const { reply, engine, question } = input;
  const flags: ExperienceFlag[] = [];

  if (engine !== "ai") {
    return {
      memoDominance: 0,
      reasoningVisibility: 0,
      questionCompliance: 30,
      cardDependence: 60,
      institutionalQuality: 20,
      flags: ["regime_dashboard_failure", "memo_absent", "reasoning_hidden"],
      grade: "FAIL",
      diagnosis: "Heuristic fallback — no institutional reasoning available",
      diagnosisAr: "احتياطي هيوريستي — لا استدلال مؤسسي متاح",
    };
  }

  // ── Memo Dominance (0-100) ─────────────────────────────────────────────────
  let memoDominance = 0;
  const memoText = reply.institutionalMemo?.trim() ?? "";
  if (memoText.length > 200) {
    memoDominance += 50;
    // Bonus for containing key institutional sections
    if (/DIRECT ANSWER|الحكم المباشر/i.test(memoText)) memoDominance += 10;
    if (/ALLOCATOR|المخصص/i.test(memoText)) memoDominance += 10;
    if (/HISTORICAL|التاريخي/i.test(memoText)) memoDominance += 10;
    if (/COUNTER|مضادة/i.test(memoText)) memoDominance += 10;
    if (/CIO|كبير المستثمرين/i.test(memoText)) memoDominance += 10;
  } else if (reply.thesis || reply.headline) {
    memoDominance += 20;
    flags.push("memo_absent");
  } else {
    flags.push("memo_absent");
  }
  memoDominance = Math.min(100, memoDominance);

  // ── Reasoning Visibility (0-100) ──────────────────────────────────────────
  let reasoningVisibility = 0;
  const vr = reply.voiceReasoning;
  reasoningVisibility += scorePresence(vr?.allocator, 25);
  reasoningVisibility += scorePresence(vr?.macro, 15);
  reasoningVisibility += scorePresence(vr?.historical, 20);
  reasoningVisibility += scorePresence(vr?.policy, 10);
  reasoningVisibility += scorePresence(vr?.behavioral, 10);
  reasoningVisibility += scorePresence(reply.committeeSynthesis?.finalStance, 10);
  reasoningVisibility += scorePresence(reply.frameworkSynthesis, 10);
  if (reasoningVisibility < 30) flags.push("reasoning_hidden");
  if (!vr?.allocator && !reply.frameworkSynthesis) flags.push("allocator_logic_absent");
  if (!vr?.historical && !reply.macroChain) flags.push("historical_analog_absent");
  reasoningVisibility = Math.min(100, reasoningVisibility);

  // ── Question Compliance (0-100) ────────────────────────────────────────────
  let questionCompliance = 0;
  const headline = reply.headline?.trim() ?? "";
  const thesis = reply.thesis?.trim() ?? "";
  const directContent = headline || thesis;
  if (directContent.length > 20) {
    questionCompliance += 40;
    // Check that headline is not just a regime label
    const isRegimeLabel = /^(risk.on|risk.off|volatile|mixed|neutral|bullish|bearish)\s*$/i.test(directContent);
    if (!isRegimeLabel) questionCompliance += 20;
    // Check for investment-specific language
    if (/\b(should|recommend|position|allocate|overweight|underweight|hold|buy|sell|avoid|consider|prefer|suggest|strategy|thesis|view|conviction)\b/i.test(directContent)) {
      questionCompliance += 20;
    }
    // Check that it plausibly relates to the question
    const qWords = question.toLowerCase().split(/\W+/).filter(w => w.length > 4);
    const matchCount = qWords.filter(w => directContent.toLowerCase().includes(w)).length;
    if (matchCount > 0) questionCompliance += Math.min(20, matchCount * 5);
  } else {
    flags.push("question_unanswered");
  }
  if (!reply.bearCase && !reply.opposingCase) flags.push("counter_thesis_absent");
  questionCompliance = Math.min(100, questionCompliance);

  // ── Card Dependence (0-100, lower is better) ──────────────────────────────
  // Cards are: regime badge, MarketIntelPanel, scenarios (primary), confidence bar (primary)
  // We score based on how much the reply relies on regime/card structure vs reasoning
  let cardDependence = 0;
  // High card dependence signals:
  if (!memoText) cardDependence += 30;                  // no memo = card-first structure
  if (!directContent || directContent.length < 30) cardDependence += 20; // no direct answer
  if (reasoningVisibility < 30) cardDependence += 20;  // no reasoning = card padding
  if (reply.regime && !memoText) cardDependence += 10; // regime without memo = dashboard mode
  if ((reply.scenarios?.length ?? 0) > 0 && !memoText) cardDependence += 10; // scenarios without memo
  if (reply.reasoningDepth === "shallow") cardDependence += 10;
  cardDependence = Math.min(100, cardDependence);

  if (cardDependence >= 50) flags.push("cards_dominate");
  if (reply.regime && !memoText && !directContent) flags.push("regime_dashboard_failure");

  // ── Institutional Quality (composite) ─────────────────────────────────────
  const institutionalQuality = Math.round(
    memoDominance * 0.35 +
    reasoningVisibility * 0.30 +
    questionCompliance * 0.25 +
    (100 - cardDependence) * 0.10,
  );

  const grade: "PASS" | "FAIL" = institutionalQuality >= 70 && cardDependence <= 30 ? "PASS" : "FAIL";

  // ── Diagnosis ─────────────────────────────────────────────────────────────
  let diagnosis: string;
  let diagnosisAr: string;
  if (grade === "PASS") {
    diagnosis = `Institutional quality PASS — memo dominance ${memoDominance}/100, reasoning ${reasoningVisibility}/100, card dependence ${cardDependence}/100`;
    diagnosisAr = `جودة مؤسسية: نجاح — هيمنة المذكرة ${memoDominance}/100، الاستدلال ${reasoningVisibility}/100، اعتماد البطاقات ${cardDependence}/100`;
  } else {
    const topFlag = flags[0] ?? "unknown";
    const flagDiagnoses: Record<ExperienceFlag, string> = {
      regime_dashboard_failure: "Regime label is primary content — institutional memo required",
      memo_absent:              "No institutional memo — response is structured summary not CIO memo",
      reasoning_hidden:         "Committee reasoning not surfaced — allocator/historical voices absent",
      cards_dominate:           "Card-heavy response — reasoning depth below threshold",
      question_unanswered:      "Headline does not directly answer the question",
      allocator_logic_absent:   "No allocator view in committee reasoning",
      historical_analog_absent: "No historical analog surfaced",
      counter_thesis_absent:    "No counter-thesis or bear case presented",
    };
    diagnosis = flagDiagnoses[topFlag] + ` (score ${institutionalQuality}/100)`;
    diagnosisAr = `فشل في: ${topFlag} (${institutionalQuality}/100)`;
  }

  return {
    memoDominance,
    reasoningVisibility,
    questionCompliance,
    cardDependence,
    institutionalQuality,
    flags,
    grade,
    diagnosis,
    diagnosisAr,
  };
}
