/**
 * Live Governed Knowledge Acquisition — Phase 50B
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * No internet crawling. No book downloading. No autonomous self-training.
 * No raw copyrighted text storage. No automatic corpus insertion.
 *
 * Activates the governed acquisition workflow from Phase-50A infrastructure.
 * Genesis may evaluate approved source candidates and propose compressed
 * corpus entries under strict multi-layer governance.
 *
 * All acquisition remains:
 *   source-gated      — only pre-approved institutional source classes
 *   credibility-scored — explicit quality and durability evaluation per source type
 *   compressed         — structural templates only; no raw or copyrighted text ever stored
 *   reviewable         — every evaluation is auditable and deterministic
 *   non-executive      — Genesis proposes; humans decide; no automatic corpus write
 *   human-governed     — human approval is mandatory at every gate; no exceptions
 *
 * Approved source classes (from Phase-50A SourceClass):
 *   institutional_research, economics_literature, policy_publication,
 *   academic_framework, historical_material, market_structure_research
 *
 * Candidate evaluation states:
 *   rejected                 — failed one or more governance gate(s)
 *   candidate                — source approved but evidence too thin to promote
 *   credible_candidate       — passed credibility check; competing view required
 *   debated_candidate        — credible + competing view but debate or risk present
 *   governance_review_required — all gates passed; human review is the next mandatory step
 *   approved_for_compression  — all criteria met; compression template proposed; human approval still required
 *
 * Compression is structural only:
 *   causal map template, framework class annotation, competing school note,
 *   uncertainty note — NEVER raw source text, NEVER copyrighted passages.
 *
 * Safety assertions (always enforced):
 *   isAutonomousCrawling — always false; no internet access initiated
 *   isRawTextStorage     — always false; no verbatim source text stored
 *   isCopyrightViolation — always false; no copyrighted passages stored
 *   isAutoCorpusInsert   — always false; no automatic corpus write path
 *   requiresHumanApproval — always true; human approval is mandatory before any corpus entry
 */

import type { FrameworkClass, ThinkingSchool } from "@/services/knowledge/knowledgeCorpus";
import type { SourceClass } from "@/services/knowledge/governedKnowledgeAcquisition";
import type { FirewallState } from "@/services/governance/decisionFirewall";
import type { GovernanceState } from "@/services/governance/governanceOS";

// ─── Approved Source Registry ─────────────────────────────────────────────────
// Static registry of pre-approved institutional source types.
// NOT a list of live URLs. Defines governance parameters per source class.
// Only sources matching an approved class may enter the candidate pipeline.

interface ApprovedSourceSpec {
  readonly class: SourceClass;
  readonly label: string;
  readonly credibilityFloor: number;      // minimum credibility score (0-100) to progress
  readonly requiresCompetingView: boolean;
  readonly evidenceDurabilityMin: "medium" | "high";
  readonly institutionalExamples: readonly string[]; // illustrative categories only; no live URLs
}

