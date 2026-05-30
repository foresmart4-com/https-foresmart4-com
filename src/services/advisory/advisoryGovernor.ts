// Phase-90A: Advisory Governor
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Final governance layer for Phase-90A. Assembles CIO frame, recommendation
// level, conviction governance, and escalation into a governed advisory
// context (≤400 chars) and enforces institutional language standards.
//
// Prevents:
//   1. Execution language: "buy now", "sell now", "execute", "trade immediately"
//   2. Financial guarantees: "guaranteed return", "certain profit", "no loss"
//   3. Legal framing: "you are required to", "you must invest", "legal obligation"
//   4. Overconfident certainty: "will definitely", "certain to happen", "no doubt"
//   5. Weak framing: "it depends", "nobody knows", "markets go up and down"
//
// Quality score (0-100):
//   +25: CIO frame has specific strategic horizon (not default)
//   +20: recommendation level is actionable (not high_uncertainty)
//   +20: maxConfidenceAnchor ≤ 78 (governed conviction)
//   +20: no forbidden language in assembled context
//   +15: escalation is resolved (any level is fine)
//
// Context format:
//   "{cioBriefing} | {recommendCtx} | Conviction: {maxConfidenceAnchor}% ceiling | {escalationNote}"
//
// Standard institutional disclaimer appended when context is injected.
// Educational/advisory only.

import type { CioAdvisoryFrame }        from "./cioAdvisoryEngine";
import type { RecommendationResult }     from "./recommendationHierarchy";
import type { ConvictionGovernanceResult } from "./convictionGovernor";
import type { EscalationResult }          from "./advisoryEscalationEngine";

// ─── Types ───────────────────────────────────────────────────────────────────────

export interface AdvisoryGovernanceResult {
  approved:            boolean;
  qualityScore:        number;    // 0-100
  repairs:             string[];
  governedAdvisoryCtx: string;    // ≤400 chars injectable
  advisoryDisclaimer:  string;    // ≤80 chars institutional disclaimer
  governanceLog:       string;
}

// ─── Forbidden language ───────────────────────────────────────────────────────

const EXECUTION_RE    = /\b(buy now|sell now|execute|enter.position|place.order|trade.immediately|exit.now)\b/i;
const GUARANTEE_RE    = /\b(guaranteed.return|certain.profit|no.loss|secure.investment|risk.free|مضمون.العائد|ربح.مؤكد)\b/i;
const LEGAL_RE        = /\b(you.are.required.to|you.must.invest|legal.obligation|يجب.عليك.الاستثمار)\b/i;
const CERTAINTY_RE    = /\b(will.definitely|certain.to.happen|no.doubt|absolutely.will|مؤكد.سيحدث)\b/i;
const WEAK_FRAMING_RE = /\b(it.depends|nobody.knows|markets.go.up.and.down|impossible.to.predict|can.t.say)\b/i;

function detectForbiddenLanguage(text: string): string[] {
  const violations: string[] = [];
  if (EXECUTION_RE.test(text))     violations.push("execution_language");
  if (GUARANTEE_RE.test(text))     violations.push("financial_guarantee");
  if (LEGAL_RE.test(text))         violations.push("legal_framing");
  if (CERTAINTY_RE.test(text))     violations.push("certainty_claim");
  if (WEAK_FRAMING_RE.test(text))  violations.push("weak_framing");
  return violations;
}

// ─── Quality scoring ──────────────────────────────────────────────────────────

function scoreQuality(
  cio:        CioAdvisoryFrame,
  rec:        RecommendationResult,
  conviction: ConvictionGovernanceResult,
  escalation: EscalationResult,
  assembled:  string,
): number {
  let score = 0;
  if (cio.strategicHorizon !== "medium_term" || cio.capitalPreservation !== "balanced") score += 25;
  else score += 12;  // even default medium_term/balanced is valid
  if (rec.level !== "high_uncertainty")              score += 20;
  if (conviction.maxConfidenceAnchor <= 78)          score += 20;
  if (detectForbiddenLanguage(assembled).length === 0) score += 20;
  // Escalation always resolved (any level counts)                      score += 15
  score += 15;
  return Math.min(100, score);
}

// ─── Repair detection ─────────────────────────────────────────────────────────

function identifyRepairs(
  cio:        CioAdvisoryFrame,
  rec:        RecommendationResult,
  conviction: ConvictionGovernanceResult,
  assembled:  string,
): string[] {
  const repairs: string[] = [];
  const forbidden = detectForbiddenLanguage(assembled);
  repairs.push(...forbidden);
  if (rec.level === "high_uncertainty") repairs.push("high_uncertainty_recommendation");
  if (conviction.maxConfidenceAnchor > 78) repairs.push("conviction_ceiling_exceeded");
  if (conviction.requiresQualification) repairs.push("qualification_required");
  return repairs;
}

// ─── Context assembly ─────────────────────────────────────────────────────────

function trimTo(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 3) + "...";
}

function assembleAdvisoryCtx(
  cio:        CioAdvisoryFrame,
  rec:        RecommendationResult,
  conviction: ConvictionGovernanceResult,
  escalation: EscalationResult,
  budget:     number,
): string {
  const cioBlock   = trimTo(cio.cioBriefing,     140);
  const recBlock   = trimTo(rec.recommendCtx,     90);
  const convBlock  = `Conviction: ≤${conviction.maxConfidenceAnchor}%${conviction.requiresQualification ? " [qualification required]" : ""}`;
  const escalBlock = escalation.finalEscalation !== "none"
    ? trimTo(escalation.escalationNote, 70)
    : "";

  return [cioBlock, recBlock, convBlock, escalBlock]
    .filter(Boolean)
    .join(" | ")
    .slice(0, budget);
}

// ─── Institutional disclaimer ─────────────────────────────────────────────────

const DISCLAIMER_EN = "All advisory framing is educational and governed — no execution, no guarantees.";
const DISCLAIMER_AR = "جميع الإطارات الاستشارية تعليمية ومحكومة — لا تنفيذ، لا ضمانات.";

// ─── Public API ───────────────────────────────────────────────────────────────

export function governAdvisory(input: {
  cio:        CioAdvisoryFrame;
  rec:        RecommendationResult;
  conviction: ConvictionGovernanceResult;
  escalation: EscalationResult;
  lang:       "ar" | "en";
  budget?:    number;  // default 400
}): AdvisoryGovernanceResult {
  const { cio, rec, conviction, escalation, lang, budget = 400 } = input;

  const assembled    = assembleAdvisoryCtx(cio, rec, conviction, escalation, budget);
  const repairs      = identifyRepairs(cio, rec, conviction, assembled);
  const qualityScore = scoreQuality(cio, rec, conviction, escalation, assembled);
  const approved     = qualityScore >= 50 && !repairs.some(r => ["execution_language","financial_guarantee","legal_framing","certainty_claim"].includes(r));

  const governanceLog = `advisory quality=${qualityScore} approved=${approved} level=${rec.level} maxConf=${conviction.maxConfidenceAnchor}% escalation=${escalation.finalEscalation} repairs=[${repairs.join(",")||"none"}]`;

  return {
    approved,
    qualityScore,
    repairs,
    governedAdvisoryCtx: assembled,
    advisoryDisclaimer:  (lang === "ar" ? DISCLAIMER_AR : DISCLAIMER_EN).slice(0, 80),
    governanceLog,
  };
}
