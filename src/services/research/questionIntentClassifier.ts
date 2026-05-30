// Phase-87B: Question Intent Classifier
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Problem: dynamicBudgetGovernor.ts uses keyword-winner-only logic:
//   if (macroScore === max && macroScore >= 2) return "macro_heavy"
//
// A question like "Should I increase my Saudi allocation given the current
// oil-tightening environment?" registers as "macro_heavy" but is actually an
// advisory_framing question requiring fiduciary sensitivity — a materially
// different prompt-layer weighting.
//
// Solution: multi-dimensional scoring across 4 axes, weighted vote → one of 7
// institutional intent labels.
//
// Scoring axes (each 0-100):
//   form_factor:          HOW the question is structured (explain/compare/hypothetical/should)
//   domain_depth:         HOW DEEP the domain context is (surface→analytical→institutional)
//   actionability:        HOW MUCH a directional answer is sought (inform→decide)
//   advisory_sensitivity: fiduciary/legal/suitability markers
//
// LayerHints: per-intent suggested layer weight targets for unifiedCognitionGovernor
// to blend with content-derived relevance scores. These are not hard overrides —
// they adjust the dynamic allocation signal.
//
// No PII. No secrets. Educational/advisory classification only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type QuestionIntent =
  | "deep_analytical"        // multi-factor institutional analysis required
  | "macro_policy_synthesis" // CB/policy/rates primary focus
  | "comparative_research"   // comparing assets, sectors, or frameworks
  | "scenario_stress_test"   // hypothetical/scenario/what-if
  | "fiduciary_assessment"   // risk governance, suitability, mandate awareness
  | "advisory_framing"       // directional guidance sought (should I?)
  | "educational_inquiry";   // explanation / factual / how-does-X-work

export interface QuestionIntentResult {
  intent:               QuestionIntent;
  intentConfidence:     number;  // 0-100
  formFactor:           number;  // dominant form signal (0-100)
  domainDepth:          number;  // 0-100
  actionability:        number;  // 0-100
  advisorySensitivity:  number;  // 0-100
  layerHints: Partial<Record<"macro" | "semantic" | "expert" | "policy" | "authority", number>>;
  fiduciaryFlag:        boolean; // advisory_sensitivity ≥ 60
}

// ─── Form factor patterns ─────────────────────────────────────────────────────

// Scenario/hypothetical — highest specificity; checked first
const SCENARIO_FORM = /\b(what if|if .{1,40}(happens?|occurs?|falls?|rises?|drops?|spikes?|changes?)|suppose|assume\b|hypothetical|in case of|given that .{1,30}(happens?|drops?|rises?)|should .{1,30}(occur|happen|fall|rise|spike))\b/i;
// Comparative
const COMPARE_FORM  = /\b(compare|vs\.?|versus|between|difference|relative to|better than|worse than|outperform|underperform|favour|prefer|contrast|which (is|are|would))\b/i;
// Advisory (directional guidance sought)
const ADVISORY_FORM = /\b(should (i|we|investors?)\b|do you (recommend|suggest|advise)|is (it|now) (worth|advisable|appropriate|a good time)|would you|when should (i|we)|how should (i|we)|is there value in|is this a good)\b/i;
// Educational / explanatory
const EXPLAIN_FORM  = /\b(how does|what is|what are|explain|describe|define|what does .{1,20} mean|how (do|does|did)|why does|what causes|how (is|was))\b/i;

// ─── Domain depth patterns ────────────────────────────────────────────────────

// Note: g flag required — these are used with .match() for count
const INSTITUTIONAL_DEPTH = /\b(regime|transmission|second.order|liquidity.channel|credit.spread|fiscal.multiplier|yield.curve|risk.adjusted|convexity|duration|allocator|fiduciary|capital.structure|institutional|sovereign|macro.chain)\b/gi;
const ANALYTICAL_DEPTH    = /\b(inflation|gdp|rates?|policy|monetary|fiscal|valuation|earnings|sector|cross.asset|correlation|sentiment|macro|liquidity)\b/gi;
const SURFACE_DEPTH       = /\b(price|stock|buy|sell|up|down|trend|news|today|now)\b/gi;

function scoreDomainDepth(q: string, ctx: string): number {
  const text = `${q} ${ctx}`;
  INSTITUTIONAL_DEPTH.lastIndex = 0;
  ANALYTICAL_DEPTH.lastIndex   = 0;
  SURFACE_DEPTH.lastIndex      = 0;
  const inst = (text.match(INSTITUTIONAL_DEPTH) ?? []).length;
  const anal = (text.match(ANALYTICAL_DEPTH)    ?? []).length;
  const surf = (text.match(SURFACE_DEPTH)       ?? []).length;
  if (inst >= 3)         return 90;
  if (inst >= 1)         return 70;
  if (anal >= 4)         return 58;
  if (anal >= 2)         return 42;
  if (surf >= 3)         return 22;
  return 15;
}

// ─── Actionability patterns ───────────────────────────────────────────────────

