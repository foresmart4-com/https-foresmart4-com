// Phase-88C: Research Stress Test Engine
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Distinct from genesisQualityValidationHarness.ts (Phase-84A):
//   QVH: validates AI REPLY quality POST-reply (grading backward)
//   stressTestEngine: evaluates THESIS ROBUSTNESS PRE-AI (informs AI what to address)
//
// Problem: Genesis produces institutional-sounding theses that have not been
// tested against adversarial conditions. An institutional research desk
// routinely asks: "What would kill this thesis?" and "How many things need to
// go right for this to work?" before publishing.
//
// 3 stress dimensions:
//
//   evidence_resilience (0-100 fragility):
//     Tests whether thesis survives if 1-2 supporting data points are wrong.
//     High fragility = thesis rests on few or ambiguous signals.
//
//   assumption_fragility (0-100 fragility):
//     Counts how many independent assumptions must all hold for thesis to survive.
//     2 assumptions = manageable; 4+ assumptions = fragile.
//
//   invalidation_proximity (0-100 fragility):
//     How close is the current state to known invalidation conditions?
//     Detected from question/context keywords.
//
// compositeFragility = weighted average (evidence 40%, assumption 35%, proximity 25%).
// fragilityLevel: robust (<25), moderate (25-49), fragile (50-69), critical (≥70).
//
// stressTestCtx ≤180 chars injectable.
// No execution language. Advisory/educational only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type FragilityLevel = "robust" | "moderate" | "fragile" | "critical";

export interface StressDimension {
  name:     string;
  score:    number;  // 0-100 fragility (higher = more fragile)
  finding:  string;  // ≤65 chars
  repair:   string;  // ≤55 chars: what would improve resilience
}

export interface ResearchStressTestResult {
  evidenceResilience:    StressDimension;
  assumptionFragility:   StressDimension;
  invalidationProximity: StressDimension;
  compositeFragility:    number;       // 0-100 weighted composite
  fragilityLevel:        FragilityLevel;
  stressTestCtx:         string;       // ≤180 chars injectable
  repairDirective:       string | null; // ≤80 chars, set when fragile/critical
}

// ─── Evidence resilience scoring ─────────────────────────────────────────────
// Proxy: thin evidence signals in question/context = high resilience fragility

const THIN_EVIDENCE_PATTERNS = [
  /\b(rumour|rumor|heard|sources say|reportedly|reportedly|could be|might be|possibly)\b/i,
  /\b(no data|limited data|insufficient|unclear|unknown|uncertain)\b/i,
  /\b(speculation|speculative|guessing|estimate only|rough estimate)\b/i,
];

const STRONG_EVIDENCE_PATTERNS = [
  /\b(\d+\s*(bps|%|percent|billion|trillion)|quarterly (earnings|gdp|cpi)|\d+\s*(x|times) coverage)\b/i,
  // Require "confirmed/published/official" OR CB + action word (not just "Fed" alone)
  /\b(confirmed|officially published|central bank (statement|said|confirmed|published)|fed (statement|minutes|confirmed|said|published)|ecb (statement|said)|sama statement)\b/i,
  /\b(historical (average|median|base rate)|back.?test(ed)?|empirical(ly)?)\b/i,
];

function scoreEvidenceResilience(text: string): StressDimension {
  const thinCount   = THIN_EVIDENCE_PATTERNS.filter(p => p.test(text)).length;
  const strongCount = STRONG_EVIDENCE_PATTERNS.filter(p => p.test(text)).length;
  let score: number;
  let finding: string;
  let repair: string;

  if (thinCount >= 2 && strongCount === 0) {
    score = 80; finding = "Multiple thin-evidence signals; no quantitative anchors";
    repair = "Require specific data sources before high-conviction framing";
  } else if (thinCount >= 1 || strongCount === 0) {
    score = 55; finding = "Limited quantitative anchors; evidence basis is thin";
    repair = "Add at least 2 specific data points to ground the thesis";
  } else if (strongCount >= 3) {
    score = 15; finding = "Multiple quantitative/official anchors; evidence robust";
    repair = "Monitor for data revision; maintain conditional framing";
  } else {
    score = 35; finding = "Moderate evidence quality; 1-2 quantitative anchors";
    repair = "Supplement with leading indicators for confirmation";
  }

  return { name: "evidence_resilience", score, finding, repair };
}

// ─── Assumption fragility scoring ─────────────────────────────────────────────
// Proxy: count of conditional "if" / "assuming" / "requires" in text

const ASSUMPTION_MARKERS = [
  /\bif\b/gi,
  /\bassume|assuming|assumption\b/gi,
  /\brequires?\b/gi,
  /\bdepends? on\b/gi,
  /\bprovided that\b/gi,
  /\bonly (if|when|as long as)\b/gi,
];

