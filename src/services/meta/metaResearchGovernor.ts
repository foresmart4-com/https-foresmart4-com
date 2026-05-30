// Phase-88C: Meta-Research Governor
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Governs the full meta-research pipeline output. Assembles all 4 engine
// results into one governed context block (≤480 chars) and enforces:
//
//   - No single lopsided thesis without documented vulnerability
//   - No high vulnerability without red-team acknowledgement
//   - No strong bias without de-bias directive
//   - No critical fragility without repair directive
//   - Budget guard: total context ≤480 chars
//
// Quality scoring (0-100):
//   +25: competition is at least moderately contested
//   +20: red-team primary attack is critical or significant
//   +20: bias is clean OR bias correction is present
//   +20: fragility is robust or moderate (thesis is adequately grounded)
//   +15: no certainty language present in competition context
//
// governedMetaCtx format:
//   Thesis competition: {competitionCtx} | Red-team: {primary attack} | {bias note} | {stress note}
//
// Distinct from adaptiveInvestmentGovernor.ts (Phase-84A) which manages
// calibration/learning governance. This governor manages RESEARCH QUALITY.
//
// No execution language. Advisory/educational only.

import type { ThesisCompetitionProfile }  from "./thesisCompetitionEngine";
import type { RedTeamResult }              from "./redTeamReasoningEngine";
import type { BiasDetectionResult }        from "./biasDetectionGovernor";
import type { ResearchStressTestResult }   from "./researchStressTestEngine";

// ─── Types ───────────────────────────────────────────────────────────────────────

export interface MetaResearchGovernanceResult {
  approved:          boolean;
  qualityScore:      number;    // 0-100
  repairs:           string[];
  governedMetaCtx:   string;   // ≤480 chars final injectable
  metaDisclaimer:    string;   // ≤80 chars
  governanceLog:     string;
}

// ─── Certainty language check ─────────────────────────────────────────────────

const CERTAINTY_RE = /\b(will definitely|guaranteed|certain to|inevitable|certain outcome|assured)\b/i;

// ─── Quality scoring ──────────────────────────────────────────────────────────

function scoreQuality(
  competition: ThesisCompetitionProfile,
  redTeam: RedTeamResult,
  bias: BiasDetectionResult,
  stress: ResearchStressTestResult,
): number {
  let score = 0;
  if (competition.contestLevel !== "lopsided")                               score += 25;
  else if (competition.weightSpread < 55)                                    score += 12;

  if (redTeam.primaryAttack.severity === "critical")                         score += 20;
  else if (redTeam.primaryAttack.severity === "significant")                 score += 12;

  if (bias.isClean)                                                           score += 20;
  else if (bias.dominantBias && bias.totalBiasScore < 50)                    score += 10;

  if (stress.fragilityLevel === "robust" || stress.fragilityLevel === "moderate") score += 20;
  else if (stress.fragilityLevel === "fragile")                              score += 8;

  if (!CERTAINTY_RE.test(competition.competitionCtx))                        score += 15;

  return Math.min(100, score);
}

// ─── Repair identification ────────────────────────────────────────────────────

function identifyRepairs(
  competition: ThesisCompetitionProfile,
  redTeam: RedTeamResult,
  bias: BiasDetectionResult,
  stress: ResearchStressTestResult,
): string[] {
  const repairs: string[] = [];
  if (competition.contestLevel === "lopsided" && redTeam.vulnerabilityScore > 50)
    repairs.push("lopsided_thesis_with_high_vulnerability");
  if (redTeam.vulnerabilityScore > 70)
    repairs.push("critical_vulnerability_requires_defence");
  if (!bias.isClean && bias.totalBiasScore > 50)
    repairs.push("strong_bias_requires_de_bias_directive");
  if (stress.fragilityLevel === "critical")
    repairs.push("critical_fragility_requires_repair");
  if (CERTAINTY_RE.test(competition.competitionCtx))
    repairs.push("certainty_language_detected");
  return repairs;
}

// ─── Context assembly ─────────────────────────────────────────────────────────

function trimTo(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 3) + "...";
}

function assembleGovernedCtx(
  competition: ThesisCompetitionProfile,
  redTeam: RedTeamResult,
  bias: BiasDetectionResult,
  stress: ResearchStressTestResult,
): string {
  const compCtx  = trimTo(competition.competitionCtx, 160);
  const rtCtx    = trimTo(
    `Red-team[${redTeam.primaryAttack.vector}]: ${redTeam.primaryAttack.counterArg}`,
    100,
  );
  const biasCtx  = bias.isClean
    ? "Bias: clean"
    : trimTo(`Bias[${bias.dominantBias}]: ${bias.flags[0]?.correction ?? "apply conditional framing"}`, 80);
  const stressCtx = trimTo(
    `Stress[${stress.fragilityLevel}]: ${stress.evidenceResilience.finding}`,
    80,
  );

  return [compCtx, rtCtx, biasCtx, stressCtx].filter(Boolean).join(" | ").slice(0, 480);
}

// ─── Disclaimer ───────────────────────────────────────────────────────────────

const META_DISCLAIMER_EN = "Meta-research is self-critique only — all output is advisory and educational.";
const META_DISCLAIMER_AR = "البحث الذاتي نقد ذاتي فقط — جميع المخرجات استشارية وتعليمية.";

// ─── Public API ───────────────────────────────────────────────────────────────

export function governMetaResearch(input: {
  competition: ThesisCompetitionProfile;
  redTeam:     RedTeamResult;
  bias:        BiasDetectionResult;
  stress:      ResearchStressTestResult;
  lang:        "ar" | "en";
}): MetaResearchGovernanceResult {
  const { competition, redTeam, bias, stress, lang } = input;

  const repairs      = identifyRepairs(competition, redTeam, bias, stress);
  const qualityScore = scoreQuality(competition, redTeam, bias, stress);
  const approved     = qualityScore >= 50 && repairs.filter(r => r !== "certainty_language_detected").length <= 1;

  const governedMetaCtx = assembleGovernedCtx(competition, redTeam, bias, stress);
  const governanceLog   = `meta-research quality=${qualityScore} approved=${approved} repairs=[${repairs.join(",")||"none"}]`;
  const metaDisclaimer  = lang === "ar" ? META_DISCLAIMER_AR : META_DISCLAIMER_EN;

  return {
    approved,
    qualityScore,
    repairs,
    governedMetaCtx,
    metaDisclaimer,
    governanceLog,
  };
}
