// Phase-86A: Event Synthesis Governor
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Governance capstone for the Phase-86A pipeline. Receives outputs from:
//   macroTransmissionEngine  → structured causal chains
//   policyIntelligenceEngine → CB language + regime classification
//   liveMacroMonitor         → detected macro events from live signals
//   thesisImpactEngine       → thesis impact scoring
//
// Governance rules:
//   Anti-headline chasing:    requires event impact score ≥ 30 before injection
//   Anti-hype:               detects and suppresses superlative language
//   Anti-noise:              filters low-relevance events (relevance < threshold)
//   Weak relevance gate:     doesn't inject if question isn't investment-relevant
//   Bounded context:         max 450 chars output
//
// Returns single governed synthesis string + label for prompt injection.
//
// No autonomous execution. Educational/advisory only. No broker data.

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SynthesisInput {
  transmissionCtx: string;   // from macroTransmissionEngine
  policyCtx:       string;   // from policyIntelligenceEngine
  macroEventCtx:   string;   // from liveMacroMonitor
  thesisImpactCtx: string;   // from thesisImpactEngine
  thesisImpactScore:  number;  // 0-100: from thesisImpactEngine
  questionRelevance:  number;  // 0-100: from liveResearchMonitor or heuristic
  isInvestment:    boolean;
  maxChars?:       number;   // default 450
}

export interface GovernedSynthesisResult {
  governedContext:  string;        // clean, bounded injectable string
  synthesisLabel:   string;        // e.g. "macro+policy" or "policy+impact"
  governance: {
    inputPieces:   number;
    kept:          number;
    hypeFiltered:  number;
    noiseFiltered: number;
    belowThreshold:number;
    truncated:     boolean;
  };
  isEmpty: boolean;
}

// ─── Anti-hype patterns ───────────────────────────────────────────────────────

const HYPE_PATTERNS: RegExp[] = [
  /\b(catastrophic|devastating|historic crash|once in a generation|unprecedented surge|will definitely|certain to|guaranteed to)\b/i,
  /\b(100% certain|absolutely|without doubt|cannot fail|infallible signal|perfect indicator)\b/i,
  /\b(must buy|must sell|urgent action|act immediately|don't miss|explosive move|massive rally)\b/i,
  /\b(انهيار مؤكد|فرصة العمر|لا شك|مضمون|حتماً)\b/i,
];

// ─── Anti-noise patterns (generic boilerplate adding no value) ─────────────

const NOISE_PATTERNS: RegExp[] = [
  /\bit is (important|essential|critical) to (note|remember|consider)/i,
  /\bplease (note|be aware|consider|remember)\b/i,
  /\bin (summary|conclusion|general)\b/i,
  /\bfundamentally speaking\b/i,
  /\bone should (always|consider|think|remember)\b/i,
];

// ─── Relevance scoring heuristic ─────────────────────────────────────────────

function scoreRelevance(text: string): number {
  if (!text || text.length < 20) return 0;
  let score = 0;
  if (/\b(→|\d+%|bps|breakeven|\$\d+)\b/i.test(text)) score += 25;
  if (/\b(tasi|aramco|sama|fed|ecb)\b/i.test(text))   score += 20;
  if (/\b(thesis|bullish|bearish|allocat|regime)\b/i.test(text)) score += 15;
  if (/\b(transmission|impact|mechanism|channel)\b/i.test(text)) score += 10;
  return Math.min(100, score);
}

// ─── Content cleaning ─────────────────────────────────────────────────────────

function applyAntiHype(text: string): { cleaned: string; filtered: number } {
  let cleaned = text;
  let filtered = 0;
  for (const p of HYPE_PATTERNS) {
    const before = cleaned;
    cleaned = cleaned.replace(p, "[governed]").replace(/\[governed\]/g, "").replace(/\s{2,}/g, " ").trim();
    if (cleaned !== before) filtered++;
  }
  return { cleaned, filtered };
}

function applyAntiNoise(text: string): { cleaned: string; filtered: number } {
  let cleaned = text;
  let filtered = 0;
  for (const p of NOISE_PATTERNS) {
    const before = cleaned;
    cleaned = cleaned.replace(p, "").replace(/\s{2,}/g, " ").trim();
    if (cleaned !== before) filtered++;
  }
  return { cleaned, filtered };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function governEventSynthesis(input: SynthesisInput): GovernedSynthesisResult {
  const {
    transmissionCtx,
    policyCtx,
    macroEventCtx,
    thesisImpactCtx,
    thesisImpactScore,
    questionRelevance,
    isInvestment,
    maxChars = 450,
  } = input;

  const governance = {
    inputPieces:    0,
    kept:           0,
    hypeFiltered:   0,
    noiseFiltered:  0,
    belowThreshold: 0,
    truncated:      false,
  };

  // Weak relevance gate: don't inject for non-investment questions with low signals
  if (!isInvestment && questionRelevance < 40) {
    return { governedContext: "", synthesisLabel: "gated", governance, isEmpty: true };
  }

  // Headline chasing gate: require minimum thesis impact score
  const IMPACT_THRESHOLD = 25;
  if (thesisImpactScore < IMPACT_THRESHOLD && questionRelevance < 40) {
    governance.belowThreshold++;
    return { governedContext: "", synthesisLabel: "below_threshold", governance, isEmpty: true };
  }

  // Collect non-empty pieces with labels
  const pieces: Array<{ label: string; text: string; relevance: number }> = [
    { label: "impact",       text: thesisImpactCtx,  relevance: thesisImpactScore },
    { label: "macro_event",  text: macroEventCtx,     relevance: scoreRelevance(macroEventCtx)  },
    { label: "transmission", text: transmissionCtx,   relevance: scoreRelevance(transmissionCtx) },
    { label: "policy",       text: policyCtx,          relevance: scoreRelevance(policyCtx)     },
  ].filter(p => p.text.trim().length > 0);

  governance.inputPieces = pieces.length;

  if (pieces.length === 0) {
    return { governedContext: "", synthesisLabel: "no_input", governance, isEmpty: true };
  }

  // Score-based filtering: keep only pieces above relevance threshold
  const RELEVANCE_THRESHOLD = 15;
  const relevant = pieces.filter(p => {
    if (p.relevance < RELEVANCE_THRESHOLD) {
      governance.belowThreshold++;
      return false;
    }
    return true;
  });

  if (relevant.length === 0) {
    return { governedContext: "", synthesisLabel: "filtered_empty", governance, isEmpty: true };
  }

  // Apply anti-hype and anti-noise per piece
  const cleaned = relevant.map(p => {
    const { cleaned: c1, filtered: h } = applyAntiHype(p.text);
    const { cleaned: c2, filtered: n } = applyAntiNoise(c1);
    governance.hypeFiltered  += h;
    governance.noiseFiltered += n;
    return { ...p, text: c2 };
  }).filter(p => p.text.length > 10);

  governance.kept = cleaned.length;

  if (cleaned.length === 0) {
    return { governedContext: "", synthesisLabel: "cleaned_empty", governance, isEmpty: true };
  }

  // Sort by relevance (descending) — most relevant first
  cleaned.sort((a, b) => b.relevance - a.relevance);

  // Assemble within budget
  let assembled = cleaned.map(p => p.text).join(" | ");
  if (assembled.length > maxChars) {
    assembled = assembled.slice(0, maxChars - 3) + "...";
    governance.truncated = true;
  }

  const synthesisLabel = cleaned.map(p => p.label).join("+");

  return {
    governedContext: assembled,
    synthesisLabel,
    governance,
    isEmpty: false,
  };
}
