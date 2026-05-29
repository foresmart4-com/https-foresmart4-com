// Phase-83B: Investment Judgment Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Purpose: Final synthesis layer that combines all 83A+83B engine outputs into
// a single institutional judgment object. Mandatory gate for serious investment questions.
//
// Inputs:
//   - ThesisEvolutionState (83B)
//   - AllocatorDecision (83B)
//   - ConflictAnalysis (83B)
//   - DepthRulesAudit (83A)
//   - GenesisReply (post-sanitize)
//   - Question context
//
// Outputs:
//   - Institutional stance (clear, actionable)
//   - Confidence explanation (what earns vs limits)
//   - Key risks (specific, not generic)
//   - Dominant logic (single most important factor)
//   - Thesis change conditions
//   - Evidence conflict summary
//   - Judgment score + grade
//   - Injectable prompt context
//
// Rejection upgrade: if judgmentGrade is "weak" or "insufficient",
// the engine produces targeted repair directives.

import type { GenesisReply } from "@/lib/genesis.functions";
import type { ThesisEvolutionState } from "./thesisEvolutionEngine";
import type { AllocatorDecision } from "./allocatorDecisionEngine";
import type { ConflictAnalysis } from "./regimeConflictEngine";
import type { DepthRulesAudit } from "./investmentDepthRules";

// ─── Types ────────────────────────────────────────────────────────────────────

export type JudgmentGrade =
  | "institutional"  // 85+: clear stance, evidence-weighted, conflict-aware, allocator-realistic
  | "strong"         // 70-84: most elements present; minor gaps
  | "acceptable"     // 55-69: stance present but thin on conflict or evidence weighting
  | "weak"           // 40-54: generic or neutral; fails conviction test
  | "insufficient";  // <40: no clear stance, no evidence weighting, no allocator logic

export interface JudgmentDimension {
  name: string;
  score: number;   // 0-100
  weight: number;
  signals: string[];
  gaps: string[];
}

export interface InstitutionalJudgment {
  institutionalStance: string;       // 1-2 sentence clear stance with conviction
  confidenceExplanation: string;     // what earns vs limits confidence
  keyRisks: string[];               // 3-5 specific risks from synthesis
  dominantLogic: string;            // the single most deciding factor
  thesisChangeConditions: string[]; // specific measurable triggers
  evidenceConflictSummary: string;  // how conflicts were resolved
  judgmentScore: number;            // 0-100 weighted
  judgmentGrade: JudgmentGrade;
  dimensions: JudgmentDimension[];
  repairDirectives: string[];       // if grade < strong: targeted repair instructions
  judgmentContext: string;          // compact injectable prompt directive
}

// ─── Dimension scorers ────────────────────────────────────────────────────────

function scoreThesisClarity(
  reply: GenesisReply,
  thesisEvolution: ThesisEvolutionState | null,
): JudgmentDimension {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  // Thesis present and directional (not generic neutral)
  if (reply.thesis) {
    const isNeutral = /neutral|uncertain|unclear|mixed|غير\s+واضح|محايد|متذبذب/i.test(reply.thesis);
    if (!isNeutral) { score += 40; signals.push("directional thesis present"); }
    else { score += 15; gaps.push("thesis present but neutral — no directional stance"); }
  } else {
    gaps.push("thesis absent — no directional view at all");
  }

  // Bull and bear cases present
  if (reply.bullCase && reply.bearCase) { score += 25; signals.push("bull+bear cases present"); }
  else if (reply.bullCase || reply.bearCase) { score += 12; gaps.push("only one side of the debate present"); }
  else { gaps.push("both bull and bear cases absent"); }

  // Base case with reasoning
  if (reply.baseCase) { score += 20; signals.push("baseCase present"); }
  else { gaps.push("baseCase absent — no dominant case stated"); }

  // Thesis evolution stage awareness
  if (thesisEvolution && thesisEvolution.stage !== "absent" && reply.thesis) {
    score += 15; signals.push(`thesis stage: ${thesisEvolution.stage}`);
  } else if (!thesisEvolution?.hasOwnProperty("stage")) {
    gaps.push("no thesis evolution context");
  }

  return { name: "thesisClarity", score: Math.min(100, score), weight: 0.22, signals, gaps };
}

