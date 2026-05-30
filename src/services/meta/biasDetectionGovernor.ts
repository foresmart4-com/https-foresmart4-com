// Phase-88C: Bias Detection Governor
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// No existing bias detection engine in the codebase. This is a new
// institutional capability.
//
// Problem: Confirmation bias, narrative lock, and framing bias are the
// three most common research failures in investment analysis. An institution
// that produces biased research is not providing fiduciary-quality output.
// Genesis must detect these patterns in the question framing and prior
// thesis context before constructing its reply.
//
// 5 cognitive bias types:
//   confirmation_bias:  question selectively surfaces only supporting evidence
//   narrative_lock:     question assumes conclusion ("given that X is happening")
//   overconfidence:     excessive certainty in framing ("will definitely", "no doubt")
//   framing_bias:       outcome framed as inevitable/directional before analysis
//   thesis_rigidity:    prior thesis repeated without new evidence referenced
//
// totalBiasScore (0-100): severity-weighted sum of all flags.
// isClean: true when no strong/moderate flags detected.
//
// biasCtx (≤160 chars): counter-framing directive injected into prompt.
// If isClean: minimal note. If biased: specific de-bias instruction.
//
// No execution language. Advisory/educational only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type CognitiveBias =
  | "confirmation_bias"
  | "narrative_lock"
  | "overconfidence"
  | "framing_bias"
  | "thesis_rigidity";

export interface BiasFlag {
  bias:       CognitiveBias;
  evidence:   string;  // ≤55 chars: what in the text triggered this flag
  correction: string;  // ≤62 chars: what the AI must do to counteract
  severity:   "strong" | "moderate" | "mild";
}

export interface BiasDetectionResult {
  flags:          BiasFlag[];
  dominantBias:   CognitiveBias | null;
  totalBiasScore: number;  // 0-100
  biasCtx:        string;  // ≤160 chars injectable
  isClean:        boolean; // true when no strong/moderate flag
}

// ─── Detection patterns ───────────────────────────────────────────────────────

// Confirmation bias: selective evidence surfacing
const CONFIRMATION_BIAS_PATTERNS = [
  /\b(confirms? (my|our|the) (view|thesis|belief)|this validates|as (i|we) expected|supports? the thesis)\b/i,
  /\b(exactly as predicted|vindicates|proves (my|our|the)|told you so)\b/i,
];

// Narrative lock: conclusion assumed before analysis
const NARRATIVE_LOCK_PATTERNS = [
  /\b(given that .{1,40}(is happening|has occurred|has happened)|now that .{1,40}(has|have) (happened|occurred|started))\b/i,
  /\b(since .{1,30}(already|clearly|obviously) (is|has|are)|because .{1,30}(is obviously|clearly shows?))\b/i,
  /\b(with .{1,30}(already|inevitably) (in place|underway|confirmed))\b/i,
];

