// Phase-82A: Committee Generation Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Replaces single-narrator reasoning compression with structured multi-voice
// institutional committee generation. Five independent reasoning voices produce
// substantive views, then a committee synthesis resolves agreement, disagreement,
// dominant voice, and final stance.
//
// Voices:
//   Macro Voice       — growth, inflation, liquidity, credit, regime
//   Policy Voice      — CB rates, Fed linkage, fiscal, SAMA/SAR peg
//   Allocator Voice   — preservation, opportunity cost, deployment, downside
//   Behavioral Voice  — positioning, sentiment, crowding, narrative risk
//   Historical Voice  — analog regimes, prior cycles (optional, when active)
//
// Design:
//   Single bounded AI call — voices are enforced through structured prompt
//   injection, not separate AI calls. Bounded to ~350-450 additional tokens.
//   Deterministic repair if AI omits fields.

import type { MultiPerspectiveResult, LensView } from "@/services/research/multiPerspectiveReasoning";
import type { FrameworkSynthesisResult } from "@/services/research/frameworkSynthesis";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface VoiceReasoning {
  macro?: string;      // 2-3 sentences: Macro Voice — growth/inflation/liquidity/regime
  policy?: string;     // 2-3 sentences: Policy Voice — CB/rates/fiscal/SAMA
  allocator?: string;  // 2-3 sentences: Allocator Voice — preservation/cost/deployment
  behavioral?: string; // 2-3 sentences: Behavioral Voice — sentiment/crowding/narrative
  historical?: string; // 2-3 sentences: Historical Voice — analog regimes (when active)
}

export interface CommitteeSynthesis {
  agreement?: string;    // 1 sentence: where voices converge directionally
  disagreement?: string; // 1 sentence: the primary tension between voices
  dominantVoice?: "macro" | "policy" | "allocator" | "behavioral" | "historical" | "mixed";
  finalStance?: string;  // 1-2 sentences: committee's resolved position after debate
}

// ─── Lens → voice mapping ──────────────────────────────────────────────────────

function lensToVoiceTag(lens: LensView["lens"]): keyof VoiceReasoning {
  switch (lens) {
    case "macro_economist":       return "macro";
    case "central_bank_policy":   return "policy";
    case "institutional_allocator": return "allocator";
    case "behavioral_market":     return "behavioral";
    case "historical_analog":     return "historical";
  }
}

function voiceDescription(lens: LensView["lens"]): string {
  switch (lens) {
    case "macro_economist":
      return "Macro Voice [focus: growth, inflation, liquidity, credit cycle, regime identification]";
    case "central_bank_policy":
      return "Policy Voice [focus: CB rates, Fed linkage, fiscal policy, SAMA/SAR peg, transmission]";
    case "institutional_allocator":
      return "Allocator Voice [focus: capital preservation, opportunity cost, deployment timing, downside control]";
    case "behavioral_market":
      return "Behavioral Voice [focus: crowd positioning, sentiment extremes, crowding risk, narrative dynamics]";
    case "historical_analog":
      return "Historical Voice [focus: analog regimes, prior cycles, historical comparison, structural limits]";
  }
}

// ─── Directive builder ─────────────────────────────────────────────────────────

/**
 * buildCommitteeGenerationDirective — builds the prompt directive that instructs
 * the AI to produce structured committee voices instead of a single narrator.
 *
 * Active lenses provide seed observations; the AI is instructed to expand each
 * into a substantive 2-3 sentence voice with independent reasoning.
 * Inactive lenses are omitted to stay token-efficient.
 */
export function buildCommitteeGenerationDirective(
  multiPerspective: MultiPerspectiveResult,
  frameworkSynth: FrameworkSynthesisResult,
  lang: "ar" | "en",
): string {
  const activeLenses = multiPerspective.lensViews.filter(l => l.active);
  const dominantLens = multiPerspective.dominantLens;
  const dominantVoiceTag = dominantLens
    ? lensToVoiceTag(dominantLens.lens)
    : "mixed";

  if (activeLenses.length === 0) return "";

  if (lang === "ar") {
    return buildArabicDirective(activeLenses, dominantVoiceTag, multiPerspective, frameworkSynth);
  }
  return buildEnglishDirective(activeLenses, dominantVoiceTag, multiPerspective, frameworkSynth);
}

