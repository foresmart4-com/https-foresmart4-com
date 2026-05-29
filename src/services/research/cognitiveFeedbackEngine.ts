// Phase-85D: Cognitive Feedback Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Evaluates expert reasoning quality at two points in the pipeline:
//
//   PRE-CALL (during prompt assembly):
//     Scores EXPECTED usefulness of each context piece based on:
//       - Analytical dimension coverage (quantitative, causal, regime, allocation)
//       - Concept density (distinct investment terms per 100 chars)
//       - Quantitative anchor count (numbers, thresholds, %)
//
//   POST-CALL (after AI reply):
//     Scores ACTUAL contribution by checking whether:
//       - Key terms from each context piece appear in the AI reply
//       - The reply cites thinker/school/playbook concepts from the context
//
// Output: CognitiveFeedbackRecord — stored by expertLearningGovernor for
// adaptive weight adjustment.
//
// cognitiveContributionScore: 0-100. Measures how much expert context
// actually informed the reasoning, not just whether it was present in the prompt.
//
// No secrets. No PII. No broker data. Educational/advisory only.

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ExpertContextPiece {
  label: "thinker" | "school" | "playbook" | "framework" | "literature" | "authority";
  ids: string[];    // thinker IDs, school IDs, playbook IDs etc.
  text: string;     // the context string
}

export interface PieceScore {
  label: string;
  ids: string[];
  expectedUsefulness:  number;  // 0-100: pre-call estimate
  actualContribution:  number;  // 0-100: post-call measurement (0 if not yet evaluated)
  repetitionPenalty:   number;  // 0-30: penalty for overlapping with other pieces
}

export interface CognitiveFeedbackRecord {
  timestamp:               number;
  questionType:            "investment" | "saudi" | "macro" | "general";
  activatedThinkerIds:     string[];
  activatedSchoolIds:      string[];
  activatedPlaybookId:     string;
  pieceScores:             PieceScore[];
  cognitiveContributionScore: number;  // 0-100: overall expert contribution
  repetitionRate:          number;     // 0-1: fraction of context that was repetitive
}

// ─── Analytical dimension patterns ────────────────────────────────────────────
// Each dimension adds to expected usefulness when detected in a piece.

const DIMENSION_PATTERNS: Array<{ label: string; pattern: RegExp; score: number }> = [
  { label: "quantitative", pattern: /\d+(?:\.\d+)?%|\$\d+|bps|\b\d{2,4}\b/, score: 15 },
  { label: "causal",       pattern: /\b(because|therefore|implies|leads to|transmit|drives|→|السببي|لأن|لذلك)\b/i, score: 12 },
  { label: "regime",       pattern: /\b(regime|cycle|transition|quadrant|phase|نظام|دورة|تحول)\b/i, score: 10 },
  { label: "allocation",   pattern: /\b(favour|avoid|overweight|underweight|rotate|allocat|توزيع|تفضيل|تجنب)\b/i, score: 12 },
  { label: "conflict",     pattern: /\b(conflict|disagree|opposing|contrary|however|but|يعارض|يختلف)\b/i, score: 10 },
  { label: "named_entity", pattern: /\b(fed|ecb|sama|aramco|tasi|keynes|dalio|shiller|minsky|friedman|hayek|fama|buffett|marks|soros|druckenmiller)\b/i, score: 8 },
  { label: "saudi",        pattern: /\b(saudi|aramco|tasi|sama|vision 2030|breakeven|pif|سعودي|أرامكو|تاسي)\b/i, score: 8 },
];

// ─── Pre-call scoring ─────────────────────────────────────────────────────────

function scoreExpectedUsefulness(text: string): number {
  if (!text || text.length < 30) return 0;

  let score = 0;
  for (const { pattern, score: pts } of DIMENSION_PATTERNS) {
    if (pattern.test(text)) score += pts;
  }

  // Concept density bonus: distinct 5+ char investment words per 100 chars
  const words = text.toLowerCase().match(/\b[a-z]{5,}\b/g) ?? [];
  const unique = new Set(words);
  const density = (unique.size / Math.max(text.length, 100)) * 100;
  score += Math.min(15, Math.round(density * 3));

  return Math.min(100, score);
}

function scoreRepetition(pieces: ExpertContextPiece[]): number[] {
  const penalties: number[] = new Array(pieces.length).fill(0);
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const overlap = computeTokenOverlap(pieces[i].text, pieces[j].text);
      if (overlap > 0.30) {
        // Penalise lower-priority piece (later in array)
        penalties[j] = Math.max(penalties[j], Math.round(overlap * 30));
      }
    }
  }
  return penalties;
}

