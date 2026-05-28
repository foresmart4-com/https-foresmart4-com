/**
 * Governed Knowledge Acquisition — Phase 50A
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Infrastructure for future governed knowledge learning pipeline.
 * No live acquisition. No internet crawling. No downloading. No API dependency.
 *
 * Pipeline (source → corpus candidate):
 *   source → credibility → relevance → compression → competing framework
 *   → governance review → corpus candidate
 *
 * Source classes:
 *   institutional_research    — CB reports, BIS papers, institutional research
 *   economics_literature      — peer-reviewed academic economics
 *   policy_publication        — IMF, World Bank, government policy documents
 *   historical_material       — historical market data, crisis postmortems
 *   market_structure_research — microstructure, liquidity, market design
 *   academic_framework        — theoretical frameworks, applied economics
 *
 * Acquisition states:
 *   candidate         — identified; not yet evaluated by governance pipeline
 *   credible          — passed credibility + relevance; competing framework required
 *   debated           — credible but contested by at least one competing school
 *   rejected          — failed one or more governance filters
 *   governance_review — all filters passed; awaiting explicit human governance review
 *
 * No source enters corpus automatically.
 * canEnterCorpus is only true when all governance filters pass AND state = governance_review.
 * Human review is always mandatory — canEnterCorpus does not trigger ingestion.
 *
 * Governance prevents:
 *   - ideological_dominance  — single school over-represented in candidates
 *   - popularity_bias        — trending sources favoured over institutional ones
 *   - social_media_sourcing  — viral/social origin instead of research provenance
 *   - blind_ingestion        — no competing framework counterpart exists
 *   - certainty_amplification — source overstates confidence beyond evidence support
 *   - uncontrolled_growth    — candidate volume exceeds governed corpus growth limit
 *
 * Governance supports:
 *   - competing schools, evidence durability, institutional relevance, historical importance
 *
 * Safety assertions (always enforced):
 *   isLiveAcquisition      — always false; no live content is fetched
 *   isCrawling             — always false; no internet crawling
 *   isAutoIngestion        — always false; no automatic corpus entry
 *   requiresGovernanceReview — always true; human review is mandatory before any entry
 */

import type { FirewallState } from "@/services/governance/decisionFirewall";
import type { GovernanceState } from "@/services/governance/governanceOS";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SourceClass =
  | "institutional_research"    // CB reports, BIS, institutional research papers
  | "economics_literature"      // peer-reviewed academic economics
  | "policy_publication"        // IMF, World Bank, government policy documents
  | "historical_material"       // historical episodes, crisis postmortems
  | "market_structure_research" // microstructure, liquidity, market design
  | "academic_framework";       // theoretical frameworks, applied economics

export type AcquisitionState =
  | "candidate"          // identified; not yet evaluated by governance
  | "credible"           // passed credibility + relevance; awaiting framework check
  | "debated"            // credible but contested by at least one competing school
  | "rejected"           // failed one or more governance filters; not eligible for corpus
  | "governance_review"; // all filters passed; awaiting explicit human governance review

export type GovernanceFilter =
  | "ideological_dominance"    // single school over-represented; diversity needed
  | "popularity_bias"          // trending/popular rather than institutionally grounded
  | "social_media_sourcing"    // origin from social/narrative rather than research
  | "blind_ingestion"          // no competing framework counterpart exists
  | "certainty_amplification"  // source overstates conclusions beyond evidence
  | "uncontrolled_growth";     // pending candidate volume exceeds governed limit

export type PipelineStage =
  | "source_identified"  // pipeline entry point
  | "credibility_check"  // evaluating source quality and institutional provenance
  | "relevance_check"    // evaluating institutional/historical relevance
  | "framework_check"    // verifying competing school presence
  | "governance_gate"    // final governance review gate
  | "corpus_candidate";  // passed all gates; awaiting explicit human review

export interface GovernedKnowledgeAcquisitionInput {
  // Source quality signals
  credibilityScore: number;         // 0-100; higher = more institutionally credible
  hasCompetingFramework: boolean;   // at least one competing school counterpart exists
  evidenceDurability: "high" | "medium" | "low"; // how enduring is the evidence base
  institutionalRelevance: "high" | "medium" | "low"; // relevance to institutional analysis
  historicalImportance: boolean;    // covers documented historical material of record
  // Governance risk signals
  ideologicalRisk: "none" | "low" | "moderate" | "high"; // single-school dominance risk
  popularityDriven: boolean;        // source is trending/popular rather than institutional
  hasSocialMediaOrigin: boolean;    // source originated from social or viral content
  amplifiesCertainty: boolean;      // source overstates confidence beyond evidence support
  // Corpus diversity signals
  existingCorpusDiversity: "diverse" | "balanced" | "narrow"; // current corpus school spread
  sandboxCandidateCount: number;    // sandbox-surfaced candidates currently pending review
  // Governance state
  governanceState: GovernanceState;
  firewallState: FirewallState;
  ar: boolean;
}