function scoreConvictionLogic(
  reply: GenesisReply,
  allocatorDecision: AllocatorDecision | null,
): JudgmentDimension {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  // Committee stance set
  if (reply.committeeStance) { score += 25; signals.push(`committeeStance: ${reply.committeeStance}`); }
  else { gaps.push("committeeStance absent — no structured conviction"); }

  // Allocator voice with specific deployment logic
  const allocatorText = reply.voiceReasoning?.allocator ?? "";
  const hasDeploymentLogic = /scale|tranche|wait|avoid|deploy|conviction|تدريجي|دفعات|انتظار|تجنب|قناعة/i.test(allocatorText);
  if (hasDeploymentLogic) { score += 25; signals.push("allocator voice has deployment logic"); }
  else if (allocatorText.length > 50) { score += 12; gaps.push("allocator voice present but lacks explicit deployment stance"); }
  else { gaps.push("allocator voice absent or empty"); }

  // Committee synthesis with final stance
  if (reply.committeeSynthesis?.finalStance) { score += 25; signals.push("committeeSynthesis.finalStance set"); }
  else { gaps.push("committee final stance absent"); }

  // Allocator decision from engine
  if (allocatorDecision) {
    const convictionOk = allocatorDecision.conviction >= 40;
    if (convictionOk) { score += 25; signals.push(`allocator conviction ${allocatorDecision.conviction}% from engine`); }
    else { gaps.push(`allocator conviction only ${allocatorDecision.conviction}% — insufficient for deployment`); }
  }

  return { name: "convictionLogic", score: Math.min(100, score), weight: 0.20, signals, gaps };
}

function scoreConflictHandling(
  reply: GenesisReply,
  conflictAnalysis: ConflictAnalysis | null,
): JudgmentDimension {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  const hasConflicts = (conflictAnalysis?.conflictCount ?? 0) > 0;

  if (!hasConflicts) {
    // No conflicts to handle — full score
    return { name: "conflictHandling", score: 100, weight: 0.18, signals: ["no material conflicts detected"], gaps: [] };
  }

  // Conflicts exist — check they were handled
  const allText = [reply.macroChain, reply.outlook, reply.disagreementNote, reply.opposingCase].filter(Boolean).join(" ");

  const hasConflictLanguage = /conflict|contrad|disagree|despite|versus|although|however|تعارض|تناقض|رغم|لكن|إلا\s+أن/i.test(allText);
  if (hasConflictLanguage) { score += 35; signals.push("conflict language detected in reply"); }
  else { gaps.push("conflicts exist but reply shows no conflict language"); }

  if (reply.disagreementNote) { score += 30; signals.push("disagreementNote present"); }
  else { gaps.push("disagreementNote absent despite detected conflicts"); }

  if (reply.arbitrationReason) { score += 20; signals.push("arbitrationReason present"); }
  else { gaps.push("no arbitration logic for conflicting signals"); }

  // Fake consensus check
  if (conflictAnalysis?.fakeConsensusRisk && reply.consensusStrength === "strong") {
    score -= 20; gaps.push("fake consensus risk: strong consensus declared despite significant conflicts");
  } else {
    score += 15; signals.push("no fake consensus detected");
  }

  return { name: "conflictHandling", score: Math.max(0, Math.min(100, score)), weight: 0.18, signals, gaps };
}

