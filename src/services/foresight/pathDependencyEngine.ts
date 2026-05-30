// Phase-88B: Path Dependency Engine
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Problem: macro outcomes are path-dependent. A rate hike cycle that has been
// running for 12+ months creates cumulative credit tightening that does NOT
// reverse quickly. A consensus that has been stable for months creates larger-
// than-expected repricing when it breaks. Genesis treats each question as if
// conditions just appeared, missing the cumulative and non-linear effects of
// SUSTAINED macro states.
//
// Solution: detect path-persistence signals from question + context text,
// classify their persistence (fresh/established/entrenched), and describe
// cumulative effects and non-linear reversal risk.
//
// Duration detection reuses the vocabulary from expectationMemoryEngine.ts:
//   fresh:      "just", "this week", "recently", "new", "sudden"
//   established:"for weeks", "past few weeks", "past month", "recently"
//   entrenched: "for months", "throughout H1", "since [quarter]", "long-standing"
//
// Non-linear risk: TRUE for spreads sustained wide, oil sustained below breakeven,
// or consensus sustained stable (mean-reversion compression).
//
// Output: PathDependencyProfile with pathContext (≤200 chars injectable).
// Educational/advisory foresight only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type PathPersistence   = "fresh" | "established" | "entrenched";
export type ReversalSensitivity = "high" | "moderate" | "low";

export interface PathCondition {
  id:                       string;   // e.g. "tightening_cycle"
  condition:                string;   // ≤70 chars: what has been happening
  persistence:              PathPersistence;
  cumulativeEffect:         string;   // ≤72 chars: what has accumulated
  nonLinearRisk:            boolean;  // reversal would be non-linear
  institutionalImplication: string;   // ≤72 chars: allocator action note
}

export interface PathDependencyProfile {
  activeConditions:    PathCondition[];
  dominantPath:        PathCondition | null;
  reversalSensitivity: ReversalSensitivity;
  pathContext:         string;   // ≤200 chars injectable
  fiduciaryWarning:    string | null; // ≤80 chars, set when nonLinearRisk=true
}

// ─── Duration detection ───────────────────────────────────────────────────────

const ENTRENCHED_CUES = /\b(for months|all year|throughout (Q[1-4]|H[12]|20\d\d)|since (Q[1-4]|H[12]|January|February|March|April|May|June|July|August|September|October|November|December)|long.standing|persistent|entrenched|deeply (priced|established))\b/i;
const ESTABLISHED_CUES = /\b(for (several )?weeks|past (few )?weeks|over the past month|in recent weeks|last (few )?weeks|weeks of|monthly)\b/i;
const FRESH_CUES = /\b(just|this week|yesterday|last few days|recently (shifted|changed)|new (expectation|policy|regime)|sudden|abrupt)\b/i;

function detectPersistence(text: string): PathPersistence {
  if (ENTRENCHED_CUES.test(text)) return "entrenched";
  if (ESTABLISHED_CUES.test(text)) return "established";
  if (FRESH_CUES.test(text)) return "fresh";
  return "established"; // default: assume some duration when no cue
}

// ─── Path condition templates ─────────────────────────────────────────────────

interface PathTemplate {
  id:                       string;
  detectionPattern:         RegExp;
  condition:                string;
  cumulativeEffect:         string;
  nonLinearRisk:            boolean;
  institutionalImplication: string;
}

const PATH_TEMPLATES: PathTemplate[] = [
  {
    id: "tightening_cycle",
    detectionPattern: /\b(tightening|rate.hike|hawkish|raising.rate|restrictive.policy|fed.hike|ecb.hike)\b/i,
    condition:        "CB tightening cycle ongoing",
    cumulativeEffect: "Credit cost compounds; capex pipeline shrinks; duration pain accumulates",
    nonLinearRisk:    false,
    institutionalImplication: "Reversal cycle typically slower than tightening; avoid duration overshot",
  },
  {
    id: "credit_spread_widening",
    // Matches: "spread widen/widening/widened", "credit stress", "hy/hg spread", "credit tighten"
    // Note: spread\w*\s+wid handles "spreads widening" (two separate words)
    detectionPattern: /\bspread\w*\s+wid|\bcredit.stress|\bhy.spread|\bhg.spread|\bcredit.tighten|\bbasis.wid/i,
    condition:        "Credit spreads trending wider for sustained period",
    cumulativeEffect: "HY refinancing risk builds; M&A/buyback freeze cumulative; funding premium rises",
    nonLinearRisk:    true,
    institutionalImplication: "Non-linear risk: single credit event can trigger cascade; reduce HY exposure",
  },
  {
    id: "oil_below_breakeven",
    detectionPattern: /\b(oil.below|oil.under|brent.below.75|wti.below.70|oil.pressure|fiscal.breakeven|below.breakeven)\b/i,
    condition:        "Oil sustained below Saudi fiscal breakeven (~$75-80/bbl)",
    cumulativeEffect: "Fiscal buffer erodes; government spending reviews compound; PIF deployment slows",
    nonLinearRisk:    true,
    institutionalImplication: "Saudi credit growth will lag recovery; avoid over-weight on TASI cyclicals",
  },
  {
    id: "easing_cycle",
    detectionPattern: /\b(easing|rate.cut|dovish|fed.cut|pivot|cutting.rate|lower.rate|rate.reduction)\b/i,
    condition:        "CB easing cycle accumulating",
    cumulativeEffect: "Real rate decline cumulative; refinancing wave building; duration bid sustained",
    nonLinearRisk:    false,
    institutionalImplication: "Cumulative multiple expansion; watch for overshoot in growth/duration",
  },
  {
    id: "dollar_strength",
    detectionPattern: /\b(dxy.rise|dxy.above|dollar.strength|dollar.rally|strong.dollar|usd.rise|usd.strength)\b/i,
    condition:        "DXY sustained strength compressing EM and Gulf cross-border flows",
    cumulativeEffect: "EM debt service costs rise; commodity prices pressured; Gulf repatriation incentive",
    nonLinearRisk:    false,
    institutionalImplication: "Gulf allocation less attractive to foreign capital while peg implies stable local returns",
  },
  {
    id: "stable_consensus",
    detectionPattern: /\b(broad.consensus|widely.expected|market.consensus|long.standing.view|firmly.priced|deeply.priced|entrenched.consensus)\b/i,
    condition:        "Consensus expectation stable and deeply priced",
    cumulativeEffect: "Mean-reversion risk building; any surprise causes oversized repricing",
    nonLinearRisk:    true,
    institutionalImplication: "Consensus compression: size positions as if the reversal probability is higher than consensus implies",
  },
  {
    id: "growth_slowdown",
    detectionPattern: /\b(growth.slow|gdp.below|gdp.miss|growth.disappoint|earnings.decline|earnings.miss|slowdown|deceleration)\b/i,
    condition:        "Growth momentum decelerating over multiple quarters",
    cumulativeEffect: "Earnings revisions accumulate; forward guidance cuts compound; sector rotation to defensives",
    nonLinearRisk:    false,
    institutionalImplication: "Late-cycle playbook: preserve capital, reduce cyclicals, monitor credit canary",
  },
];