function computeTokenOverlap(a: string, b: string): number {
  const tokA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length >= 4));
  const tokB = b.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
  if (tokA.size === 0 || tokB.length === 0) return 0;
  const hits = tokB.filter(t => tokA.has(t)).length;
  return hits / Math.max(tokA.size, tokB.length);
}

// ─── Post-call scoring ────────────────────────────────────────────────────────

function scoreActualContribution(piece: ExpertContextPiece, replyText: string): number {
  if (!replyText || replyText.length < 50) return 0;
  if (!piece.text) return 0;

  const reply = replyText.toLowerCase();

  // Check if piece's key tokens appear in reply
  const pieceTokens = piece.text.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= 5 && !STOPWORDS.has(w));

  const uniqueTokens = [...new Set(pieceTokens)];
  if (uniqueTokens.length === 0) return 0;

  const reflected = uniqueTokens.filter(t => reply.includes(t)).length;
  const ratio = reflected / uniqueTokens.length;

  // Named IDs from piece (thinker names, school names)
  let idBonus = 0;
  for (const id of piece.ids) {
    if (reply.includes(id.toLowerCase())) idBonus += 10;
  }

  return Math.min(100, Math.round(ratio * 70 + idBonus));
}

const STOPWORDS = new Set([
  "about", "above", "after", "also", "analysis", "apply", "because", "before",
  "between", "both", "capital", "class", "context", "could", "credit",
  "curve", "cycle", "every", "factor", "first", "fixed", "framework",
  "given", "have", "hedging", "historical", "however", "income", "institutional",
  "investing", "logic", "market", "model", "monetary", "often", "other", "plays",
  "policy", "portfolio", "position", "price", "range", "regime", "relevant",
  "return", "saudi", "school", "should", "signal", "that", "their", "there",
  "this", "those", "through", "under", "using", "value", "when", "where",
  "which", "while", "with", "within", "years",
]);

// ─── Public API ───────────────────────────────────────────────────────────────

export function evaluatePreCall(
  pieces: ExpertContextPiece[],
  question: string,
  isSaudi: boolean,
): Omit<CognitiveFeedbackRecord, "timestamp" | "cognitiveContributionScore" | "repetitionRate"> {
  const repPenalties = scoreRepetition(pieces);

  const pieceScores: PieceScore[] = pieces.map((p, i) => ({
    label: p.label,
    ids:   p.ids,
    expectedUsefulness:  scoreExpectedUsefulness(p.text),
    actualContribution:  0,   // filled post-call
    repetitionPenalty:   repPenalties[i],
  }));

  const questionType: CognitiveFeedbackRecord["questionType"] =
    isSaudi ? "saudi"
    : /invest|allocat|portfolio|sector|macro/i.test(question) ? "investment"
    : /macro|regime|cycle|inflation/i.test(question) ? "macro"
    : "general";

  return {
    questionType,
    activatedThinkerIds:  pieces.filter(p => p.label === "thinker").flatMap(p => p.ids),
    activatedSchoolIds:   pieces.filter(p => p.label === "school").flatMap(p => p.ids),
    activatedPlaybookId:  pieces.find(p => p.label === "playbook")?.ids[0] ?? "",
    pieceScores,
  };
}

export function evaluatePostCall(
  preRecord: Omit<CognitiveFeedbackRecord, "timestamp" | "cognitiveContributionScore" | "repetitionRate">,
  pieces: ExpertContextPiece[],
  replyText: string,
): CognitiveFeedbackRecord {
  const updatedScores = preRecord.pieceScores.map((ps, i) => ({
    ...ps,
    actualContribution: pieces[i]
      ? scoreActualContribution(pieces[i], replyText)
      : 0,
  }));

  const totalExpected = updatedScores.reduce((s, p) => s + p.expectedUsefulness, 0);
  const totalActual   = updatedScores.reduce((s, p) => s + p.actualContribution, 0);
  const totalPenalty  = updatedScores.reduce((s, p) => s + p.repetitionPenalty, 0);

  const n = Math.max(1, updatedScores.length);
  const avgActual  = totalActual / n;
  const avgPenalty = totalPenalty / n;

  const cognitiveContributionScore = Math.max(0, Math.min(100,
    Math.round(avgActual * 0.70 + (totalExpected / n) * 0.30 - avgPenalty),
  ));

  const repetitionRate = n > 0
    ? updatedScores.filter(p => p.repetitionPenalty > 10).length / n
    : 0;

  return {
    ...preRecord,
    timestamp: Date.now(),
    pieceScores: updatedScores,
    cognitiveContributionScore,
    repetitionRate,
  };
}
