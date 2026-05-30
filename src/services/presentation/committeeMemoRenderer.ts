// Committee Memo Renderer
// Produces structured data for memo-first rendering in the research terminal.
// Does NOT generate JSX — returns pure data that the UI layer renders.
//
// The memo is rendered as the FIRST substantive block a user sees.
// Cards, regime labels, and confidence bars are relegated to secondary status.
//
// Rendering contract:
//   - institutionalMemo     → rendered as full terminal memo (sections parsed)
//   - headline              → rendered as "CIO DIRECT ANSWER" when no memo
//   - committee reasoning   → rendered as collapsible "Committee Reasoning" block
//   - evidence / cases      → rendered as secondary evidence below the memo
//   - regime / confidence   → rendered at the bottom as metadata only

export interface MemoSection {
  id: string;
  heading: string;
  headingAr: string;
  body: string;
  tier: "primary" | "reasoning" | "evidence" | "secondary";
}

export interface RenderedMemo {
  sections: MemoSection[];
  hasMemo: boolean;            // institutionalMemo was used
  memoGrade: "institutional" | "adequate" | "thin" | "empty";
  directAnswer: string;        // headline or thesis — always present
  allocatorView: string;       // voiceReasoning.allocator if available
  historicalAnalog: string;    // voiceReasoning.historical if available
  counterThesis: string;       // bearCase or opposingCase
  whatDiffers: string;         // caveats or evidenceConflict
  cioFraming: string;          // committeeSynthesis.finalStance or selectionFramework
}

export interface MemoableReply {
  institutionalMemo?: string;
  headline?: string;
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

function clip(s: string | undefined, maxLen: number): string {
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen - 1) + "…" : s;
}

function parseInstitutionalMemo(memo: string): MemoSection[] {
  if (!memo.trim()) return [];
  const blocks = memo.split("\n\n").filter(Boolean);
  const sections: MemoSection[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    const boldMatch = block.match(/^\*\*(.+?)\*\*\n([\s\S]+)$/);
    if (boldMatch) {
      const heading = boldMatch[1].trim();
      const body = boldMatch[2].trim();
      const headingUpper = heading.toUpperCase();
      const tier: MemoSection["tier"] =
        headingUpper.includes("DIRECT ANSWER") || headingUpper.includes("ALLOCATOR") ? "primary"
        : headingUpper.includes("BULL") || headingUpper.includes("COUNTER") || headingUpper.includes("HISTORICAL") || headingUpper.includes("WHAT DIFFERS") ? "reasoning"
        : headingUpper.includes("CIO") || headingUpper.includes("CONVICTION") || headingUpper.includes("CHANGES") ? "evidence"
        : "secondary";

      sections.push({
        id: `memo_${i}`,
        heading,
        headingAr: heading,
        body,
        tier,
      });
    } else if (block) {
      sections.push({
        id: `memo_${i}`,
        heading: "",
        headingAr: "",
        body: block,
        tier: "primary",
      });
    }
  }
  return sections;
}

export function renderMemo(reply: MemoableReply, lang: "ar" | "en"): RenderedMemo {
  const hasMemo = Boolean(reply.institutionalMemo?.trim());
  const sections = hasMemo ? parseInstitutionalMemo(reply.institutionalMemo!) : [];

  // Derive memoGrade from section count
  const memoGrade: RenderedMemo["memoGrade"] =
    sections.length >= 6 ? "institutional"
    : sections.length >= 4 ? "adequate"
    : sections.length >= 2 ? "thin"
    : "empty";

  // Direct answer: headline first, then thesis/baseCase
  const directAnswer = clip(reply.headline ?? reply.thesis ?? reply.baseCase, 300);

  // Allocator view from voiceReasoning
  const allocatorView = clip(reply.voiceReasoning?.allocator, 350);

  // Historical analog from voiceReasoning or macroChain
  const historicalAnalog =
    clip(reply.voiceReasoning?.historical, 350) ||
    (reply.macroChain && /\b(1970|1998|2008|2013|2022|stagflation|taper|gfc|covid|volcker)\b/i.test(reply.macroChain)
      ? clip(reply.macroChain, 200)
      : "");

  // Counter-thesis
  const counterThesis = clip(reply.bearCase ?? reply.opposingCase ?? reply.committeeBearCase, 280);

  // What differs
  const whatDiffers =
    reply.caveats && reply.caveats.length > 0
      ? reply.caveats.slice(0, 2).join("; ")
      : clip(reply.evidenceConflict, 200);

  // CIO framing
  const cioFraming = clip(reply.committeeSynthesis?.finalStance ?? reply.selectionFramework, 320);

  return {
    sections,
    hasMemo,
    memoGrade,
    directAnswer,
    allocatorView,
    historicalAnalog,
    counterThesis,
    whatDiffers,
    cioFraming,
  };
}
