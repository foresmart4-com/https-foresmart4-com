// Phase-66: Reasoning Depth Calibration
// Pure deterministic functions — no AI calls, no network, O(1).
// Distinguishes label-driven (shallow) from causal (institutional) reasoning
// and produces enrichment directives and context strings for Genesis.
//
// Label-driven (shallow): "Banks are bullish because rates rose" — no mechanism.
// Causal (institutional): "Rising rates → SAMA shadows Fed → local liquidity tightens
//   → NIM expansion offset by deposit cost pressure → net effect = curve-shape dependent."
//
// Outputs consumed by:
//   - runFusion post-fill (fills reply.reasoningDepth etc.)
//   - Deep retry directive injected on next query when shallow
//   - UI badge showing reasoning depth

import type { GenesisReply } from "@/lib/genesis.functions";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ReasoningDepth =
  | "institutional"  // full causal chains, evidence weighting, conflict handling
  | "moderate"       // directional view present with partial causal support
  | "shallow"        // label-driven; transmission mechanisms absent
  | "insufficient";  // heuristic or no analyzable structure

export type ThesisStrength =
  | "strong"     // thesis + evidence + catalysts + invalidation all aligned
  | "supported"  // thesis present with evidence; minor gaps
  | "fragile"    // thesis present; evidence thin or invalidation missing
  | "absent";    // no directional thesis

export interface ReasoningCalibrationResult {
  reasoningDepth: ReasoningDepth;
  evidenceStrength: number;         // 0-100 composite evidence quality score
  causalChain: string;              // strongest causal chain found, or absence note
  thesisStrength: ThesisStrength;
  evidenceConflict: string | null;  // internal tension in evidence/cases, or null
  confidenceExplanation: string;    // 1 sentence: earned vs asserted confidence
  depthRetryDirective: string;      // injected into next prompt when shallow; empty otherwise
  contextString: string;            // compact ≤100 chars for Genesis context injection
}

// ─── Causal language detection ────────────────────────────────────────────────

// Words/patterns that indicate causal reasoning with transmission mechanisms.
const CAUSAL_PATTERNS = [
  /→/g,
  /\bleads? to\b/gi,
  /\btransmit/gi,
  /\bchannel\b/gi,
  /\bmechanism\b/gi,
  /\bresulting in\b/gi,
  /\bdrives?\b.*\b(to|toward|up|down)\b/gi,
  /\bbecause\b.*\b(the|of|it)\b/gi,
  /\bif\b.{1,40}\bthen\b/gi,
  /\bwhen\b.{1,40}\b(rises?|falls?|widens?|tightens?|expands?|contracts?)\b/gi,
  /\bimplies?\b/gi,
  /\bpass(?:es)? through\b/gi,
  /\btherefore\b/gi,
  /\bconsequently\b/gi,
  /\bfiscal.{0,20}(space|impact|channel|drag|surplus|deficit)/gi,
  /\bliquidity.{0,20}(tighten|loosen|drain|inject|pressure)/gi,
  /\bcredit.{0,20}(spread|stress|tighten|widen|condit)/gi,
];

// Generic filler phrases that indicate shallow label-only reasoning.
const GENERIC_FILLER = [
  /\bmonitor (the )?market\b/gi,
  /\bsignificant uncertainty\b/gi,
  /\bexciting opportunity\b/gi,
  /\bimportant to note\b/gi,
  /\binvestors should watch\b/gi,
  /\bmomentum suggests\b/gi,
  /\bgenerally (bullish|bearish)\b/gi,
  /\boverall (positive|negative|mixed)\b/gi,
  /\bmarket conditions?\b.{0,20}\bremain\b/gi,
  /\bvolatility (remains?|is) (elevated|high|low)\b/gi,
];

function countCausalHits(text: string): number {
  let hits = 0;
  for (const pat of CAUSAL_PATTERNS) {
    const match = text.match(pat);
    if (match) hits += match.length;
  }
  return hits;
}

function countFillerHits(text: string): number {
  let hits = 0;
  for (const pat of GENERIC_FILLER) {
    if (pat.test(text)) hits++;
  }
  return hits;
}

// ─── Evidence strength scoring ────────────────────────────────────────────────