function scoreAllocatorRealism(
  reply: GenesisReply,
  allocatorDecision: AllocatorDecision | null,
): JudgmentDimension {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  // Broad vs selective addressed
  const allText = [reply.sectorLens, reply.committeeSynthesis?.finalStance, reply.voiceReasoning?.allocator].filter(Boolean).join(" ");
  const hasSelectivity = /selective|انتقائية|broad.{0,10}(vs|مقابل)|قطاعي/i.test(allText);
  if (hasSelectivity) { score += 25; signals.push("broad vs selective exposure addressed"); }
  else { gaps.push("broad vs selective exposure not addressed"); }

  // Capital preservation / downside protection
  const hasCapPres = /preservation|protect|drawdown|حفظ\s+رأس\s+المال|حماية\s+رأس|التراجع/i.test(allText);
  if (hasCapPres) { score += 20; signals.push("capital preservation framing present"); }
  else { gaps.push("no capital preservation framing"); }

  // Opportunity cost framing
  const hasOpCost = /opportunity\s+cost|cost\s+of\s+wait|تكلفة\s+الفرصة|ثمن\s+الانتظار/i.test(allText);
  if (hasOpCost) { score += 20; signals.push("opportunity cost framing present"); }
  else { gaps.push("opportunity cost not addressed"); }

  // Preservation vs growth tradeoff
  if (allocatorDecision?.preservationPriority) {
    score += 20; signals.push(`preservation priority: ${allocatorDecision.preservationPriority}`);
  }

  // Concentration risk
  const hasConcRisk = /concentration|تركيز\s+المخاطر|تركيز\s+القطاع/i.test(allText);
  if (hasConcRisk) { score += 15; signals.push("concentration risk addressed"); }
  else { gaps.push("concentration risk not mentioned"); }

  return { name: "allocatorRealism", score: Math.min(100, score), weight: 0.20, signals, gaps };
}

function scoreEvidenceWeighting(
  reply: GenesisReply,
  depthAudit: DepthRulesAudit | null,
): JudgmentDimension {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  // Missing evidence present
  if (reply.missingEvidence) { score += 25; signals.push("missingEvidence field present"); }
  else { gaps.push("missingEvidence absent — evidence completeness not assessed"); }

  // Evidence array balanced (not one-sided)
  const evText = (reply.evidence ?? []).join(" ");
  const hasOpportunity = /support|upside|positive|دعم|صاعد|فرصة/.test(evText);
  const hasRisk = /risk|downside|negative|headwind|مخاطر|هابط|ضغط/.test(evText);
  if (hasOpportunity && hasRisk) { score += 25; signals.push("balanced evidence (both opportunity and risk)"); }
  else if (hasOpportunity || hasRisk) { score += 12; gaps.push("evidence is one-sided"); }
  else { gaps.push("evidence array absent or empty"); }

  // Depth rules compliance
  if (depthAudit) {
    const ruleScore = depthAudit.overallScore;
    const rulePts = Math.round((ruleScore / 100) * 30);
    score += rulePts;
    if (ruleScore >= 70) signals.push(`depth rules compliance: ${ruleScore}%`);
    else gaps.push(`depth rules compliance only ${ruleScore}% — ${depthAudit.criticalFailed.length} critical rules failed`);
  } else {
    score += 15; // no audit available = neutral
  }

  // Confidence calibration present
  if (reply.confidenceCalibration) { score += 20; signals.push("confidenceCalibration present"); }
  else { gaps.push("confidenceCalibration absent"); }

  return { name: "evidenceWeighting", score: Math.min(100, score), weight: 0.20, signals, gaps };
}

// ─── Score-to-grade ───────────────────────────────────────────────────────────

function deriveGrade(score: number): JudgmentGrade {
  if (score >= 85) return "institutional";
  if (score >= 70) return "strong";
  if (score >= 55) return "acceptable";
  if (score >= 40) return "weak";
  return "insufficient";
}

// ─── Synthesis builders ───────────────────────────────────────────────────────

