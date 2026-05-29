// Phase-84A: Research Memory Engine
// Pure deterministic functions — no AI calls, no network.
// Process-level in-memory singleton (module-scope Map).
//
// Stores structured research patterns that accumulate across questions:
//   - Market regime observations
//   - Sector pattern notes
//   - Risk pattern observations
//   - Recurring Saudi transmission patterns
//   - Failed thesis lessons
//   - Confirmed thesis lessons
//
// Distinct from thesisMemoryStore (snapshot storage):
//   thesisMemoryStore   — saves/retrieves full thesis snapshots for "Prior thesis:" injection
//   researchMemoryEngine — stores COMPACT pattern observations that build over time,
//                          injected as "Research memory:" context

import type { GenesisReply } from "@/lib/genesis.functions";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResearchMemoryType =
  | "regime_observation"      // current market regime characteristics
  | "sector_pattern"          // sector behavior pattern in current regime
  | "risk_pattern"            // recurring risk signal observed
  | "saudi_transmission"      // Saudi-specific transmission observation
  | "thesis_confirmed"        // thesis elements that proved correct
  | "thesis_failed"           // thesis elements that proved wrong
  | "allocator_lesson";       // allocator behavior that worked/failed

export interface ResearchMemoryEntry {
  id: string;
  type: ResearchMemoryType;
  summary: string;            // compact, 1-2 sentences
  keywords: string[];         // for relevance matching
  timestamp: number;
  isSaudi: boolean;
  confidence: number;         // 0-100: how reliable is this pattern
  stale: boolean;
}

// ─── Store constants ──────────────────────────────────────────────────────────

const MAX_ENTRIES = 30;
const STALE_MS = 60 * 60 * 1000; // 1 hour

// ─── Process-level store ─────────────────────────────────────────────────────

const _memoryStore: ResearchMemoryEntry[] = [];
let _entryCounter = 0;

// ─── Auto-extraction from GenesisReply ───────────────────────────────────────
// Extracts structured research patterns from a completed reply.

function extractRegimeObservation(reply: GenesisReply, isSaudi: boolean): ResearchMemoryEntry | null {
  if (!reply.regime && !reply.macroChain) return null;
  const summary = reply.regime
    ? `Regime: ${reply.regime.replace(/_/g, " ")}. ${(reply.macroChain ?? "").slice(0, 100)}`
    : (reply.macroChain ?? "").slice(0, 120);
  return {
    id: `rm_${++_entryCounter}_${Date.now()}`,
    type: "regime_observation",
    summary,
    keywords: [reply.regime ?? "", "regime", isSaudi ? "saudi" : "global"].filter(Boolean),
    timestamp: Date.now(),
    isSaudi,
    confidence: reply.confidence ?? 50,
    stale: false,
  };
}

function extractSectorPattern(reply: GenesisReply, isSaudi: boolean): ResearchMemoryEntry | null {
  if (!reply.sectorLens) return null;
  return {
    id: `rm_${++_entryCounter}_${Date.now()}`,
    type: "sector_pattern",
    summary: reply.sectorLens.slice(0, 150),
    keywords: ["sector", isSaudi ? "saudi" : "global", reply.regime ?? ""].filter(Boolean),
    timestamp: Date.now(),
    isSaudi,
    confidence: Math.min(reply.confidence ?? 50, 70), // sector patterns are more uncertain
    stale: false,
  };
}

function extractRiskPattern(reply: GenesisReply, isSaudi: boolean): ResearchMemoryEntry | null {
  if (!reply.secondOrderRisks && !reply.bearCase) return null;
  const summary = reply.secondOrderRisks ?? reply.bearCase ?? "";
  return {
    id: `rm_${++_entryCounter}_${Date.now()}`,
    type: "risk_pattern",
    summary: summary.slice(0, 150),
    keywords: ["risk", isSaudi ? "saudi" : "global", "second-order", "bear"].filter(Boolean),
    timestamp: Date.now(),
    isSaudi,
    confidence: 60,
    stale: false,
  };
}