const APPROVED_SOURCE_REGISTRY: ReadonlyArray<ApprovedSourceSpec> = [
  {
    class: "institutional_research",
    label: "Institutional Research",
    credibilityFloor: 60,
    requiresCompetingView: true,
    evidenceDurabilityMin: "medium",
    institutionalExamples: [
      "BIS Working Papers", "Federal Reserve Research Papers",
      "ECB Working Papers", "NBER Research Papers",
      "Central Bank Quarterly Reviews", "Bank of England Staff Papers",
    ],
  },
  {
    class: "economics_literature",
    label: "Peer-Reviewed Economics Literature",
    credibilityFloor: 65,
    requiresCompetingView: true,
    evidenceDurabilityMin: "medium",
    institutionalExamples: [
      "American Economic Review", "Journal of Finance",
      "Review of Economic Studies", "Journal of Political Economy",
      "Quarterly Journal of Economics", "Journal of Financial Economics",
    ],
  },
  {
    class: "policy_publication",
    label: "Policy & Central Bank Publications",
    credibilityFloor: 55,
    requiresCompetingView: true,
    evidenceDurabilityMin: "medium",
    institutionalExamples: [
      "IMF Staff Discussion Notes", "IMF World Economic Outlook",
      "World Bank Research Reports", "OECD Economic Surveys",
      "Central Bank Policy Statements", "BIS Annual Reports",
    ],
  },
  {
    class: "historical_material",
    label: "Historical Market Material",
    credibilityFloor: 50,
    requiresCompetingView: false,  // historical facts may stand without a competing view
    evidenceDurabilityMin: "high",
    institutionalExamples: [
      "Historical crisis postmortems", "Monetary history archives",
      "Market episode analyses", "Financial history scholarship",
      "Regulatory postmortem reviews", "Central bank historical studies",
    ],
  },
  {
    class: "market_structure_research",
    label: "Market Structure Research",
    credibilityFloor: 60,
    requiresCompetingView: true,
    evidenceDurabilityMin: "medium",
    institutionalExamples: [
      "Exchange microstructure studies", "Market liquidity research",
      "Price discovery analysis", "Order-book depth studies",
      "Market design papers", "Regulatory market impact analyses",
    ],
  },
  {
    class: "academic_framework",
    label: "Academic Economic Frameworks",
    credibilityFloor: 65,
    requiresCompetingView: true,
    evidenceDurabilityMin: "medium",
    institutionalExamples: [
      "Mainstream macroeconomic models", "Applied econometrics papers",
      "Financial economics theory", "Behavioral economics frameworks",
      "Institutional economics", "Post-Keynesian framework papers",
    ],
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type CandidateState =
  | "rejected"                   // failed one or more governance gate(s)
  | "candidate"                  // source approved but evidence too thin to promote
  | "credible_candidate"         // passed credibility; competing view required before review
  | "debated_candidate"          // credible + competing view but debate or governance risk
  | "governance_review_required" // all gates passed; human review is mandatory next step
  | "approved_for_compression";  // all criteria met; structural compression proposed; human approval required

export type CandidateRejectionReason =
  | "source_not_approved"        // source class not in APPROVED_SOURCE_REGISTRY
  | "firewall_blocked"           // decision firewall is in blocked state
  | "governance_crisis"          // governance OS in human_review_priority; new acquisition blocked
  | "credibility_below_floor"    // credibility score is below the source type's minimum
  | "popularity_or_social_bias"  // source is popularity-driven or social-media origin
  | "certainty_amplification"    // source overstates confidence beyond evidence
  | "ideological_concentration"  // single school dominates; no competing view available
  | "evidence_too_thin";         // evidence is thin with low institutional relevance

export interface KnowledgeCandidate {
  readonly id: string;                             // deterministic identifier
  readonly label: string;                          // brief description of the knowledge area
  readonly sourceClass: SourceClass;               // must match an approved source class
  readonly proposedFrameworkClass: FrameworkClass; // intended corpus framework category
  readonly proposedSchool: ThinkingSchool;         // primary thinking school
  readonly credibilityScore: number;               // 0-100; derived from context signals
  readonly hasCompetingView: boolean;              // at least one competing school view exists
  readonly evidenceDurability: "high" | "medium" | "low";
  readonly institutionalRelevance: "high" | "medium" | "low";
  readonly historicalImportance: boolean;
  readonly uncertaintyLevel: "low" | "moderate" | "high";
  readonly governanceRisk: "none" | "low" | "moderate" | "high";
  readonly proposedBy: "sandbox" | "research_coverage" | "book_intelligence" | "historical_context";
  readonly popularityDriven: boolean;              // true = popularity over institutional quality
  readonly hasSocialMediaOrigin: boolean;          // true = social/viral source; always rejected
  readonly amplifiesCertainty: boolean;            // true = overstates confidence; always rejected
}

export interface CompressionProposal {
  readonly candidateId: string;
  readonly proposedTitle: string;        // structural title for what compression would cover
  readonly frameworkClass: FrameworkClass;
  readonly school: ThinkingSchool;
  readonly causalMapTemplate: string;    // A → B → C structural template; NOT actual causal claims
  readonly competingSchoolClass: ThinkingSchool | null;  // which school provides the counterargument
  readonly uncertaintyNote: string;      // key uncertainty about this knowledge area
  readonly governanceStatus: "pending_human_review"; // always pending; never auto-approved
  // Safety assertions — always enforced; no exceptions
  readonly containsRawSourceText: false;
  readonly containsCopyrightedPassage: false;
  readonly isAutoApproved: false;
}

export interface KnowledgeCandidateEvaluation {
  readonly candidate: KnowledgeCandidate;
  readonly evaluatedState: CandidateState;
  readonly rejectionReason: CandidateRejectionReason | null;
  readonly compressionProposal: CompressionProposal | null; // only when approved_for_compression
  readonly governanceNotes: string[];                       // ≤3 advisory notes; hedged language
  readonly contextString: string;                           // compact ≤110 chars per evaluation
  // Safety assertions — always enforced
  readonly isAutoIngested: false;
  readonly requiresHumanReview: true;
  readonly containsRawText: false;
}

export interface LiveAcquisitionContextInput {
  sandboxCandidates: string[];                // from Phase-49 researchCandidates
  hasHistoricalAnalog: boolean;               // from bookIntelligence
  historicalAnalogLabel: string | null;       // from bookIntelligence
  frameworkConflict: boolean;                 // from governanceOS activeConflicts
  dominantSchool: ThinkingSchool | null;      // from bookIntelligence topCards[0].thinkingSchool
  hasCompetingView: boolean;                  // from bookIntelligence competingSchool
  credibilityScore: number;                   // 0-100 from credibilityEngine
  coverageRelevance: "high" | "medium" | "low"; // from researchCoverageEngine
  governanceState: GovernanceState;
  firewallState: FirewallState;
  existingCorpusSize: number;                 // current CORPUS_CARDS.length
  ar: boolean;
}

export interface LiveAcquisitionSummary {
  readonly evaluations: KnowledgeCandidateEvaluation[];
  readonly approvedForCompression: number;
  readonly awaitingReview: number;
  readonly rejected: number;
  readonly primaryContextString: string;      // most relevant compact context string
  readonly competingFrameworkContext: string; // competing framework when detected
  // Safety assertions — always enforced
  readonly isAutonomousCrawling: false;
  readonly isRawTextStorage: false;
  readonly isCopyrightViolation: false;
  readonly isAutoCorpusInsert: false;
  readonly requiresHumanApproval: true;
}

// ─── Causal map templates ─────────────────────────────────────────────────────
// Structural patterns only — not actual content from any source.

const CAUSAL_MAP_TEMPLATES: Record<FrameworkClass, string> = {
  macro_framework:       "policy_signal → transmission_mechanism → macro_outcome → asset_response",
  monetary_framework:    "CB_action → rate_adjustment → credit_conditions → valuation_effect",
  market_framework:      "market_structure → price_discovery → efficiency_state → mispricing_risk",
  behavioral_framework:  "behavioral_bias → decision_distortion → systematic_error → market_anomaly",
  historical_framework:  "trigger_event → crisis_phase → transmission_channel → resolution_path",
  portfolio_framework:   "risk_factor → return_premium → portfolio_exposure → cycle_sensitivity",
  policy_framework:      "policy_change → adjustment_mechanism → economic_effect → market_impact",
  uncertainty_framework: "tail_event → model_assumption_failure → risk_repricing → system_stress",
};

// ─── Competing school map ─────────────────────────────────────────────────────
// Maps each school to its primary opposing school for diversity enforcement.

const OPPOSING_SCHOOL: Partial<Record<ThinkingSchool, ThinkingSchool>> = {
  keynesian:            "austrian",
  monetarist:           "post_keynesian",
  austrian:             "keynesian",
  behavioral:           "market_microstructure",
  institutional:        "monetarist",
  post_keynesian:       "monetarist",
  market_microstructure: "behavioral",
  heterodox:            "institutional",
};

// ─── Source gate ──────────────────────────────────────────────────────────────

function findSourceSpec(sourceClass: SourceClass): ApprovedSourceSpec | null {
  return APPROVED_SOURCE_REGISTRY.find(s => s.class === sourceClass) ?? null;
}

// ─── Candidate state derivation ───────────────────────────────────────────────

function evaluateCandidateState(
  candidate: KnowledgeCandidate,
  spec: ApprovedSourceSpec,
  firewallState: FirewallState,
  governanceState: GovernanceState,
): { state: CandidateState; reason: CandidateRejectionReason | null } {
  const {
    credibilityScore, hasCompetingView, evidenceDurability, institutionalRelevance,
    historicalImportance, uncertaintyLevel, governanceRisk,
    popularityDriven, hasSocialMediaOrigin, amplifiesCertainty,
  } = candidate;

  // Gate 1: Firewall
  if (firewallState === "blocked") return { state: "rejected", reason: "firewall_blocked" };

  // Gate 2: Governance crisis blocks new acquisition
  if (governanceState === "human_review_priority") {
    return { state: "rejected", reason: "governance_crisis" };
  }

  // Gate 3: Source quality hard rejections
  if (hasSocialMediaOrigin || popularityDriven) {
    return { state: "rejected", reason: "popularity_or_social_bias" };
  }
  if (amplifiesCertainty) {
    return { state: "rejected", reason: "certainty_amplification" };
  }

  // Gate 4: Credibility floor
  if (credibilityScore < spec.credibilityFloor) {
    return { state: "rejected", reason: "credibility_below_floor" };
  }

  // Gate 5: Ideological concentration without competing view
  if (governanceRisk === "high") {
    return { state: "rejected", reason: "ideological_concentration" };
  }

  // Gate 6: Evidence thinness
  if (
    evidenceDurability === "low" &&
    institutionalRelevance === "low" &&
    !historicalImportance
  ) {
    return { state: "candidate", reason: null };
  }

  // Gate 7: Competing view requirement
  if (spec.requiresCompetingView && !hasCompetingView && governanceRisk !== "none") {
    return { state: "credible_candidate", reason: null };
  }
  if (!hasCompetingView && evidenceDurability === "low") {
    return { state: "credible_candidate", reason: null };
  }

  // Gate 8: Debate/moderate risk check
  if (uncertaintyLevel === "high" || governanceRisk === "moderate") {
    return { state: "debated_candidate", reason: null };
  }

  // Gate 9: Elevated governance state blocks final promotion
  if (
    governanceState === "conflict_detected" ||
    governanceState === "elevated_uncertainty"
  ) {
    return { state: "governance_review_required", reason: null };
  }

  // Gate 10: Compression approval — all criteria met
  if (
    credibilityScore >= 65 &&
    hasCompetingView &&
    (evidenceDurability === "high" || historicalImportance) &&
    (governanceRisk === "none" || governanceRisk === "low") &&
    uncertaintyLevel !== "high"
  ) {
    return { state: "approved_for_compression", reason: null };
  }

  return { state: "governance_review_required", reason: null };
}

// ─── Compression proposal ─────────────────────────────────────────────────────
// Generates a structural template only — no actual source content, no passages.

function generateCompressionProposal(candidate: KnowledgeCandidate): CompressionProposal {
  const {
    id, label, proposedFrameworkClass, proposedSchool,
    uncertaintyLevel, hasCompetingView,
  } = candidate;

  const causalTemplate = CAUSAL_MAP_TEMPLATES[proposedFrameworkClass];
  const competingSchool = hasCompetingView
    ? (OPPOSING_SCHOOL[proposedSchool] ?? null)
    : null;

  const uncertaintyNote =
    uncertaintyLevel === "high" ? "Significant uncertainty in evidence chain; competing interpretations present."
    : uncertaintyLevel === "moderate" ? "Moderate uncertainty; at least one alternative explanation applies."
    : "Evidence reasonably durable; standard analytical caveats apply.";

  const frameworkLabel = proposedFrameworkClass.replace(/_/g, " ");
  const schoolLabel = proposedSchool.replace(/_/g, " ");
  const proposedTitle = `${frameworkLabel} — ${label.slice(0, 50).trim()} (${schoolLabel} perspective)`;

  return {
    candidateId: id,
    proposedTitle,
    frameworkClass: proposedFrameworkClass,
    school: proposedSchool,
    causalMapTemplate: causalTemplate,
    competingSchoolClass: competingSchool,
    uncertaintyNote,
    governanceStatus: "pending_human_review",
    containsRawSourceText: false,
    containsCopyrightedPassage: false,
    isAutoApproved: false,
  };
}

// ─── Governance notes ─────────────────────────────────────────────────────────

function buildGovernanceNotes(
  state: CandidateState,
  reason: CandidateRejectionReason | null,
  candidate: KnowledgeCandidate,
  ar: boolean,
): string[] {
  const notes: string[] = [];

  if (reason) {
    const REASON_EN: Record<CandidateRejectionReason, string> = {
      source_not_approved:       "Source class is not in the approved institutional registry.",
      firewall_blocked:          "Decision firewall is blocked; knowledge acquisition is suspended.",
      governance_crisis:         "Governance OS is in human-review-priority; new acquisition is deferred.",
      credibility_below_floor:   "Source credibility is below the minimum floor for this source class.",
      popularity_or_social_bias: "Source appears popularity-driven or of social/viral origin; excluded by governance policy.",
      certainty_amplification:   "Source overstates confidence beyond its evidence base; rejected by governance.",
      ideological_concentration: "High governance risk from ideological concentration; competing view required.",
      evidence_too_thin:         "Evidence is too thin and institutional relevance too low to progress the candidate.",
    };
    const REASON_AR: Record<CandidateRejectionReason, string> = {
      source_not_approved:       "فئة المصدر غير موجودة في السجل المؤسسي المعتمد.",
      firewall_blocked:          "جدار الحماية محجوب؛ اكتساب المعرفة معلّق.",
      governance_crisis:         "نظام الحوكمة يستوجب مراجعة بشرية؛ الاكتساب الجديد مؤجّل.",
      credibility_below_floor:   "مصداقية المصدر أقل من الحد الأدنى لهذه الفئة.",
      popularity_or_social_bias: "المصدر يبدو شعبوياً أو ذا أصل اجتماعي/فيروسي؛ مستبعد بسياسة الحوكمة.",
      certainty_amplification:   "المصدر يُبالغ في الثقة فوق أدلته؛ مرفوض بالحوكمة.",
      ideological_concentration: "خطر حوكمة مرتفع من التركيز الأيديولوجي؛ مطلوب رأي مدرسة منافسة.",
      evidence_too_thin:         "الأدلة رقيقة جداً والأهمية المؤسسية منخفضة لترقية المرشح.",
    };
    notes.push(ar ? REASON_AR[reason] : REASON_EN[reason]);
  }

  if (state === "approved_for_compression" && notes.length < 3) {
    notes.push(ar
      ? "اكتملت فحوصات الحوكمة؛ هيكل الضغط مُقترح للمراجعة البشرية — لا إدراج تلقائي."
      : "Governance checks complete; compression structure proposed for human review — no automatic corpus entry.");
  }

  if (state === "governance_review_required" && notes.length < 3) {
    notes.push(ar
      ? "المرشح جاهز للمراجعة البشرية؛ لا يمكن تجاوز هذه المرحلة تلقائياً."
      : "Candidate is ready for human governance review; this gate cannot be bypassed automatically.");
  }

  if (state === "debated_candidate" && notes.length < 3) {
    notes.push(ar
      ? `المرشح ذو مصداقية لكن مطعون فيه؛ مدرسة ${candidate.proposedSchool.replace(/_/g, " ")} والرأي المعارض كلاهما مطلوبان.`
      : `Candidate is credible but debated; ${candidate.proposedSchool.replace(/_/g, " ")} school and competing view are both required.`);
  }

  if (
    (state === "approved_for_compression" || state === "governance_review_required") &&
    notes.length < 3
  ) {
    notes.push(ar
      ? "الموافقة البشرية الصريحة مطلوبة قبل أي إدراج في المجموعة المعرفية."
      : "Explicit human approval is required before any corpus entry.");
  }

  return notes.slice(0, 3);
}

// ─── Individual context string ────────────────────────────────────────────────

function buildEvaluationContextString(
  state: CandidateState,
  candidate: KnowledgeCandidate,
): string {
  switch (state) {
    case "rejected":
    case "candidate":
      return "";
    case "credible_candidate":
      return `Knowledge candidate: ${candidate.label.slice(0, 55)}; credible`.slice(0, 110);
    case "debated_candidate":
      return `Knowledge candidate: ${candidate.label.slice(0, 50)}; debated`.slice(0, 110);
    case "governance_review_required":
      return `Source review: ${candidate.label.slice(0, 55)}; governance review required`.slice(0, 110);
    case "approved_for_compression":
      return `Compression candidate: ${candidate.label.slice(0, 50)}; human review required`.slice(0, 110);
  }
}

// ─── Candidate generator from context signals ─────────────────────────────────
// Generates bounded candidate list from existing intelligence signals.
// Does NOT access any external source; all candidates are derived from internal signals.

function generateCandidatesFromContext(input: LiveAcquisitionContextInput): KnowledgeCandidate[] {
  const {
    sandboxCandidates, hasHistoricalAnalog, historicalAnalogLabel,
    frameworkConflict, dominantSchool, hasCompetingView,
    credibilityScore, coverageRelevance,
  } = input;
  const candidates: KnowledgeCandidate[] = [];

  const relevanceScore =
    coverageRelevance === "high" ? 75 :
    coverageRelevance === "medium" ? 55 : 40;

  const effectiveCredibility = Math.min(100, Math.round((credibilityScore + relevanceScore) / 2));

  // Candidate 1: Historical analog — derived from bookIntelligence
  if (hasHistoricalAnalog && historicalAnalogLabel && candidates.length < 3) {
    candidates.push({
      id: `hist_${historicalAnalogLabel.slice(0, 20).replace(/\s+/g, "_").toLowerCase()}`,
      label: historicalAnalogLabel,
      sourceClass: "historical_material",
      proposedFrameworkClass: "historical_framework",
      proposedSchool: dominantSchool ?? "institutional",
      credibilityScore: Math.max(55, effectiveCredibility),
      hasCompetingView: hasCompetingView || false,
      evidenceDurability: "high",
      institutionalRelevance: coverageRelevance,
      historicalImportance: true,
      uncertaintyLevel: "moderate",
      governanceRisk: "low",
      proposedBy: "historical_context",
      popularityDriven: false,
      hasSocialMediaOrigin: false,
      amplifiesCertainty: false,
    });
  }

  // Candidate 2: Framework conflict — derived from governance OS + bookIntelligence
  if (frameworkConflict && dominantSchool && candidates.length < 3) {
    const school = dominantSchool;
    const conflictLabel = `${school.replace(/_/g, " ")} vs competing school framework comparison`;
    candidates.push({
      id: `fw_conflict_${school}`,
      label: conflictLabel,
      sourceClass: "academic_framework",
      proposedFrameworkClass: "macro_framework",
      proposedSchool: school,
      credibilityScore: Math.max(60, effectiveCredibility),
      hasCompetingView: true,
      evidenceDurability: "medium",
      institutionalRelevance: coverageRelevance,
      historicalImportance: false,
      uncertaintyLevel: "moderate",
      governanceRisk: "low",
      proposedBy: "book_intelligence",
      popularityDriven: false,
      hasSocialMediaOrigin: false,
      amplifiesCertainty: false,
    });
  }

  // Candidate 3: Sandbox-surfaced topic — derived from Phase-49 researchCandidates
  if (sandboxCandidates.length > 0 && candidates.length < 3) {
    const sandboxTopic = sandboxCandidates[0];
    // Infer source class and framework from sandbox topic content
    const isThesis = sandboxTopic.toLowerCase().includes("thesis");
    const isHistorical = sandboxTopic.toLowerCase().includes("analog") || sandboxTopic.toLowerCase().includes("نظير");
    const isFramework = sandboxTopic.toLowerCase().includes("framework") || sandboxTopic.toLowerCase().includes("أطر");

    const srcClass: SourceClass = isHistorical ? "historical_material"
      : isFramework ? "academic_framework"
      : "institutional_research";

    const fwClass: FrameworkClass = isHistorical ? "historical_framework"
      : isFramework ? "macro_framework"
      : isThesis ? "portfolio_framework"
      : "macro_framework";

    const rawLabel = sandboxTopic.replace(/^(مرشح للمراجعة:|Review candidate:)\s*/i, "").slice(0, 70).trim();

    candidates.push({
      id: `sandbox_${rawLabel.slice(0, 15).replace(/\s+/g, "_").toLowerCase()}`,
      label: rawLabel,
      sourceClass: srcClass,
      proposedFrameworkClass: fwClass,
      proposedSchool: dominantSchool ?? "institutional",
      credibilityScore: Math.max(50, effectiveCredibility - 10),
      hasCompetingView: hasCompetingView,
      evidenceDurability: "medium",
      institutionalRelevance: coverageRelevance,
      historicalImportance: isHistorical,
      uncertaintyLevel: "moderate",
      governanceRisk: "low",
      proposedBy: "sandbox",
      popularityDriven: false,
      hasSocialMediaOrigin: false,
      amplifiesCertainty: false,
    });
  }

  return candidates.slice(0, 3); // Hard cap: max 3 candidates per cycle
}

// ─── Full candidate evaluation ────────────────────────────────────────────────

function evaluateCandidate(
  candidate: KnowledgeCandidate,
  firewallState: FirewallState,
  governanceState: GovernanceState,
  ar: boolean,
): KnowledgeCandidateEvaluation {
  const spec = findSourceSpec(candidate.sourceClass);

  if (!spec) {
    const notes = ar
      ? ["فئة المصدر غير معتمدة؛ مرفوض من بوابة المصادر."]
      : ["Source class is not in the approved registry; rejected at source gate."];
    return {
      candidate,
      evaluatedState: "rejected",
      rejectionReason: "source_not_approved",
      compressionProposal: null,
      governanceNotes: notes,
      contextString: "",
      isAutoIngested: false,
      requiresHumanReview: true,
      containsRawText: false,
    };
  }

  const { state, reason } = evaluateCandidateState(candidate, spec, firewallState, governanceState);
  const compressionProposal = state === "approved_for_compression"
    ? generateCompressionProposal(candidate)
    : null;
  const governanceNotes = buildGovernanceNotes(state, reason, candidate, ar);
  const contextString = buildEvaluationContextString(state, candidate);

  return {
    candidate,
    evaluatedState: state,
    rejectionReason: reason,
    compressionProposal,
    governanceNotes,
    contextString,
    isAutoIngested: false,
    requiresHumanReview: true,
    containsRawText: false,
  };
}

// ─── Primary context string builder ──────────────────────────────────────────

function buildPrimaryContextString(evaluations: KnowledgeCandidateEvaluation[]): string {
  // Emit the most advanced state found in the batch
  const approved = evaluations.find(e => e.evaluatedState === "approved_for_compression");
  if (approved) return approved.contextString;

  const review = evaluations.find(e => e.evaluatedState === "governance_review_required");
  if (review) return review.contextString;

  const debated = evaluations.find(e => e.evaluatedState === "debated_candidate");
  if (debated) return debated.contextString;

  const credible = evaluations.find(e => e.evaluatedState === "credible_candidate");
  if (credible) return credible.contextString;

  return "";
}

// ─── Competing framework context ──────────────────────────────────────────────

function buildCompetingFrameworkContext(
  evaluations: KnowledgeCandidateEvaluation[],
): string {
  for (const ev of evaluations) {
    const proposal = ev.compressionProposal;
    if (!proposal?.competingSchoolClass) continue;
    const school = ev.candidate.proposedSchool.replace(/_/g, " ");
    const competing = proposal.competingSchoolClass.replace(/_/g, " ");
    return `Competing framework: ${school} vs ${competing}`.slice(0, 80);
  }
  // Check debated candidates too
  for (const ev of evaluations) {
    if (ev.evaluatedState !== "debated_candidate") continue;
    const school = ev.candidate.proposedSchool.replace(/_/g, " ");
    const opposing = OPPOSING_SCHOOL[ev.candidate.proposedSchool];
    if (opposing) {
      return `Competing framework: ${school} vs ${opposing.replace(/_/g, " ")}`.slice(0, 80);
    }
  }
  return "";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function runLiveAcquisitionCycle(input: LiveAcquisitionContextInput): LiveAcquisitionSummary {
  const { firewallState, governanceState, ar } = input;

  // If firewall is blocked, return safe empty summary immediately
  if (firewallState === "blocked") {
    return {
      evaluations: [],
      approvedForCompression: 0,
      awaitingReview: 0,
      rejected: 0,
      primaryContextString: "",
      competingFrameworkContext: "",
      isAutonomousCrawling: false,
      isRawTextStorage: false,
      isCopyrightViolation: false,
      isAutoCorpusInsert: false,
      requiresHumanApproval: true,
    };
  }

  const candidates = generateCandidatesFromContext(input);

  // Evaluate each candidate through the full governance pipeline
  const evaluations = candidates.map(c =>
    evaluateCandidate(c, firewallState, governanceState, ar),
  );

  const approvedForCompression = evaluations.filter(
    e => e.evaluatedState === "approved_for_compression",
  ).length;

  const awaitingReview = evaluations.filter(
    e => e.evaluatedState === "governance_review_required" ||
         e.evaluatedState === "debated_candidate" ||
         e.evaluatedState === "credible_candidate",
  ).length;

  const rejected = evaluations.filter(
    e => e.evaluatedState === "rejected" || e.evaluatedState === "candidate",
  ).length;

  const primaryContextString = buildPrimaryContextString(evaluations);
  const competingFrameworkContext = buildCompetingFrameworkContext(evaluations);

  return {
    evaluations,
    approvedForCompression,
    awaitingReview,
    rejected,
    primaryContextString,
    competingFrameworkContext,
    isAutonomousCrawling: false,
    isRawTextStorage: false,
    isCopyrightViolation: false,
    isAutoCorpusInsert: false,
    requiresHumanApproval: true,
  };
}