function buildInstitutionalStance(
  reply: GenesisReply,
  allocatorDecision: AllocatorDecision | null,
  thesisEvolution: ThesisEvolutionState | null,
  isSaudi: boolean,
  lang: "ar" | "en",
): string {
  const ar = lang === "ar";

  // Prefer committee synthesis finalStance if substantial
  if (reply.committeeSynthesis?.finalStance && reply.committeeSynthesis.finalStance.length > 60) {
    return reply.committeeSynthesis.finalStance;
  }

  // Build from allocator decision
  if (allocatorDecision) {
    const stanceLabel: Record<string, string> = {
      scale_in_gradual:        ar ? "دخول تدريجي" : "scale in gradually",
      scale_in_opportunistic:  ar ? "دخول فرصي انتقائي" : "scale in opportunistically",
      hold_and_monitor:        ar ? "تمسك ومراقبة" : "hold and monitor",
      wait_confirmation:       ar ? "انتظار التأكيد" : "wait for confirmation",
      reduce_selective:        ar ? "تقليص انتقائي" : "reduce selectively",
      avoid_or_reduce:         ar ? "تجنب أو تقليص" : "avoid or reduce",
    };
    const stage = thesisEvolution?.stage ?? "developing";
    const stageLabel = {
      high_conviction: ar ? "قناعة عالية" : "high conviction",
      established: ar ? "أطروحة راسخة" : "established thesis",
      developing: ar ? "أطروحة في تطور" : "developing thesis",
      emerging: ar ? "أطروحة ناشئة" : "emerging thesis",
      contested: ar ? "أطروحة متنازع عليها" : "contested thesis",
      weakening: ar ? "أطروحة ضعيفة" : "weakening thesis",
      invalidated: ar ? "أطروحة مُلغاة" : "invalidated thesis",
    }[stage] ?? "";

    return ar
      ? `موقف اللجنة المؤسسية: ${stanceLabel[allocatorDecision.stance]} (${stageLabel}، قناعة ${allocatorDecision.conviction}%). ${allocatorDecision.primaryLogic}`
      : `Institutional committee stance: ${stanceLabel[allocatorDecision.stance]} (${stageLabel}, conviction ${allocatorDecision.conviction}%). ${allocatorDecision.primaryLogic}`;
  }

  // Fallback: synthesise from reply fields
  const direction = reply.committeeStance?.replace(/_/g, " ") ?? (ar ? "انتقائي" : "selective");
  return ar
    ? `الموقف المؤسسي: ${direction}. ${reply.baseCase ?? ""}`
    : `Institutional stance: ${direction}. ${reply.baseCase ?? ""}`;
}

function buildConfidenceExplanation(
  reply: GenesisReply,
  thesisEvolution: ThesisEvolutionState | null,
  lang: "ar" | "en",
): string {
  const ar = lang === "ar";

  if (reply.confidenceExplanation) return reply.confidenceExplanation;

  const ceiling = thesisEvolution?.convictionCeiling ?? 70;
  const floor = thesisEvolution?.convictionFloor ?? 35;
  const direction = thesisEvolution?.confidenceDirection ?? "stable";
  const dirLabel = ar
    ? { building: "تتصاعد", stable: "مستقرة", deteriorating: "تتراجع", unknown: "غير محددة" }[direction]
    : { building: "building", stable: "stable", deteriorating: "deteriorating", unknown: "unknown" }[direction];

  return ar
    ? `القناعة الحالية ${floor}-${ceiling}% (اتجاه: ${dirLabel}). تكسب القناعة مع: ${thesisEvolution?.strongerConditions[0] ?? "تأكيد الأطروحة"}. تتراجع عند: ${thesisEvolution?.weakerConditions[0] ?? "ظهور أدلة مضادة"}.`
    : `Current conviction range ${floor}-${ceiling}% (direction: ${dirLabel}). Conviction builds with: ${thesisEvolution?.strongerConditions[0] ?? "thesis confirmation"}. Erodes at: ${thesisEvolution?.weakerConditions[0] ?? "contradicting evidence appearing"}.`;
}