function extractSaudiTransmission(reply: GenesisReply): ResearchMemoryEntry | null {
  if (!reply.macroChain || !/aramco|أرامكو|breakeven|نقطة.*التعادل|SAMA|sama/i.test(reply.macroChain)) return null;
  const transmission = (reply.macroChain ?? "").slice(0, 200);
  return {
    id: `rm_${++_entryCounter}_${Date.now()}`,
    type: "saudi_transmission",
    summary: transmission,
    keywords: ["saudi", "aramco", "breakeven", "sama", "tasi"],
    timestamp: Date.now(),
    isSaudi: true,
    confidence: reply.confidence ?? 55,
    stale: false,
  };
}

// ─── Store management ─────────────────────────────────────────────────────────

function pruneStoreToCapacity(): void {
  // Mark time-stale entries
  const now = Date.now();
  for (const e of _memoryStore) {
    if (!e.stale && (now - e.timestamp) > STALE_MS) e.stale = true;
  }
  // Remove stale from end if over capacity
  while (_memoryStore.length > MAX_ENTRIES) {
    // Find and remove oldest stale entry, else oldest entry
    const staleIdx = _memoryStore.findIndex(e => e.stale);
    if (staleIdx !== -1) { _memoryStore.splice(staleIdx, 1); }
    else { _memoryStore.shift(); } // remove oldest
  }
}

// ─── Relevance scoring ────────────────────────────────────────────────────────

function scoreRelevance(entry: ResearchMemoryEntry, question: string, isSaudi: boolean): number {
  if (entry.stale) return 0;
  const text = question.toLowerCase();
  let score = entry.keywords.filter(k => k && text.includes(k.toLowerCase())).length;
  if (isSaudi && entry.isSaudi) score += 2;
  if (!isSaudi && !entry.isSaudi) score += 1;
  return score;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extracts and stores research patterns from a completed GenesisReply.
 * Called after reply construction. Pure O(1) — no AI calls.
 */
export function storeResearchPatterns(
  reply: GenesisReply,
  isSaudi: boolean,
): number {
  const extractions = [
    extractRegimeObservation(reply, isSaudi),
    extractSectorPattern(reply, isSaudi),
    extractRiskPattern(reply, isSaudi),
    isSaudi ? extractSaudiTransmission(reply) : null,
  ].filter((e): e is ResearchMemoryEntry => e !== null);

  for (const entry of extractions) {
    _memoryStore.push(entry);
  }
  pruneStoreToCapacity();
  return extractions.length;
}

/**
 * Retrieves relevant research memory entries for a question.
 * Returns up to 3 most relevant non-stale entries.
 */
export function queryResearchMemory(
  question: string,
  isSaudi: boolean,
): ResearchMemoryEntry[] {
  const scored = _memoryStore
    .map(e => ({ entry: e, score: scoreRelevance(e, question, isSaudi) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map(x => x.entry);
}

/**
 * Builds a compact research memory context block for prompt injection.
 * Only injects when there are relevant non-stale entries.
 */
export function buildResearchMemoryContext(
  entries: ResearchMemoryEntry[],
  lang: "ar" | "en",
): string {
  if (entries.length === 0) return "";
  const ar = lang === "ar";

  const header = ar
    ? "ذاكرة البحث (أنماط من جلسات سابقة — سياق تحليلي فقط، لا تنبؤات):"
    : "Research memory (patterns from prior sessions — analytical context only, not predictions):";

  const lines = entries.map((e, i) => {
    const typeLabel = ar
      ? { regime_observation: "نظام", sector_pattern: "قطاعات", risk_pattern: "مخاطر", saudi_transmission: "انتقال سعودي", thesis_confirmed: "أطروحة مؤكدة", thesis_failed: "أطروحة فاشلة", allocator_lesson: "درس مخصص" }[e.type] ?? e.type
      : e.type.replace(/_/g, " ");
    return `${i + 1}. [${typeLabel}] ${e.summary.slice(0, 120)}`;
  });

  const rule = ar
    ? "استخدم هذه الأنماط كسياق تفسيري محكوم — تُعلم، لا تُحدد. البيانات الحية تتقدم على الذاكرة دائماً."
    : "Use these patterns as governed interpretive context — they inform, not determine. Live data always takes precedence.";

  return [header, ...lines, rule].join("\n");
}

/** Returns store stats for logging (no sensitive data). */
export function getResearchMemoryStats(): string {
  const fresh = _memoryStore.filter(e => !e.stale).length;
  return `total=${_memoryStore.length} fresh=${fresh}`;
}
