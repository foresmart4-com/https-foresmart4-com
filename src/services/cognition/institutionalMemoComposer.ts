// Institutional Memo Composer
// Assembles a structured institutional investment memorandum from existing
// reply fields — server-side, no AI calls, no network.
//
// Root cause addressed: Final answer behaves as structured summary instead
// of institutional memorandum. This composer re-sequences the same computed
// content into canonical institutional memo order.
//
// Memo order (required by institutional practice):
//   1. Direct Answer     — thesis / baseCase
//   2. Allocator View    — voiceReasoning.allocator
//   3. Bull Thesis       — bullCase
//   4. Counter-Thesis    — bearCase + opposingCase
//   5. Historical Analog — voiceReasoning.historical (or perspectiveMap HISTORICAL)
//   6. What Differs Now  — caveats + evidenceConflict
//   7. Conviction        — confidence + thesisStrength + confidenceCalibration
//   8. Thesis Changer    — thesisChanger + invalidation
//   9. CIO Framing       — committeeSynthesis.finalStance + selectionFramework
//
// Does NOT generate new content. Surfaces content already computed.
// Pure deterministic. O(1).

export interface MemoableReply {
  thesis?: string;
  baseCase?: string;
  bullCase?: string;
  bearCase?: string;
  opposingCase?: string;
  committeeBearCase?: string;
  voiceReasoning?: {
    allocator?: string;
    historical?: string;
    macro?: string;
    policy?: string;
    behavioral?: string;
  };
  committeeSynthesis?: {
    finalStance?: string;
    agreement?: string;
    disagreement?: string;
    dominantVoice?: string;
  };
  caveats?: string[];
  evidenceConflict?: string;
  confidence?: number;
  thesisStrength?: string;
  confidenceCalibration?: string;
  thesisChanger?: string;
  invalidation?: string;
  selectionFramework?: string;
  perspectiveMap?: string;
  macroChain?: string;
}

export interface InstitutionalMemoResult {
  memo: string;                  // formatted memo text
  sectionsIncluded: string[];    // which sections were populated
  memoScore: number;             // 0-100 completeness
  memoGrade: "institutional" | "adequate" | "thin" | "empty";
}

function mkSection(label: string, content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "";
  return `**${label}**\n${trimmed}`;
}

function clip(s: string | undefined, maxLen: number): string {
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen - 1) + "…" : s;
}

function extractHistoricalAnalog(reply: MemoableReply): string {
  if (reply.voiceReasoning?.historical) return clip(reply.voiceReasoning.historical, 350);
  if (reply.perspectiveMap) {
    const m = reply.perspectiveMap.match(/HISTORICAL[:\s]+([^|]+)/i);
    if (m) return clip(m[1].trim(), 200);
  }
  if (
    reply.macroChain &&
    /\b(1970|1998|2008|2013|2022|stagflation|taper|gfc|covid|volcker|oil collapse)\b/i.test(reply.macroChain)
  ) {
    return clip(reply.macroChain, 200);
  }
  return "";
}

function extractWhatDiffers(reply: MemoableReply): string {
  if (reply.caveats && reply.caveats.length > 0) {
    return reply.caveats.slice(0, 2).join("; ");
  }
  if (reply.evidenceConflict) return clip(reply.evidenceConflict, 200);
  return "";
}

function buildConvictionLine(reply: MemoableReply, lang: "ar" | "en"): string {
  const conf = reply.confidence ?? 0;
  if (!conf) return "";
  const strength = reply.thesisStrength ?? "";
  const cal = reply.confidenceCalibration ?? "";
  if (lang === "ar") {
    return `القناعة: ${conf}%${strength ? ` | قوة الأطروحة: ${strength}` : ""}${cal ? ` — ${cal}` : ""}`;
  }
  return `Conviction: ${conf}%${strength ? ` | Thesis strength: ${strength}` : ""}${cal ? ` — ${cal}` : ""}`;
}

export function composeInstitutionalMemo(
  reply: MemoableReply,
  lang: "ar" | "en",
): InstitutionalMemoResult {
  const ar = lang === "ar";
  const parts: string[] = [];
  const included: string[] = [];

  // ── 1. Direct Answer ────────────────────────────────────────────────────────
  const directAnswer = reply.thesis ?? reply.baseCase ?? "";
  if (directAnswer) {
    parts.push(mkSection(ar ? "الحكم المباشر" : "DIRECT ANSWER", directAnswer));
    included.push("direct_answer");
  }

  // ── 2. Allocator View ───────────────────────────────────────────────────────
  const allocView = clip(reply.voiceReasoning?.allocator, 350);
  if (allocView) {
    parts.push(mkSection(ar ? "وجهة المخصص" : "ALLOCATOR VIEW", allocView));
    included.push("allocator_view");
  }

  // ── 3. Bull Thesis ──────────────────────────────────────────────────────────
  const bull = clip(reply.bullCase, 280);
  if (bull) {
    parts.push(mkSection(ar ? "الحالة الصاعدة" : "BULL THESIS", bull));
    included.push("bull_case");
  }

  // ── 4. Counter-Thesis ───────────────────────────────────────────────────────
  const bear = clip(reply.bearCase ?? reply.opposingCase ?? reply.committeeBearCase, 280);
  if (bear) {
    parts.push(mkSection(ar ? "الأطروحة المضادة" : "COUNTER-THESIS", bear));
    included.push("counter_thesis");
  }

  // ── 5. Historical Analog ─────────────────────────────────────────────────────
  const analog = extractHistoricalAnalog(reply);
  if (analog) {
    parts.push(mkSection(ar ? "النظير التاريخي" : "HISTORICAL ANALOG", analog));
    included.push("historical_analog");
  }

  // ── 6. What Differs Now ──────────────────────────────────────────────────────
  const differs = extractWhatDiffers(reply);
  if (differs) {
    parts.push(mkSection(ar ? "ما يختلف الآن" : "WHAT DIFFERS NOW", differs));
    included.push("what_differs");
  }

  // ── 7. Conviction ────────────────────────────────────────────────────────────
  const conviction = buildConvictionLine(reply, lang);
  if (conviction) {
    parts.push(mkSection(ar ? "القناعة" : "CONVICTION", conviction));
    included.push("conviction");
  }

  // ── 8. What Changes This Thesis ──────────────────────────────────────────────
  const changer = clip(reply.thesisChanger ?? reply.invalidation, 230);
  if (changer) {
    parts.push(mkSection(ar ? "ما يُغيّر هذه الأطروحة" : "WHAT CHANGES THIS THESIS", changer));
    included.push("thesis_changer");
  }

  // ── 9. CIO Framing ──────────────────────────────────────────────────────────
  const cio = clip(reply.committeeSynthesis?.finalStance ?? reply.selectionFramework, 320);
  if (cio) {
    parts.push(mkSection(ar ? "إطار كبير المستثمرين" : "CIO FRAMING", cio));
    included.push("cio_framing");
  }

  const validParts = parts.filter(Boolean);
  const memo = validParts.join("\n\n");
  const memoScore = Math.min(100, included.length * 12);
  const memoGrade: InstitutionalMemoResult["memoGrade"] =
    memoScore >= 72 ? "institutional"
    : memoScore >= 48 ? "adequate"
    : memoScore >= 24 ? "thin"
    : "empty";

  return { memo, sectionsIncluded: included, memoScore, memoGrade };
}