function buildEnglishDirective(
  activeLenses: LensView[],
  dominantVoiceTag: string,
  multiPerspective: MultiPerspectiveResult,
  frameworkSynth: FrameworkSynthesisResult,
): string {
  const voiceInstructions = activeLenses.map(l => {
    const tag = lensToVoiceTag(l.lens).toUpperCase();
    const desc = voiceDescription(l.lens);
    const seed = l.view.slice(0, 80);
    const concern = l.concern ? ` | Primary concern: ${l.concern.slice(0, 55)}` : "";
    return `  "${lensToVoiceTag(l.lens)}": "${desc}: [Seed: ${seed}${concern}] — expand to 2-3 sentences of independent reasoning from THIS voice's perspective only. Do NOT summarize other voices. State what this voice observes, its concern, and directional implication."`;
  }).join(",\n");

  const synthInstructions = [
    `  "agreement": "1 sentence: where the active voices CONVERGE directionally"`,
    `  "disagreement": "1 sentence: the PRIMARY tension or conflict between voices — which voice contradicts which and why"`,
    `  "dominantVoice": "${dominantVoiceTag}"`,
    `  "finalStance": "1-2 sentences: committee's resolved position after hearing all voices — acknowledge the dissent but state which reasoning wins and WHY"`,
  ].join(",\n");

  const perspectiveState = multiPerspective.perspectiveState;
  const conflictLine = multiPerspective.disagreementNote
    ? `Detected conflict: ${multiPerspective.disagreementNote}`
    : "No direct lens conflict detected";

  const frameworkLine = frameworkSynth.dominantFramework
    ? `Framework anchor: ${frameworkSynth.dominantFramework.name} [${frameworkSynth.synthesisState}]`
    : "No dominant framework resolved";

  return `[COMMITTEE GENERATION ENGINE — MANDATORY STRUCTURED OUTPUT]
Perspective state: ${perspectiveState} | ${conflictLine}
${frameworkLine}

INSTRUCTION: Do NOT compress reasoning into a single narrator. Generate INDEPENDENT voices.
Each voice reasons from its own lens only — macro thinks as a macro economist, allocator as a portfolio risk manager, etc.
The committee synthesis must name WHERE voices disagree, not just where they agree.

Set "voiceReasoning" object with active voice fields:
{
${voiceInstructions}
}

Set "committeeSynthesis" object:
{
${synthInstructions}
}

GOVERNANCE: Each voice: 2-3 sentences max. No generic summaries. No "it is important to note". Every sentence must make a specific claim tied to the voice's analytical focus. If the Allocator Voice conflicts with the Macro Voice, name the conflict explicitly in committeeSynthesis.disagreement.`;
}