export interface GovernedKnowledgeAcquisitionResult {
  evaluatedState: AcquisitionState;
  activeFilters: GovernanceFilter[];  // which governance filters blocked or flagged this source
  canEnterCorpus: boolean;            // true only when state=governance_review && no active filters
  pipelineStage: PipelineStage;       // current position in the acquisition pipeline
  governanceNotes: string[];          // ≤3 advisory notes; hedged language
  contextString: string;              // compact ≤120 chars; "Knowledge review:" prefix; empty for candidate
  // Safety assertions — always enforced
  readonly isLiveAcquisition: false;
  readonly isCrawling: false;
  readonly isAutoIngestion: false;
  readonly requiresGovernanceReview: true;
}

// ─── Governance filter detection ──────────────────────────────────────────────

function detectFilters(input: GovernedKnowledgeAcquisitionInput): GovernanceFilter[] {
  const {
    ideologicalRisk, popularityDriven, hasSocialMediaOrigin,
    amplifiesCertainty, hasCompetingFramework, existingCorpusDiversity,
    sandboxCandidateCount, credibilityScore,
  } = input;
  const filters: GovernanceFilter[] = [];

  if (ideologicalRisk === "high") filters.push("ideological_dominance");
  if (popularityDriven) filters.push("popularity_bias");
  if (hasSocialMediaOrigin) filters.push("social_media_sourcing");
  if (!hasCompetingFramework && ideologicalRisk !== "none") filters.push("blind_ingestion");
  if (amplifiesCertainty) filters.push("certainty_amplification");
  if (sandboxCandidateCount >= 5 || (existingCorpusDiversity === "narrow" && credibilityScore < 60)) {
    filters.push("uncontrolled_growth");
  }

  return filters;
}

// ─── Acquisition state derivation ─────────────────────────────────────────────

function deriveAcquisitionState(
  filters: GovernanceFilter[],
  input: GovernedKnowledgeAcquisitionInput,
): AcquisitionState {
  const {
    credibilityScore, hasCompetingFramework, evidenceDurability,
    institutionalRelevance, historicalImportance, ideologicalRisk,
    governanceState, firewallState,
  } = input;

  // Hard rejection: firewall is blocked
  if (firewallState === "blocked") return "rejected";

  // Hard rejection: governance in crisis + multiple filters
  if (governanceState === "human_review_priority" && filters.length >= 2) return "rejected";

  // Hard rejection: source quality failures
  if (
    filters.includes("social_media_sourcing") ||
    filters.includes("popularity_bias") ||
    filters.includes("certainty_amplification")
  ) return "rejected";

  // Hard rejection: credibility too low
  if (credibilityScore < 35) return "rejected";

  // Hard rejection: ideological risk high or blind ingestion
  if (ideologicalRisk === "high" || filters.includes("blind_ingestion")) return "rejected";

  // Candidate: thin evidence, low relevance, no historical importance
  if (
    credibilityScore < 50 &&
    evidenceDurability === "low" &&
    institutionalRelevance === "low" &&
    !historicalImportance
  ) return "candidate";

  // Debated: has competing framework but moderate ideological risk or any active filter
  if (
    credibilityScore >= 50 &&
    hasCompetingFramework &&
    (ideologicalRisk === "moderate" || filters.length >= 1)
  ) return "debated";

  // Credible: meets quality threshold but competing framework not yet confirmed
  if (
    credibilityScore >= 60 &&
    !hasCompetingFramework &&
    ideologicalRisk === "low"
  ) return "credible";

  // Governance review: strong credibility, competing framework, clean filters
  if (
    credibilityScore >= 65 &&
    hasCompetingFramework &&
    (evidenceDurability === "high" || historicalImportance) &&
    filters.length === 0 &&
    (ideologicalRisk === "none" || ideologicalRisk === "low")
  ) return "governance_review";

  // Default: candidate
  return "candidate";
}

// ─── Pipeline stage derivation ────────────────────────────────────────────────

function derivePipelineStage(
  state: AcquisitionState,
  filters: GovernanceFilter[],
  input: GovernedKnowledgeAcquisitionInput,
): PipelineStage {
  if (state === "rejected") {
    if (filters.includes("social_media_sourcing") || filters.includes("popularity_bias")) {
      return "source_identified";
    }
    if (input.credibilityScore < 40) return "credibility_check";
    return "framework_check";
  }
  if (state === "candidate") return "credibility_check";
  if (state === "credible") return "framework_check";
  if (state === "debated") return "governance_gate";
  if (state === "governance_review") return "corpus_candidate";
  return "source_identified";
}

// ─── Governance notes ─────────────────────────────────────────────────────────