const HIGH_ACTION = /\b(position|enter|exit|buy|sell|invest|allocate|increase|reduce|deploy|hedge|take.(?:profit|position)|cut.exposure|add.to|go.long|go.short)\b/i;
const MED_ACTION  = /\b(should|recommend|advise|consider|monitor|watch|review|assess|evaluate|weigh)\b/i;
const LOW_ACTION  = /\b(explain|describe|what.is|how.does|define|analyse|analyze|understand|learn|know)\b/i;

function scoreActionability(q: string): number {
  if (HIGH_ACTION.test(q)) return 85;
  if (MED_ACTION.test(q))  return 52;
  if (LOW_ACTION.test(q))  return 18;
  return 35;
}

// ─── Advisory sensitivity patterns ───────────────────────────────────────────

const FIDUCIARY_S  = /\b(fiduciary|suitability|appropriate|compliance|regulation|obligation|duty|conflict.of.interest|disclos|mandate|liability|legal)\b/i;
const ADVISORY_S   = /\b(advice|advise|recommend|should.i|should.we|personal|my.(?:investment|money|savings|capital|allocation|portfolio))\b/i;
const RISK_S       = /\b(risk|loss|downside|drawdown|volatility|uncertainty|exposure|vulnerable|danger|caution)\b/i;

function scoreAdvisorySensitivity(q: string): number {
  if (FIDUCIARY_S.test(q))  return 90;
  if (ADVISORY_S.test(q))   return 68;
  if (RISK_S.test(q))       return 38;
  return 10;
}

// ─── Intent resolution ────────────────────────────────────────────────────────

function resolveIntent(
  scenario: number, compare: number, advisory: number, explain: number,
  depth: number, action: number, advSensitivity: number,
): { intent: QuestionIntent; confidence: number } {
  // P1: Fiduciary/suitability sensitivity
  if (advSensitivity >= 68) return { intent: "fiduciary_assessment",   confidence: advSensitivity };
  // P2: Scenario/hypothetical form
  if (scenario >= 70)       return { intent: "scenario_stress_test",   confidence: scenario };
  // P3: Comparative form
  if (compare >= 65)        return { intent: "comparative_research",   confidence: compare };
  // P4: Advisory form + directional action
  if (advisory >= 65 && action >= 50) return { intent: "advisory_framing", confidence: advisory };
  // P5: Deep institutional domain, non-advisory
  if (depth >= 70)          return { intent: "deep_analytical",        confidence: depth };
  // P6: Analytical domain, low action, not explanatory
  if (depth >= 38 && action < 50 && explain < 55) return { intent: "macro_policy_synthesis", confidence: depth };
  // P7: Explanatory
  if (explain >= 50)        return { intent: "educational_inquiry",    confidence: explain };
  // Default: analytical
  return { intent: "deep_analytical", confidence: 42 };
}

// ─── Layer hints ──────────────────────────────────────────────────────────────
// Percentage targets (summing to 100) per intent.
// These blend with content-derived relevance scores in unifiedCognitionGovernor.

const INTENT_LAYER_HINTS: Record<QuestionIntent, Record<"macro"|"semantic"|"expert"|"policy"|"authority", number>> = {
  deep_analytical:        { macro: 35, semantic: 25, expert: 20, policy: 12, authority: 8  },
  macro_policy_synthesis: { macro: 40, policy: 30,  semantic: 14, expert: 10, authority: 6  },
  comparative_research:   { expert: 33, authority: 26, macro: 20, semantic: 14, policy: 7  },
  scenario_stress_test:   { macro: 40, semantic: 24, policy: 20, expert: 10, authority: 6  },
  fiduciary_assessment:   { semantic: 29, authority: 26, macro: 20, policy: 16, expert: 9  },
  advisory_framing:       { macro: 30, expert: 25,  semantic: 25, policy: 14, authority: 6  },
  educational_inquiry:    { expert: 34, authority: 26, macro: 20, semantic: 13, policy: 7  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function classifyQuestionIntent(
  question: string,
  ctx = "",
): QuestionIntentResult {
  const scenario = SCENARIO_FORM.test(question) ? 80 : 0;
  const compare  = COMPARE_FORM.test(question)  ? 72 : 0;
  const advisory = ADVISORY_FORM.test(question) ? 76 : 0;
  const explain  = EXPLAIN_FORM.test(question)  ? 62 : 0;

  const depth    = scoreDomainDepth(question, ctx);
  const action   = scoreActionability(question);
  const advSens  = scoreAdvisorySensitivity(question);

  const { intent, confidence } = resolveIntent(
    scenario, compare, advisory, explain, depth, action, advSens,
  );

  return {
    intent,
    intentConfidence:    confidence,
    formFactor:          Math.max(scenario, compare, advisory, explain),
    domainDepth:         depth,
    actionability:       action,
    advisorySensitivity: advSens,
    layerHints:          INTENT_LAYER_HINTS[intent],
    fiduciaryFlag:       advSens >= 60,
  };
}