function scoreAssumptionFragility(question: string, ctx: string): StressDimension {
  const text = `${question} ${ctx}`;
  let assumptionCount = 0;
  for (const pattern of ASSUMPTION_MARKERS) {
    pattern.lastIndex = 0;
    assumptionCount += (text.match(pattern) ?? []).length;
  }

  let score: number;
  let finding: string;
  let repair: string;

  if (assumptionCount >= 5) {
    score = 75; finding = `${assumptionCount} explicit assumptions detected; thesis is stacked`;
    repair = "Reduce to 2-3 core assumptions; test each independently";
  } else if (assumptionCount >= 3) {
    score = 50; finding = `${assumptionCount} assumptions required; moderate dependency chain`;
    repair = "Identify which 1 assumption is most likely to fail first";
  } else if (assumptionCount >= 1) {
    score = 28; finding = `${assumptionCount} explicit assumption(s); manageable dependency`;
    repair = "State explicitly what must hold and at what threshold";
  } else {
    score = 45; finding = "No explicit assumptions stated — may be implicit";
    repair = "Surface hidden assumptions for stress testing";
  }

  return { name: "assumption_fragility", score, finding, repair };
}

// ─── Invalidation proximity scoring ───────────────────────────────────────────
// Proxy: are invalidation signals already partially present?

const NEAR_INVALIDATION_PATTERNS = [
  /\b(approaching|nearing|close to|near (the )?(threshold|breakeven|target)|at risk of)\b/i,
  /\b(testing|retesting|breaching|breaking (through|below|above)|deteriorating)\b/i,
  /\b(weakening|below (the|fiscal) breakeven|above (the )?(cap|ceiling|limit))\b/i,
];

const FAR_FROM_INVALIDATION_PATTERNS = [
  /\b(well above|safely above|well below|comfortably (above|below)|far from)\b/i,
  /\b(solid|robust|strong (buffer|cushion)|ample (room|space|buffer))\b/i,
];

function scoreInvalidationProximity(text: string): StressDimension {
  const nearCount = NEAR_INVALIDATION_PATTERNS.filter(p => p.test(text)).length;
  const farCount  = FAR_FROM_INVALIDATION_PATTERNS.filter(p => p.test(text)).length;

  let score: number;
  let finding: string;
  let repair: string;

  if (nearCount >= 2) {
    score = 78; finding = "Multiple invalidation proximity signals detected";
    repair = "Explicitly check invalidation triggers before maintaining thesis";
  } else if (nearCount >= 1 && farCount === 0) {
    score = 55; finding = "At least one condition approaching invalidation threshold";
    repair = "Set explicit alert at the near-breached condition level";
  } else if (farCount >= 2) {
    score = 12; finding = "Thesis is well-removed from invalidation conditions";
    repair = "Maintain periodic monitoring as conditions can shift quickly";
  } else {
    score = 30; finding = "Invalidation proximity indeterminate from context";
    repair = "Define specific, measurable invalidation thresholds";
  }

  return { name: "invalidation_proximity", score, finding, repair };
}

// ─── Composite + helpers ──────────────────────────────────────────────────────

function classifyFragility(score: number): FragilityLevel {
  if (score < 25) return "robust";
  if (score < 50) return "moderate";
  if (score < 70) return "fragile";
  return "critical";
}

function buildStressCtx(
  evidR: StressDimension,
  assF: StressDimension,
  invP: StressDimension,
  level: FragilityLevel,
  composite: number,
): string {
  const dominant = [evidR, assF, invP].sort((a, b) => b.score - a.score)[0];
  return `Stress[${level}|${composite}]: ${dominant.finding.slice(0,60)} | Repair: ${dominant.repair.slice(0,45)}`.slice(0, 180);
}

function buildRepairDirective(level: FragilityLevel, dominant: StressDimension): string | null {
  if (level === "robust" || level === "moderate") return null;
  return `Self-critique required: ${dominant.repair.slice(0, 60)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function stressTestResearch(input: {
  question:          string;
  ctx:               string;
  creditStressLevel: "low" | "moderate" | "high" | "extreme";
}): ResearchStressTestResult {
  const { question, ctx, creditStressLevel } = input;
  const fullText = `${question} ${ctx}`;

  const evidR = scoreEvidenceResilience(fullText);
  const assF  = scoreAssumptionFragility(question, ctx);
  const invP  = scoreInvalidationProximity(fullText);

  // Credit stress boosts invalidation proximity score
  const invPAdjusted: StressDimension = {
    ...invP,
    score: creditStressLevel === "extreme" ? Math.min(100, invP.score + 25)
         : creditStressLevel === "high"    ? Math.min(100, invP.score + 12)
         : invP.score,
  };

  const composite = Math.round(evidR.score * 0.40 + assF.score * 0.35 + invPAdjusted.score * 0.25);
  const level     = classifyFragility(composite);
  const sorted    = [evidR, assF, invPAdjusted].sort((a, b) => b.score - a.score);

  return {
    evidenceResilience:    evidR,
    assumptionFragility:   assF,
    invalidationProximity: invPAdjusted,
    compositeFragility:    composite,
    fragilityLevel:        level,
    stressTestCtx:         buildStressCtx(evidR, assF, invPAdjusted, level, composite),
    repairDirective:       buildRepairDirective(level, sorted[0]),
  };
}