function scoreEvidenceStrength(reply: GenesisReply): number {
  let score = 0;

  // Structural field presence
  const evidence = reply.evidence ?? [];
  score += Math.min(evidence.length, 4) * 12;   // up to 48 pts for evidence items
  if (reply.thesis) score += 8;
  if (reply.invalidation) score += 8;
  if (reply.catalysts?.length) score += Math.min(reply.catalysts.length, 3) * 5;
  if (reply.confidenceDrivers?.length) score += 5;
  if (reply.opposingCase) score += 6;

  // Phase 63-65 causal structure (macro chain, cases)
  if (reply.macroChain) score += 12;
  if (reply.bullCase) score += 6;
  if (reply.bearCase) score += 6;
  if (reply.baseCase) score += 4;

  // Causal density in key text fields
  const richText = [reply.outlook, reply.macroChain, reply.bullCase, reply.bearCase, reply.reasoning]
    .filter(Boolean).join(" ");
  const causalHits = countCausalHits(richText);
  score += Math.min(causalHits * 3, 18);         // up to 18 pts for causal language

  // Generic filler penalty
  const fillerHits = countFillerHits(richText);
  score -= fillerHits * 6;

  // High confidence without evidence — asserted conviction penalty
  if (reply.confidence >= 65 && evidence.length === 0 && !reply.macroChain) score -= 15;
  if (reply.confidence >= 80 && evidence.length < 2) score -= 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Causal chain extraction ──────────────────────────────────────────────────
// Finds the single most causal sentence in the reply and returns it as a
// representative chain. Falls back to a diagnostic absence note.

function extractCausalChain(reply: GenesisReply, lang: "ar" | "en"): string {
  const candidates = [reply.macroChain, reply.reasoning, reply.bullCase, reply.outlook]
    .filter((t): t is string => !!t);

  let bestCandidate = "";
  let bestScore = 0;

  for (const text of candidates) {
    // Score each sentence
    const sentences = text.split(/[.؟!]\s+/);
    for (const s of sentences) {
      const c = countCausalHits(s);
      if (c > bestScore) { bestScore = c; bestCandidate = s.trim(); }
    }
  }

  if (bestScore >= 2 && bestCandidate.length > 20) {
    return bestCandidate.slice(0, 300);
  }

  return lang === "ar"
    ? "لا توجد سلسلة سببية واضحة — التحليل يعتمد على تسميات النظام بدلاً من آليات الانتقال."
    : "No explicit causal chain detected — analysis relies on regime labels rather than transmission mechanisms.";
}

// ─── Thesis strength ──────────────────────────────────────────────────────────

function scoreThesisStrength(reply: GenesisReply): ThesisStrength {
  if (!reply.thesis) return "absent";

  const evidence = reply.evidence ?? [];
  const hasEvidence = evidence.length >= 2;
  const hasCatalysts = (reply.catalysts?.length ?? 0) >= 1;
  const hasInvalidation = !!reply.invalidation;
  const consensusOk = reply.consensusStrength === "strong" || reply.consensusStrength === "moderate";

  if (hasEvidence && hasCatalysts && hasInvalidation && consensusOk) return "strong";
  if ((hasEvidence || reply.macroChain) && (hasInvalidation || hasCatalysts)) return "supported";
  if (reply.thesis && (hasEvidence || reply.baseCase)) return "fragile";
  return "fragile";
}

// ─── Evidence conflict detection ──────────────────────────────────────────────

function detectEvidenceConflict(reply: GenesisReply, lang: "ar" | "en"): string | null {
  const conflicts: string[] = [];

  // Disagreement map present — explicit cross-track tension
  if (reply.disagreementMap?.length) {
    conflicts.push(reply.disagreementMap[0]);
  }

  // Bull and bear cases both present — check if they point the same direction
  if (reply.bullCase && reply.bearCase) {
    const bullBullish = /bull|صاعد|upside|rise|support/.test(reply.bullCase.toLowerCase());
    const bearBullish = /bull|صاعد|upside|rise|support/.test(reply.bearCase.toLowerCase());
    if (bullBullish === bearBullish) {
      conflicts.push(lang === "ar"
        ? "الحالتان الصاعدة والهابطة تشيران إلى نفس الاتجاه — النقاش غير متوازن."
        : "Bull and bear cases point the same direction — debate is unbalanced.");
    }
  }

  // Opposing case but strong consensus — internal tension
  if (reply.opposingCase && reply.consensusStrength === "strong") {
    conflicts.push(lang === "ar"
      ? "حالة مضادة مع إجماع قوي — الخلاف الضمني مُعترف به لكن مُقيَّد."
      : "Opposing case present despite strong consensus — implicit disagreement is acknowledged but constrained.");
  }

  // Thesis conflicts with regime
  if (reply.thesis && reply.regime) {
    const thesisText = reply.thesis.toLowerCase();
    const regimeText = reply.regime.toLowerCase();
    const bullThesis = /bull|upside|rise|صاعد/.test(thesisText);
    const bearRegime = /bear|risk.?off|ranging/.test(regimeText);
    if (bullThesis && bearRegime) {
      conflicts.push(lang === "ar"
        ? "الأطروحة صاعدة والنظام دفاعي — توتر هيكلي قائم."
        : "Thesis is bullish in a bear/risk-off regime — structural tension.");
    }
  }

  if (!conflicts.length) return null;
  return conflicts.slice(0, 2).join("; ");
}

// ─── Confidence explanation ───────────────────────────────────────────────────

function buildConfidenceExplanation(
  reply: GenesisReply,
  evidenceStrength: number,
  thesisStrength: ThesisStrength,
  lang: "ar" | "en",
): string {
  const c = reply.confidence;
  const hasAnchor = !!reply.confidenceCalibration;
  const evidenceGap = c >= 65 && evidenceStrength < 40;
  const evidenceAligned = c >= 50 && evidenceStrength >= 60;
  const conservative = c <= 50 && thesisStrength === "supported";

  if (evidenceGap) {
    return lang === "ar"
      ? `الثقة (${c}%) تبدو مُدَّعاة أكثر من كونها مكتسبة — قوة الأدلة (${evidenceStrength}/100) دون مستوى الثقة المُعلَن.`
      : `Confidence (${c}%) appears asserted rather than earned — evidence strength (${evidenceStrength}/100) is below the stated conviction level.`;
  }
  if (evidenceAligned) {
    return lang === "ar"
      ? `الثقة (${c}%) مدعومة بقوة أدلة (${evidenceStrength}/100) — المعايرة معقولة${hasAnchor ? " وتعكس السياق المتاح" : ""}.`
      : `Confidence (${c}%) is supported by evidence strength (${evidenceStrength}/100) — calibration is reasonable${hasAnchor ? " and reflects available context" : ""}.`;
  }
  if (conservative) {
    return lang === "ar"
      ? `الثقة (${c}%) محافظة نسبياً مقارنةً بقوة الأطروحة — قد تعكس ضغط معايرة أو أدلة مفقودة.`
      : `Confidence (${c}%) is conservative relative to thesis strength — may reflect calibration pressure or missing evidence.`;
  }
  return lang === "ar"
    ? `الثقة (${c}%) تعكس توازن الأدلة المتاحة; لا يُدَّعى أي يقين.`
    : `Confidence (${c}%) reflects the balance of available evidence; no certainty is asserted.`;
}

// ─── Reasoning depth derivation ───────────────────────────────────────────────

function deriveReasoningDepth(
  reply: GenesisReply,
  evidenceStrength: number,
  causalChain: string,
  thesisStrength: ThesisStrength,
): ReasoningDepth {
  // Heuristic or structurally empty
  if (!reply.thesis && !reply.macroChain && !reply.outlook) return "insufficient";
  if (reply.confidence === 38 && !reply.regime) return "insufficient"; // heuristic reply signature

  const hasCausalChain = !causalChain.includes("No explicit causal chain") && !causalChain.includes("لا توجد سلسلة سببية");
  const hasFullStructure =
    !!reply.macroChain && !!reply.bullCase && !!reply.bearCase && !!reply.baseCase;

  // Institutional: full causal structure + strong evidence + opposing case handled
  if (
    evidenceStrength >= 62 &&
    hasCausalChain &&
    thesisStrength !== "absent" &&
    (hasFullStructure || (!!reply.thesis && !!reply.invalidation && !!reply.opposingCase))
  ) {
    return "institutional";
  }

  // Moderate: directional view with partial causal support
  if (
    evidenceStrength >= 35 &&
    (hasCausalChain || !!reply.macroChain || !!reply.thesis) &&
    thesisStrength !== "absent"
  ) {
    return "moderate";
  }

  // Shallow: label-driven labels without causal transmission
  return "shallow";
}

// ─── Deep retry directive ─────────────────────────────────────────────────────
// Injected into the NEXT query context when depth is shallow.
// Compact enough to fit inside the 2800-char context budget.

function buildDepthRetryDirective(
  depth: ReasoningDepth,
  thesisStrength: ThesisStrength,
  evidenceConflict: string | null,
  lang: "ar" | "en",
): string {
  if (depth !== "shallow") return "";

  if (lang === "ar") {
    const lines = [
      "ملاحظة جودة الاستدلال: الرد السابق كان قائماً على التسميات لا السببية.",
      "المطلوب في الرد الحالي:",
      "- سلاسل سببية صريحة بآليات انتقال (استخدم → أو 'يُفضي إلى' أو 'مما يعني').",
      "- ترجيح الأدلة: أيّ عامل هو الأقوى وزناً ولماذا؟",
    ];
    if (thesisStrength === "fragile" || thesisStrength === "absent") {
      lines.push("- تفسير قوة الأطروحة: لماذا هذا الرأي يتفوق على الحالة المضادة؟");
    }
    if (evidenceConflict) {
      lines.push(`- معالجة التعارض: ${evidenceConflict.slice(0, 80)}`);
    }
    lines.push("- تسميات النظام وحدها (صاعد/هابط/محايد) دون آلية انتقال = غير مقبول.");
    return lines.join(" ");
  }

  const lines = [
    "Reasoning quality note: prior response was label-driven, not causal.",
    "Required in this response:",
    "- Explicit cause-effect chains with transmission mechanisms (use → or 'leads to' or 'which means').",
    "- Evidence weighting: which factor is primary and why does it outweigh the others?",
  ];
  if (thesisStrength === "fragile" || thesisStrength === "absent") {
    lines.push("- Thesis strength explanation: why this view over the counter-case?");
  }
  if (evidenceConflict) {
    lines.push(`- Conflict handling required: ${evidenceConflict.slice(0, 80)}`);
  }
  lines.push("- Regime labels alone (bullish/bearish/neutral) without a transmission mechanism are not sufficient.");
  return lines.join(" ");
}

// ─── Context string ───────────────────────────────────────────────────────────

function buildContextString(
  depth: ReasoningDepth,
  evidenceStrength: number,
  thesisStrength: ThesisStrength,
): string {
  const label = `Reasoning depth: ${depth} | evidence: ${evidenceStrength}/100 | thesis: ${thesisStrength}`;
  return label.slice(0, 100);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function calibrateReasoning(
  reply: GenesisReply,
  lang: "ar" | "en" = "en",
): ReasoningCalibrationResult {
  const evidenceStrength = scoreEvidenceStrength(reply);
  const causalChain = extractCausalChain(reply, lang);
  const thesisStrength = scoreThesisStrength(reply);
  const evidenceConflict = detectEvidenceConflict(reply, lang);
  const confidenceExplanation = buildConfidenceExplanation(reply, evidenceStrength, thesisStrength, lang);
  const reasoningDepth = deriveReasoningDepth(reply, evidenceStrength, causalChain, thesisStrength);
  const depthRetryDirective = buildDepthRetryDirective(reasoningDepth, thesisStrength, evidenceConflict, lang);
  const contextString = buildContextString(reasoningDepth, evidenceStrength, thesisStrength);

  return {
    reasoningDepth,
    evidenceStrength,
    causalChain,
    thesisStrength,
    evidenceConflict,
    confidenceExplanation,
    depthRetryDirective,
    contextString,
  };
}

// ─── Deterministic reply enrichment for shallow depth ─────────────────────────
// Supplements a shallow reply with missing causal structure derived from
// what text is already present. Never overwrites AI-produced content.

export function enrichShallowReasoning(
  reply: GenesisReply,
  calibration: ReasoningCalibrationResult,
  lang: "ar" | "en",
): void {
  if (calibration.reasoningDepth !== "shallow") return;

  // If no causal chain was found but macroChain is present, surface it as causalChain
  // (stored in the reply's reasoning field if empty)
  if (!reply.reasoning && reply.macroChain) {
    // Extract the most causal sentence from macroChain as the reasoning field
    const sentences = reply.macroChain.split(/[.؟]\s+/);
    const best = sentences.reduce((a, b) =>
      countCausalHits(a) >= countCausalHits(b) ? a : b, sentences[0] ?? "");
    if (best && best.length > 20) {
      reply.reasoning = best.trim().slice(0, 250);
    }
  }

  // If thesis is present but no reasoning: synthesize from available evidence
  if (reply.thesis && !reply.reasoning && reply.evidence?.length) {
    reply.reasoning = lang === "ar"
      ? `الأطروحة مدعومة بـ: ${reply.evidence.slice(0, 2).join("؛ ")}. ${reply.invalidation ? `شرط الإلغاء: ${reply.invalidation.slice(0, 100)}` : ""}`
      : `Thesis supported by: ${reply.evidence.slice(0, 2).join("; ")}. ${reply.invalidation ? `Invalidation: ${reply.invalidation.slice(0, 100)}` : ""}`;
  }

  // If baseCase is missing and thesis + consensus exist: derive it
  if (!reply.baseCase && reply.thesis) {
    reply.baseCase = lang === "ar"
      ? `الحالة الأساسية: الأطروحة الحالية (${reply.thesis.slice(0, 80)}) هي الموقف المرجّح بناءً على الأدلة المتاحة — غير مؤكد.`
      : `Base case: the current thesis (${reply.thesis.slice(0, 80)}) is the favoured position from available evidence — not confirmed.`;
  }

  // Surface the retry directive as a caveat if caveats array exists or is empty
  if (calibration.depthRetryDirective && (!reply.caveats || reply.caveats.length === 0)) {
    reply.caveats = [lang === "ar"
      ? "التحليل اعتمد على تسميات النظام بشكل رئيسي — السلاسل السببية محدودة في هذا الرد."
      : "Analysis relied primarily on regime labels — causal transmission chains are limited in this response."];
  }
}
