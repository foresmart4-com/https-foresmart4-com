// Phase-88C: Red-Team Reasoning Engine
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Distinct from regimeConflictEngine.ts (Phase-83B):
//   regimeConflictEngine: detects named conflict PAIRS (macro_vs_policy,
//                          oil_vs_liquidity) between two macro forces
//   redTeamReasoningEngine: attacks SPECIFIC ASSUMPTIONS of the DOMINANT thesis
//                            using directed attack vectors; produces targeted
//                            counter-arguments the AI must address
//
// Problem: Genesis defends its dominant view rather than stress-testing it.
// Institutional research desks assign a red-team analyst whose explicit job
// is to find the single most dangerous assumption in the dominant thesis and
// build the strongest possible case against it.
//
// Attack vectors (6):
//   assumption_challenge:  central assumption is false or not yet proven
//   evidence_gap:          critical evidence is missing or ambiguous
//   causal_reversal:       causation may run the opposite direction
//   precedent_failure:     historical analogs where thesis failed
//   second_order_failure:  thesis fails on second-order transmission grounds
//   timing_attack:         direction may be right but timing is wrong
//
// Severity: critical (challenges thesis survival), significant (weakens thesis),
//           minor (corrects overstatement).
//
// Output: RedTeamResult with redTeamCtx ≤200 chars injectable.
// No execution language. Advisory/educational only.

import type { ThesisStance } from "./thesisCompetitionEngine";

// ─── Types ───────────────────────────────────────────────────────────────────────

export type AttackVector =
  | "assumption_challenge"
  | "evidence_gap"
  | "causal_reversal"
  | "precedent_failure"
  | "second_order_failure"
  | "timing_attack";

export interface RedTeamAttack {
  vector:      AttackVector;
  target:      string;   // ≤55 chars: what specific claim is attacked
  counterArg:  string;   // ≤65 chars: the counter-argument
  severity:    "critical" | "significant" | "minor";
  howToDefend: string;   // ≤55 chars: what thesis needs to survive this attack
}

export interface RedTeamResult {
  primaryAttack:      RedTeamAttack;
  secondaryAttack:    RedTeamAttack | null;
  vulnerabilityScore: number;  // 0-100; high = thesis easily attacked
  redTeamCtx:         string;  // ≤200 chars injectable
}

// ─── Attack library ───────────────────────────────────────────────────────────

interface AttackEntry {
  vector:      AttackVector;
  target:      string;
  counterArg:  string;
  severity:    RedTeamAttack["severity"];
  howToDefend: string;
}

// Bull thesis attacks
const BULL_ATTACKS: AttackEntry[] = [
  {
    vector:      "assumption_challenge",
    target:      "Multiple expansion assumes real rates fall",
    counterArg:  "Terminal rate uncertainty prevents sustained re-rating until CB commits to cuts",
    severity:    "critical",
    howToDefend: "Require explicit CB forward guidance or break-even inflation confirmation",
  },
  {
    vector:      "timing_attack",
    target:      "Direction correct but markets already priced the pivot",
    counterArg:  "Consensus pricing of 3 cuts leaves asymmetric downside if 1 cut materialises",
    severity:    "significant",
    howToDefend: "Verify that risk-reward is asymmetric before conviction deployment",
  },
  {
    vector:      "second_order_failure",
    target:      "Bull thesis ignores credit spread lag",
    counterArg:  "IG/HY spreads historically lag equity re-rating by 4-8 weeks; gap creates risk",
    severity:    "significant",
    howToDefend: "Wait for credit spread confirmation before calling thesis established",
  },
];

// Bear thesis attacks
const BEAR_ATTACKS: AttackEntry[] = [
  {
    vector:      "causal_reversal",
    target:      "Assumes CB cannot pivot before thesis transmits",
    counterArg:  "CB put historically activates before full bear thesis completion; delay risk",
    severity:    "critical",
    howToDefend: "Define specific conditions under which CB does NOT respond in time",
  },
  {
    vector:      "precedent_failure",
    target:      "Bear thesis analogues historically oversimplify",
    counterArg:  "Similar signal combinations resolved without full contraction in 40% of episodes",
    severity:    "significant",
    howToDefend: "Name the specific feature of current cycle that makes this time different",
  },
  {
    vector:      "evidence_gap",
    target:      "Bear thesis requires earnings decline; revisions are mixed",
    counterArg:  "Leading indicators are deteriorating but coincident data has not confirmed",
    severity:    "significant",
    howToDefend: "Require 2 consecutive quarterly EPS revision cycles turning negative",
  },
];