function buildArabicDirective(
  activeLenses: LensView[],
  dominantVoiceTag: string,
  multiPerspective: MultiPerspectiveResult,
  frameworkSynth: FrameworkSynthesisResult,
): string {
  const voiceLabels: Record<keyof VoiceReasoning, string> = {
    macro:      "صوت الماكرو [التركيز: النمو، التضخم، السيولة، دورة الائتمان، تصنيف النظام]",
    policy:     "صوت السياسة [التركيز: أسعار البنك المركزي، ربط الفيدرالي، السياسة المالية، SAMA/ربط الريال]",
    allocator:  "صوت المخصص [التركيز: الحفاظ على رأس المال، تكلفة الفرصة، توقيت النشر، ضبط المخاطر الهبوطية]",
    behavioral: "صوت السلوكي [التركيز: تمركز الحشد، تطرف المشاعر، مخاطر التكتل، ديناميكيات السردية]",
    historical: "صوت التاريخي [التركيز: الأنظمة المشابهة، الدورات السابقة، المقارنة التاريخية، حدود التشابه]",
  };

  const voiceInstructions = activeLenses.map(l => {
    const key = lensToVoiceTag(l.lens);
    const label = voiceLabels[key];
    const seed = l.view.slice(0, 80);
    const concern = l.concern ? ` | المخاوف الرئيسية: ${l.concern.slice(0, 55)}` : "";
    return `  "${key}": "${label}: [البذرة: ${seed}${concern}] — وسّع إلى 2-3 جمل من منظور هذا الصوت فقط. لا تلخّص الأصوات الأخرى. اذكر ما يرصده هذا الصوت ومخاوفه والتضمين الاتجاهي."`;
  }).join(",\n");

  const synthInstructions = [
    `  "agreement": "جملة واحدة: أين تتقاطع الأصوات النشطة اتجاهياً"`,
    `  "disagreement": "جملة واحدة: التوتر أو التعارض الأساسي بين الأصوات — أي صوت يتعارض مع أي صوت ولماذا"`,
    `  "dominantVoice": "${dominantVoiceTag}"`,
    `  "finalStance": "1-2 جملة: موقف اللجنة المُحسوم بعد سماع جميع الأصوات — اعترف بالمعارضة لكن اذكر أي الاستدلالات يفوز ولماذا"`,
  ].join(",\n");

  const perspectiveState = multiPerspective.perspectiveState;
  const conflictLine = multiPerspective.disagreementNote
    ? `التعارض المرصود: ${multiPerspective.disagreementNote}`
    : "لا تعارض مباشر بين العدسات";

  const frameworkLine = frameworkSynth.dominantFramework
    ? `مرساة الإطار: ${frameworkSynth.dominantFramework.name} [${frameworkSynth.synthesisState}]`
    : "لم يُحسم إطار مهيمن";

  return `[محرك توليد اللجنة — مخرجات هيكلية إلزامية]
حالة المنظور: ${perspectiveState} | ${conflictLine}
${frameworkLine}

التعليمات: لا تضغط الاستدلال في راوٍ واحد. أنتج أصواتاً مستقلة.
كل صوت يستدل من عدسته الخاصة فقط — الماكرو يفكر كاقتصادي كلي، المخصص كمدير مخاطر محفظة، إلخ.
يجب أن يُسمّي توليف اللجنة أين تختلف الأصوات، لا أين تتفق فقط.

اضبط كائن "voiceReasoning" بحقول الأصوات النشطة:
{
${voiceInstructions}
}

اضبط كائن "committeeSynthesis":
{
${synthInstructions}
}

الحوكمة: كل صوت: 2-3 جمل كحد أقصى. لا ملخصات عامة. لا "من المهم الإشارة". كل جملة يجب أن تُدلي بادعاء محدد مرتبط بتركيز هذا الصوت التحليلي. إذا تعارض صوت المخصص مع صوت الماكرو، سمّ التعارض صراحةً في committeeSynthesis.disagreement.`;
}

// ─── Repair — deterministic fallback if AI omits fields ──────────────────────

export function repairCommitteeVoices(
  voiceReasoning: VoiceReasoning | undefined,
  committeeSynthesis: CommitteeSynthesis | undefined,
  multiPerspective: MultiPerspectiveResult,
  frameworkSynth: FrameworkSynthesisResult,
): { voiceReasoning: VoiceReasoning; committeeSynthesis: CommitteeSynthesis } {
  const activeLenses = multiPerspective.lensViews.filter(l => l.active);
  const repaired: VoiceReasoning = voiceReasoning ? { ...voiceReasoning } : {};

  // Repair each active voice that is missing
  for (const lens of activeLenses) {
    const key = lensToVoiceTag(lens.lens);
    if (!repaired[key]) {
      repaired[key] = buildFallbackVoice(lens, frameworkSynth);
    }
  }

  // Repair committeeSynthesis
  const repairedSynth: CommitteeSynthesis = committeeSynthesis ? { ...committeeSynthesis } : {};

  const dominantLens = multiPerspective.dominantLens;
  const competingLens = multiPerspective.competingLens;

  if (!repairedSynth.dominantVoice) {
    repairedSynth.dominantVoice = dominantLens
      ? lensToVoiceTag(dominantLens.lens)
      : "mixed";
  }

  if (!repairedSynth.agreement) {
    repairedSynth.agreement = multiPerspective.agreementNote.slice(0, 120);
  }

  if (!repairedSynth.disagreement) {
    repairedSynth.disagreement = multiPerspective.disagreementNote
      ? multiPerspective.disagreementNote.slice(0, 120)
      : buildFallbackDisagreement(activeLenses, multiPerspective.perspectiveState);
  }

  if (!repairedSynth.finalStance) {
    repairedSynth.finalStance = buildFallbackStance(
      dominantLens,
      competingLens,
      multiPerspective.perspectiveState,
      frameworkSynth,
    );
  }

  return { voiceReasoning: repaired, committeeSynthesis: repairedSynth };
}