function buildGovernanceNotes(
  state: AcquisitionState,
  filters: GovernanceFilter[],
  ar: boolean,
): string[] {
  const notes: string[] = [];

  const FILTER_NOTE_EN: Partial<Record<GovernanceFilter, string>> = {
    ideological_dominance:
      "Ideological concentration detected; source requires a competing school counterpart before governance review.",
    popularity_bias:
      "Source appears popularity-driven rather than institutionally grounded; institutional evidence is required.",
    social_media_sourcing:
      "Social or viral origin detected; social-media-derived sources are excluded from governed acquisition.",
    blind_ingestion:
      "No competing framework counterpart identified; blind ingestion is prevented by governance policy.",
    certainty_amplification:
      "Source overstates confidence beyond its evidence base; certainty amplification is a governance rejection signal.",
    uncontrolled_growth:
      "Pending candidate volume is elevated; corpus growth is rate-limited by governance to preserve quality.",
  };

  const FILTER_NOTE_AR: Partial<Record<GovernanceFilter, string>> = {
    ideological_dominance:
      "تركّز أيديولوجي مُكتشف؛ المصدر يستلزم إطاراً مدرسياً منافساً قبل المراجعة الحوكمية.",
    popularity_bias:
      "المصدر يبدو مدفوعاً بالشهرة لا بالمؤسسية؛ أدلة مؤسسية مطلوبة.",
    social_media_sourcing:
      "أصل اجتماعي أو فيروسي مُكتشف؛ المصادر ذات الأصل الاجتماعي مستبعدة من الاكتساب المحكوم.",
    blind_ingestion:
      "لا يوجد إطار مدرسي منافس؛ الاستيعاب العشوائي ممنوع بموجب سياسة الحوكمة.",
    certainty_amplification:
      "المصدر يُبالغ في الثقة فوق أدلته؛ تضخيم اليقين إشارة رفض حوكمية.",
    uncontrolled_growth:
      "حجم المرشحات المعلّقة مرتفع؛ نمو المجموعة محدود بالحوكمة للحفاظ على الجودة.",
  };

  for (const filter of filters.slice(0, 2)) {
    const note = ar ? FILTER_NOTE_AR[filter] : FILTER_NOTE_EN[filter];
    if (note) notes.push(note);
  }

  if (state === "governance_review" && notes.length < 3) {
    notes.push(ar
      ? "المصدر اجتاز جميع فلاتر الحوكمة؛ المراجعة البشرية الصريحة مطلوبة قبل دخول المجموعة."
      : "Source passed all governance filters; explicit human review is required before any corpus entry.");
  }

  if (state === "rejected" && notes.length < 3) {
    notes.push(ar
      ? "رُفض بمعايير الحوكمة؛ المجموعة المعرفية تتطلب أدلة إطار منافس وقيوداً مكافحة للتحيز."
      : "Rejected by governance criteria; knowledge corpus requires competing-framework evidence and anti-bias constraints.");
  }

  if (state === "debated" && notes.length < 3) {
    notes.push(ar
      ? "المصدر مدعوم لكن مطعون فيه من مدرسة منافسة؛ كلا الجانبين مطلوبان قبل المراجعة الحوكمية."
      : "Source is credible but contested by a competing school; both sides required before governance review.");
  }

  return notes.slice(0, 3);
}

// ─── Context string ───────────────────────────────────────────────────────────

function buildContextString(
  state: AcquisitionState,
  filters: GovernanceFilter[],
): string {
  // No injection for candidate — too early in pipeline
  if (state === "candidate") return "";
  const filterNote = filters.length > 0 ? `; ${filters[0].replace(/_/g, " ")}` : "";
  return `Knowledge review: ${state.replace(/_/g, " ")}${filterNote}`.slice(0, 120);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeGovernedKnowledgeAcquisition(
  input: GovernedKnowledgeAcquisitionInput,
): GovernedKnowledgeAcquisitionResult {
  const { ar } = input;

  const activeFilters = detectFilters(input);
  const evaluatedState = deriveAcquisitionState(activeFilters, input);
  const pipelineStage = derivePipelineStage(evaluatedState, activeFilters, input);
  const governanceNotes = buildGovernanceNotes(evaluatedState, activeFilters, ar);
  const contextString = buildContextString(evaluatedState, activeFilters);

  // canEnterCorpus: true only when all filters pass AND state is governance_review.
  // This does NOT trigger ingestion — human review is always the mandatory final step.
  const canEnterCorpus = evaluatedState === "governance_review" && activeFilters.length === 0;

  return {
    evaluatedState,
    activeFilters,
    canEnterCorpus,
    pipelineStage,
    governanceNotes,
    contextString,
    isLiveAcquisition: false,
    isCrawling: false,
    isAutoIngestion: false,
    requiresGovernanceReview: true,
  };
}