// Base thesis attacks
const BASE_ATTACKS: AttackEntry[] = [
  {
    vector:      "assumption_challenge",
    target:      "Base case assumes stable equilibrium",
    counterArg:  "Policy uncertainty creates binary outcomes; stable equilibrium is the least likely path",
    severity:    "significant",
    howToDefend: "Assign explicit probability to equilibrium path vs binary outcomes",
  },
  {
    vector:      "evidence_gap",
    target:      "Base case papers over macro/policy tension",
    counterArg:  "Neutral framing may obscure real conflict between constructive macro and restrictive policy",
    severity:    "minor",
    howToDefend: "Explicitly name which factor dominates if they conflict",
  },
  {
    vector:      "timing_attack",
    target:      "Base case timeframe is undefined",
    counterArg:  "Without explicit horizon, base case absorbs all uncertainty without resolving any",
    severity:    "minor",
    howToDefend: "Specify the time-bound trigger that moves from base to bull or bear",
  },
];

// Saudi-specific attack overrides
const SAUDI_BULL_ATTACKS: AttackEntry[] = [
  {
    vector:      "assumption_challenge",
    target:      "Saudi bull thesis assumes oil above fiscal breakeven",
    counterArg:  "Oil demand softness (China slowdown) + OPEC+ compliance risk → breakeven breach",
    severity:    "critical",
    howToDefend: "Monitor weekly OPEC production data and China PMI manufacturing sub-index",
  },
  {
    vector:      "second_order_failure",
    target:      "SAR peg prevents independent SAMA easing",
    counterArg:  "If Fed holds and Saudi needs stimulus, SAMA is boxed in — fiscal policy must carry all",
    severity:    "significant",
    howToDefend: "Size fiscal stimulus scope vs SAMA rate transmission dependency",
  },
];

const SAUDI_BEAR_ATTACKS: AttackEntry[] = [
  {
    vector:      "causal_reversal",
    target:      "Saudi bear assumes immediate fiscal spending cuts",
    counterArg:  "PIF/GOSI buffers absorb ≥2Q of oil shortfall; spending cuts are delayed 12-18M",
    severity:    "significant",
    howToDefend: "Track PIF drawdown rate and sovereign reserves monthly — not quarterly",
  },
];

// ─── Vulnerability scoring ────────────────────────────────────────────────────

function scoreVulnerability(
  primary: AttackEntry,
  secondary: AttackEntry | null,
  contestLevel: string,
  creditStress: "low" | "moderate" | "high" | "extreme",
): number {
  let score = primary.severity === "critical" ? 60 : primary.severity === "significant" ? 40 : 20;
  if (secondary) score += secondary.severity === "critical" ? 25 : secondary.severity === "significant" ? 15 : 5;
  if (contestLevel === "heavily_contested") score += 15;
  if (creditStress === "high")    score += 10;
  if (creditStress === "extreme") score += 20;
  return Math.min(100, score);
}

// ─── Context builder ──────────────────────────────────────────────────────────

function buildRedTeamCtx(primary: AttackEntry, vulnScore: number): string {
  return `Red-team[${primary.vector}|${primary.severity}]: ${primary.counterArg.slice(0,75)} | Defend: ${primary.howToDefend.slice(0,50)} [vuln:${vulnScore}]`.slice(0, 200);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildRedTeamReasoning(input: {
  dominantThesis:    ThesisStance;
  contestLevel:      "heavily_contested" | "moderately_contested" | "lopsided";
  creditStressLevel: "low" | "moderate" | "high" | "extreme";
  consensusStrength: "strong" | "moderate" | "weak" | "conflicted";
  isSaudi:           boolean;
}): RedTeamResult {
  const { dominantThesis, contestLevel, creditStressLevel, consensusStrength, isSaudi } = input;

  // Select attack pool based on dominant thesis + Saudi context
  let pool: AttackEntry[];
  if (isSaudi && dominantThesis === "bull")  pool = SAUDI_BULL_ATTACKS;
  else if (isSaudi && dominantThesis === "bear") pool = SAUDI_BEAR_ATTACKS;
  else if (dominantThesis === "bull")        pool = BULL_ATTACKS;
  else if (dominantThesis === "bear")        pool = BEAR_ATTACKS;
  else                                        pool = BASE_ATTACKS;

  // Select primary: critical attack if credit stress or consensus strong (crowded)
  let primary: AttackEntry;
  const preferCritical = creditStressLevel === "high" || creditStressLevel === "extreme"
    || consensusStrength === "strong"
    || contestLevel === "heavily_contested";

  if (preferCritical) {
    primary = pool.find(a => a.severity === "critical") ?? pool[0];
  } else {
    primary = pool[0];
  }

  // Secondary: different vector from primary
  const secondary = pool.find(a => a !== primary && a.vector !== primary.vector) ?? null;

  const vulnScore = scoreVulnerability(primary, secondary, contestLevel, creditStressLevel);

  const toAttack = (e: AttackEntry): RedTeamAttack => ({
    vector:      e.vector,
    target:      e.target,
    counterArg:  e.counterArg,
    severity:    e.severity,
    howToDefend: e.howToDefend,
  });

  return {
    primaryAttack:      toAttack(primary),
    secondaryAttack:    secondary ? toAttack(secondary) : null,
    vulnerabilityScore: vulnScore,
    redTeamCtx:         buildRedTeamCtx(primary, vulnScore),
  };
}