// ─── Reversal sensitivity ─────────────────────────────────────────────────────

function computeReversalSensitivity(
  conditions: PathCondition[],
  creditStress: "low" | "moderate" | "high" | "extreme",
): ReversalSensitivity {
  const nonLinearCount = conditions.filter(c => c.nonLinearRisk).length;
  const entrenchedCount = conditions.filter(c => c.persistence === "entrenched").length;
  if (nonLinearCount >= 2 || creditStress === "extreme") return "high";
  if (nonLinearCount >= 1 || entrenchedCount >= 2 || creditStress === "high") return "high";
  if (entrenchedCount >= 1 || conditions.length >= 2) return "moderate";
  return "low";
}

// ─── Context builder ──────────────────────────────────────────────────────────

function buildPathContext(dominant: PathCondition | null, sensitivity: ReversalSensitivity): string {
  if (!dominant) return "Path dependency: no persistent macro path detected — fresh conditions.";
  const persist  = dominant.persistence;
  const cumul    = dominant.cumulativeEffect.slice(0, 65);
  const nonLinear = dominant.nonLinearRisk ? " [non-linear reversal risk]" : "";
  return `Path[${persist}]: ${dominant.condition.slice(0, 50)} → ${cumul}${nonLinear} [reversal:${sensitivity}]`.slice(0, 200);
}

function buildFiduciaryWarning(conditions: PathCondition[]): string | null {
  const nonLinear = conditions.find(c => c.nonLinearRisk);
  if (!nonLinear) return null;
  return `Non-linear reversal risk: ${nonLinear.id} — position sizing must account for gap risk`.slice(0, 80);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildPathDependency(input: {
  question:          string;
  ctx:               string;
  creditStressLevel: "low" | "moderate" | "high" | "extreme";
  isSaudi:           boolean;
}): PathDependencyProfile {
  const { question, ctx, creditStressLevel, isSaudi } = input;
  const text = `${question} ${ctx}`;

  const conditions: PathCondition[] = [];

  for (const t of PATH_TEMPLATES) {
    // Skip non-Saudi oil-specific template if not Saudi
    if (t.id === "oil_below_breakeven" && !isSaudi) continue;
    if (t.detectionPattern.test(text)) {
      const persistence = detectPersistence(text);
      conditions.push({
        id:                       t.id,
        condition:                t.condition,
        persistence,
        cumulativeEffect:         t.cumulativeEffect,
        nonLinearRisk:            t.nonLinearRisk,
        institutionalImplication: t.institutionalImplication,
      });
    }
  }

  // Dominant path: entrenched > established > fresh; non-linear wins ties
  const sorted = [...conditions].sort((a, b) => {
    const persistScore = (p: PathPersistence) => p === "entrenched" ? 3 : p === "established" ? 2 : 1;
    const pa = persistScore(a.persistence) * 10 + (a.nonLinearRisk ? 5 : 0);
    const pb = persistScore(b.persistence) * 10 + (b.nonLinearRisk ? 5 : 0);
    return pb - pa;
  });

  const dominantPath = sorted[0] ?? null;
  const reversalSensitivity = computeReversalSensitivity(conditions, creditStressLevel);
  const pathContext = buildPathContext(dominantPath, reversalSensitivity);
  const fiduciaryWarning = buildFiduciaryWarning(conditions);

  return {
    activeConditions:    conditions,
    dominantPath,
    reversalSensitivity,
    pathContext,
    fiduciaryWarning,
  };
}