function buildKeyRisks(
  reply: GenesisReply,
  conflictAnalysis: ConflictAnalysis | null,
  isSaudi: boolean,
  lang: "ar" | "en",
): string[] {
  const ar = lang === "ar";
  const risks: string[] = [];

  // Start from existing risks in reply
  if (reply.risks?.length) {
    risks.push(...reply.risks.slice(0, 2));
  }

  // Add conflict-based risks
  if (conflictAnalysis?.dominantConflict) {
    const c = conflictAnalysis.dominantConflict;
    risks.push(ar
      ? `تعارض رئيسي: ${c.sideB.slice(0, 80)} (دلالة: ${c.allocatorImplication.slice(0, 60)})`
      : `Dominant conflict: ${c.sideB.slice(0, 80)} (implication: ${c.allocatorImplication.slice(0, 60)})`);
  }

  // Saudi-specific structural risk
  if (isSaudi && risks.length < 4) {
    risks.push(ar
      ? "مخاطر ثانوية سعودية: انخفاض النفط دون نقطة التعادل → سحب احتياطيات SAMA → تضييق ائتمان البنوك → تراجع تقييمات العقارات."
      : "Saudi structural risk: oil below fiscal breakeven → SAMA reserve drawdown → bank credit tightening → real estate valuation compression.");
  }

  // Fake consensus / crowding risk
  if (conflictAnalysis?.fakeConsensusRisk) {
    risks.push(ar
      ? "خطر الازدحام: الإجماع المرتفع مع تعارضات جوهرية = نقطة ضعف في الموقف عند ظهور بيانات معاكسة."
      : "Crowding risk: high consensus with material conflicts = vulnerability when contradicting data emerges.");
  }

  return risks.slice(0, 5);
}

function buildDominantLogic(
  reply: GenesisReply,
  allocatorDecision: AllocatorDecision | null,
  conflictAnalysis: ConflictAnalysis | null,
  lang: "ar" | "en",
): string {
  const ar = lang === "ar";

  // Conflict winner if exists
  if (conflictAnalysis?.dominantConflict?.resolutionLogic) {
    return conflictAnalysis.dominantConflict.resolutionLogic.slice(0, 120);
  }

  // Allocator primary logic
  if (allocatorDecision?.primaryLogic) return allocatorDecision.primaryLogic;

  // Arbitration reason from reply
  if (reply.arbitrationReason) return reply.arbitrationReason;

  // Dominant case justification
  if (reply.dominantCaseJustification) return reply.dominantCaseJustification;

  return ar
    ? "منطق حاسم: الموازنة بين دعم النظام الكلي وقيود السياسة النقدية يُحدد الاتجاه النهائي."
    : "Deciding logic: balance between macro regime support and monetary policy constraints determines the final direction.";
}

function buildThesisChangeConditions(
  reply: GenesisReply,
  thesisEvolution: ThesisEvolutionState | null,
  lang: "ar" | "en",
): string[] {
  const conditions: string[] = [];

  if (reply.thesisChanger) conditions.push(reply.thesisChanger);
  if (reply.invalidation) conditions.push(reply.invalidation);

  if (thesisEvolution) {
    if (thesisEvolution.invalidationTriggers.length > 0 && !conditions.includes(thesisEvolution.invalidationTriggers[0])) {
      conditions.push(thesisEvolution.invalidationTriggers[0]);
    }
    if (thesisEvolution.revisionTriggers.length > 0) {
      conditions.push(thesisEvolution.revisionTriggers[0]);
    }
  }

  return conditions.slice(0, 4);
}

// ─── Repair directive builder ─────────────────────────────────────────────────