// Overconfidence: certainty language
const OVERCONFIDENCE_PATTERNS = [
  /\b(will definitely|will certainly|certain(ly)? to|no doubt|absolutely will|guaranteed (to|that)|must happen)\b/i,
  /\b(100% (sure|certain|confident)|I'm certain|we know for sure|unquestionable|without question)\b/i,
  /\b(the market (will|must|has to|is bound to)|earnings (will definitely|are certain to))\b/i,
];

// Framing bias: outcome direction embedded in question
const FRAMING_BIAS_PATTERNS = [
  /\b(obviously bullish|clearly bearish|undeniably (positive|negative|bullish|bearish))\b/i,
  /\b(inevitably (higher|lower|up|down|rising|falling)|it('s| is) obvious that)\b/i,
  /\b(how (much|fast|quickly) will .{1,30}(rise|fall|increase|decrease|grow|decline))\b/i,
];

// Thesis rigidity: prior thesis re-stated without new evidence
const THESIS_RIGIDITY_PATTERNS = [
  /\b(my (position|thesis|view) remains? unchanged|same (thesis|view|position) as (before|last time|previously))\b/i,
  /\b(nothing has changed|view (hasn't|has not) changed|still (believe|think|expect) the same)\b/i,
  /\b(reconfirm(ing|s)? (my|our|the) (thesis|position|view)|maintaining (my|our) (stance|position))\b/i,
];

// ─── Severity weights ─────────────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<BiasFlag["severity"], number> = {
  strong:   35,
  moderate: 18,
  mild:      7,
};

// ─── Correction directives ────────────────────────────────────────────────────

const CORRECTIONS: Record<CognitiveBias, string> = {
  confirmation_bias: "Surface evidence that CONTRADICTS the thesis before concluding",
  narrative_lock:    "State the condition as uncertain, not as already established",
  overconfidence:    "Replace certainty with calibrated confidence and named conditions",
  framing_bias:      "Reframe as conditional — state the observable trigger, not the outcome",
  thesis_rigidity:   "Require specific new evidence before confirming thesis continuation",
};

// Evidence extracts (what triggered each bias)
const EVIDENCE_LABELS: Record<CognitiveBias, string> = {
  confirmation_bias: "Question highlights only supporting evidence",
  narrative_lock:    "Question assumes conclusion is already true",
  overconfidence:    "Question uses certainty language without evidence",
  framing_bias:      "Question embeds directional outcome in framing",
  thesis_rigidity:   "Question reaffirms prior thesis without new data",
};

// ─── Detection logic ──────────────────────────────────────────────────────────

function testPatterns(text: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(text));
}

function detectBiasFlags(question: string, ctx: string): BiasFlag[] {
  const text = `${question} ${ctx}`.slice(0, 2000); // cap text for O(1)
  const flags: BiasFlag[] = [];

  if (testPatterns(text, CONFIRMATION_BIAS_PATTERNS)) {
    flags.push({
      bias:       "confirmation_bias",
      evidence:   EVIDENCE_LABELS.confirmation_bias,
      correction: CORRECTIONS.confirmation_bias,
      severity:   "strong",
    });
  }

  if (testPatterns(text, NARRATIVE_LOCK_PATTERNS)) {
    flags.push({
      bias:       "narrative_lock",
      evidence:   EVIDENCE_LABELS.narrative_lock,
      correction: CORRECTIONS.narrative_lock,
      severity:   "moderate",
    });
  }

  if (testPatterns(text, OVERCONFIDENCE_PATTERNS)) {
    flags.push({
      bias:       "overconfidence",
      evidence:   EVIDENCE_LABELS.overconfidence,
      correction: CORRECTIONS.overconfidence,
      severity:   "strong",
    });
  }

  if (testPatterns(text, FRAMING_BIAS_PATTERNS)) {
    flags.push({
      bias:       "framing_bias",
      evidence:   EVIDENCE_LABELS.framing_bias,
      correction: CORRECTIONS.framing_bias,
      severity:   "moderate",
    });
  }

  if (testPatterns(text, THESIS_RIGIDITY_PATTERNS)) {
    flags.push({
      bias:       "thesis_rigidity",
      evidence:   EVIDENCE_LABELS.thesis_rigidity,
      correction: CORRECTIONS.thesis_rigidity,
      severity:   "mild",
    });
  }

  return flags;
}

// ─── Context builder ──────────────────────────────────────────────────────────

function buildBiasCtx(flags: BiasFlag[], isClean: boolean, dominantBias: CognitiveBias | null): string {
  if (isClean) return "Bias check: clean framing — proceed with balanced analysis.";
  if (!dominantBias) return "Bias check: mild bias detected — apply conditional framing.";
  const correction = CORRECTIONS[dominantBias].slice(0, 65);
  const flagCount  = flags.length;
  return `Bias[${dominantBias}×${flagCount}]: ${correction}`.slice(0, 160);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function detectBias(input: {
  question: string;
  ctx:      string;
}): BiasDetectionResult {
  const { question, ctx } = input;
  const flags = detectBiasFlags(question, ctx);

  const totalBiasScore = Math.min(100,
    flags.reduce((s, f) => s + SEVERITY_WEIGHT[f.severity], 0),
  );

  const dominantBias: CognitiveBias | null = flags.length === 0 ? null
    : flags.sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity])[0].bias;

  const isClean = !flags.some(f => f.severity === "strong" || f.severity === "moderate");

  return {
    flags,
    dominantBias,
    totalBiasScore,
    biasCtx: buildBiasCtx(flags, isClean, dominantBias),
    isClean,
  };
}