function buildFallbackVoice(lens: LensView, _frameworkSynth: FrameworkSynthesisResult): string {
  const concern = lens.concern ? ` Primary concern: ${lens.concern}.` : "";
  const direction = lens.direction === "neutral" || lens.direction === "uncertain"
    ? "directional signal is inconclusive"
    : `directional signal is ${lens.direction}`;
  return `${lens.view} ${concern} From this lens, the ${direction}.`;
}

function buildFallbackDisagreement(activeLenses: LensView[], state: string): string {
  if (state === "uncertainty_dominant") {
    return "Most active voices flag regime uncertainty; no clear directional consensus.";
  }
  if (state === "mixed") {
    return "Voices emphasize different analytical dimensions; no direct directional contradiction.";
  }
  const pos = activeLenses.filter(l => l.direction === "positive");
  const neg = activeLenses.filter(l => l.direction === "negative");
  if (pos.length > 0 && neg.length > 0) {
    const posNames = pos.slice(0, 2).map(l => lensToVoiceTag(l.lens)).join(" + ");
    const negNames = neg.slice(0, 2).map(l => lensToVoiceTag(l.lens)).join(" + ");
    return `${posNames} view constructive conditions; ${negNames} flag material downside risks — unresolved.`;
  }
  return "Voices do not converge; committee cannot endorse a single directional stance.";
}

function buildFallbackStance(
  dominantLens: LensView | null,
  competingLens: LensView | null,
  perspectiveState: string,
  frameworkSynth: FrameworkSynthesisResult,
): string {
  const fwAnchor = frameworkSynth.dominantFramework
    ? `${frameworkSynth.dominantFramework.name} framework anchors the dominant view.`
    : "";

  if (perspectiveState === "uncertainty_dominant") {
    return `Committee is on hold — regime clarity insufficient for a directional commitment. ${fwAnchor}`.trim();
  }
  if (!dominantLens) {
    return `No single voice dominates; committee stance is mixed pending regime resolution. ${fwAnchor}`.trim();
  }

  const domTag = lensToVoiceTag(dominantLens.lens);
  const domDir = dominantLens.direction;
  const compPart = competingLens
    ? ` Dissent from ${lensToVoiceTag(competingLens.lens)} voice preserved as tail-risk monitor.`
    : "";

  return `${domTag.charAt(0).toUpperCase() + domTag.slice(1)} voice leads with a ${domDir} read.${compPart} ${fwAnchor}`.trim();
}

// ─── Sanitization helpers ─────────────────────────────────────────────────────

const VALID_DOMINANT_VOICE = new Set(["macro","policy","allocator","behavioral","historical","mixed"]);

export function sanitizeVoiceReasoning(obj: unknown): VoiceReasoning | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  const result: VoiceReasoning = {};
  const keys: (keyof VoiceReasoning)[] = ["macro","policy","allocator","behavioral","historical"];
  let hasAny = false;
  for (const k of keys) {
    const v = typeof o[k] === "string" ? (o[k] as string).trim() : undefined;
    if (v) { result[k] = v; hasAny = true; }
  }
  return hasAny ? result : undefined;
}

export function sanitizeCommitteeSynthesis(obj: unknown): CommitteeSynthesis | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  const agreement    = typeof o.agreement    === "string" ? o.agreement.trim()    : undefined;
  const disagreement = typeof o.disagreement === "string" ? o.disagreement.trim() : undefined;
  const dominantVoice = typeof o.dominantVoice === "string" && VALID_DOMINANT_VOICE.has(o.dominantVoice)
    ? (o.dominantVoice as CommitteeSynthesis["dominantVoice"])
    : undefined;
  const finalStance  = typeof o.finalStance  === "string" ? o.finalStance.trim()  : undefined;
  if (!agreement && !disagreement && !dominantVoice && !finalStance) return undefined;
  return { agreement, disagreement, dominantVoice, finalStance };
}