function buildRepairDirectives(
  dimensions: JudgmentDimension[],
  grade: JudgmentGrade,
  lang: "ar" | "en",
): string[] {
  const ar = lang === "ar";
  const directives: string[] = [];

  for (const dim of dimensions) {
    if (dim.score < 50 && dim.gaps.length > 0) {
      const label = {
        thesisClarity:    ar ? "وضوح الأطروحة" : "Thesis clarity",
        convictionLogic:  ar ? "منطق القناعة" : "Conviction logic",
        conflictHandling: ar ? "معالجة التعارضات" : "Conflict handling",
        allocatorRealism: ar ? "واقعية المخصص" : "Allocator realism",
        evidenceWeighting:ar ? "وزن الأدلة" : "Evidence weighting",
      }[dim.name] ?? dim.name;

      directives.push(`${label} (${dim.score}/100): ${dim.gaps[0]}`);
    }
  }

  if (grade === "weak" || grade === "insufficient") {
    directives.push(ar
      ? "⚠ الإجابة تحتاج إلى موقف اتجاهي واضح — الحياد العام لا يُعدّ تحليلاً مؤسسياً لأسئلة الاستثمار الجدية."
      : "⚠ Answer requires a clear directional stance — generic neutrality is not institutional analysis for serious investment questions.");
  }

  return directives.slice(0, 4);
}

// ─── Judgment context builder ─────────────────────────────────────────────────

function buildJudgmentContext(judgment: InstitutionalJudgment, lang: "ar" | "en"): string {
  const ar = lang === "ar";

  const grade_label: Record<JudgmentGrade, string> = {
    institutional: ar ? "مؤسسي" : "institutional",
    strong:        ar ? "قوي" : "strong",
    acceptable:    ar ? "مقبول" : "acceptable",
    weak:          ar ? "ضعيف" : "weak",
    insufficient:  ar ? "غير كافٍ" : "insufficient",
  };

  return ar
    ? `[حكم الاستثمار المؤسسي — ${grade_label[judgment.judgmentGrade]} (${judgment.judgmentScore}/100)]
الموقف: ${judgment.institutionalStance.slice(0, 120)}
القناعة: ${judgment.confidenceExplanation.slice(0, 100)}
المنطق الحاسم: ${judgment.dominantLogic.slice(0, 100)}
التعارضات: ${judgment.evidenceConflictSummary.slice(0, 100)}
${judgment.repairDirectives.length > 0 ? `⚠ إصلاح مطلوب: ${judgment.repairDirectives[0]}` : ""}`
    : `[Institutional investment judgment — ${grade_label[judgment.judgmentGrade]} (${judgment.judgmentScore}/100)]
Stance: ${judgment.institutionalStance.slice(0, 120)}
Conviction: ${judgment.confidenceExplanation.slice(0, 100)}
Deciding logic: ${judgment.dominantLogic.slice(0, 100)}
Conflicts: ${judgment.evidenceConflictSummary.slice(0, 100)}
${judgment.repairDirectives.length > 0 ? `⚠ Repair needed: ${judgment.repairDirectives[0]}` : ""}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Synthesises all 83A+83B engine outputs into a final institutional judgment.
 * Mandatory gate for serious investment questions.
 * Pure O(1) — no AI calls, no network.
 */
export function synthesiseInstitutionalJudgment(
  reply: GenesisReply,
  thesisEvolution: ThesisEvolutionState | null,
  allocatorDecision: AllocatorDecision | null,
  conflictAnalysis: ConflictAnalysis | null,
  depthAudit: DepthRulesAudit | null,
  isInvestment: boolean,
  isSaudi: boolean,
  lang: "ar" | "en",
): InstitutionalJudgment {
  if (!isInvestment) {
    return {
      institutionalStance: "",
      confidenceExplanation: "",
      keyRisks: [],
      dominantLogic: "",
      thesisChangeConditions: [],
      evidenceConflictSummary: "",
      judgmentScore: 100,
      judgmentGrade: "institutional",
      dimensions: [],
      repairDirectives: [],
      judgmentContext: "",
    };
  }

  const dimensions: JudgmentDimension[] = [
    scoreThesisClarity(reply, thesisEvolution),
    scoreConvictionLogic(reply, allocatorDecision),
    scoreConflictHandling(reply, conflictAnalysis),
    scoreAllocatorRealism(reply, allocatorDecision),
    scoreEvidenceWeighting(reply, depthAudit),
  ];

  const judgmentScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * d.weight, 0),
  );

  const judgmentGrade = deriveGrade(judgmentScore);

  const institutionalStance = buildInstitutionalStance(reply, allocatorDecision, thesisEvolution, isSaudi, lang);
  const confidenceExplanation = buildConfidenceExplanation(reply, thesisEvolution, lang);
  const keyRisks = buildKeyRisks(reply, conflictAnalysis, isSaudi, lang);
  const dominantLogic = buildDominantLogic(reply, allocatorDecision, conflictAnalysis, lang);
  const thesisChangeConditions = buildThesisChangeConditions(reply, thesisEvolution, lang);
  const evidenceConflictSummary = conflictAnalysis?.resolutionSummary ?? (lang === "ar" ? "لا تعارضات كبرى." : "No major conflicts.");
  const repairDirectives = buildRepairDirectives(dimensions, judgmentGrade, lang);

  const judgment: InstitutionalJudgment = {
    institutionalStance,
    confidenceExplanation,
    keyRisks,
    dominantLogic,
    thesisChangeConditions,
    evidenceConflictSummary,
    judgmentScore,
    judgmentGrade,
    dimensions,
    repairDirectives,
    judgmentContext: "",
  };

  judgment.judgmentContext = buildJudgmentContext(judgment, lang);
  return judgment;
}

/**
 * Applies targeted repair to the reply based on the judgment grade.
 * Called when judgmentGrade is "weak" or "insufficient".
 * Never overwrites non-empty fields.
 */
export function repairWithJudgment(
  reply: GenesisReply,
  judgment: InstitutionalJudgment,
  allocatorDecision: AllocatorDecision | null,
  lang: "ar" | "en",
): void {
  // Apply institutional stance to committeeSynthesis if empty
  if (!reply.committeeSynthesis?.finalStance && judgment.institutionalStance) {
    if (!reply.committeeSynthesis) {
      reply.committeeSynthesis = {
        finalStance: judgment.institutionalStance,
        dominantVoice: "allocator",
      };
    } else {
      reply.committeeSynthesis.finalStance = judgment.institutionalStance;
    }
  }

  // Apply confidence explanation
  if (!reply.confidenceCalibration && judgment.confidenceExplanation) {
    reply.confidenceCalibration = judgment.confidenceExplanation;
  }

  // Apply dominant logic as arbitration reason
  if (!reply.arbitrationReason && judgment.dominantLogic) {
    reply.arbitrationReason = judgment.dominantLogic;
  }

  // Apply thesis change conditions
  if (!reply.thesisChanger && judgment.thesisChangeConditions.length > 0) {
    reply.thesisChanger = judgment.thesisChangeConditions[0];
  }
  if (!reply.invalidation && judgment.thesisChangeConditions.length > 1) {
    reply.invalidation = judgment.thesisChangeConditions[1];
  }

  // Ensure risks are populated
  if ((!reply.risks || reply.risks.length < 2) && judgment.keyRisks.length > 0) {
    reply.risks = [...(reply.risks ?? []), ...judgment.keyRisks.slice(0, 3 - (reply.risks?.length ?? 0))];
  }

  // Apply allocator decision to committee stance
  if (!reply.committeeStance && allocatorDecision) {
    const stanceMap: Record<string, import("@/services/institutional/committeeDebate").CommitteeStance> = {
      scale_in_gradual:        "conditional_opportunity",
      scale_in_opportunistic:  "conditional_opportunity",
      hold_and_monitor:        "wait_for_confirmation",
      wait_confirmation:       "wait_for_confirmation",
      reduce_selective:        "defensive",
      avoid_or_reduce:         "defensive",
    };
    reply.committeeStance = stanceMap[allocatorDecision.stance] ?? "wait_for_confirmation";
  }
}
