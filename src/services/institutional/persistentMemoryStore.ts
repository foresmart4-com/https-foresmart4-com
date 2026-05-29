// Phase-84B: Persistent Institutional Memory Store
// Pure deterministic functions — no AI calls, no network, O(1) amortised.
//
// Distinct from Phase-84A thesisMemoryStore + researchMemoryEngine:
//   Phase-84A stores — per-category rolling buffers, simple Maps, 45-60 min stale
//   persistentMemoryStore (84B) — unified bounded LRU store with:
//                                   • single store for all memory types
//                                   • bounded capacity (max 80 entries, LRU eviction)
//                                   • rich relevance scoring (not just keyword count)
//                                   • serialisation/deserialisation interface
//                                     (caller can persist to any backend)
//                                   • explicit stale tiers (hot/warm/cold/expired)
//                                   • memory health monitoring
//
// Persistence note: this module provides a SAFE in-process store with an export
// interface for future backend persistence (Supabase Storage, filesystem, etc.)
// without requiring any schema modification.
//
// No secrets. No PII. No broker data. No personal financial advice.

import type { GenesisReply } from "@/lib/genesis.functions";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PersistentMemoryCategory =
  | "thesis_snapshot"        // full thesis from a completed reply
  | "regime_observation"     // market regime characteristics
  | "sector_pattern"         // sector behaviour in current regime
  | "saudi_transmission"     // Saudi oil→fiscal→market chains
  | "outcome_lesson"         // lesson from thesis comparison
  | "risk_pattern"           // recurring risk signal
  | "allocator_lesson";      // allocator stance that proved relevant

export type MemoryTier = "hot" | "warm" | "cold" | "expired";

const TIER_THRESHOLDS_MS: Record<MemoryTier, number> = {
  hot:     20 * 60 * 1000,   // < 20 min: regime-fresh
  warm:    60 * 60 * 1000,   // 20-60 min: still useful
  cold:    3 * 60 * 60 * 1000, // 1-3 h: structural patterns only
  expired: Infinity,
};

export interface PersistentMemoryEntry {
  id: string;
  category: PersistentMemoryCategory;
  content: string;           // compact 1-3 sentence summary
  keywords: string[];        // relevance matching
  isSaudi: boolean;
  timestamp: number;
  accessCount: number;       // LRU: incremented on each access
  lastAccessed: number;
  tier: MemoryTier;
  // Structured slots for semantic comparison
  direction?: "bullish" | "bearish" | "neutral";
  conviction?: number;       // 0-100
  policyStance?: "easing" | "holding" | "tightening" | "unknown";
  oilSignal?: "above" | "near" | "below" | "unknown";
}

export interface MemoryExport {
  version: number;
  exportedAt: number;
  entries: PersistentMemoryEntry[];
}

// ─── Store configuration ──────────────────────────────────────────────────────

const MAX_ENTRIES = 80;
const MIN_ACCESS_COUNT_FOR_RETENTION = 1; // accessed at least once
const EVICTION_BATCH = 10;               // evict this many at a time

// ─── Process-level store ─────────────────────────────────────────────────────

const _store: PersistentMemoryEntry[] = [];
let _entrySeq = 0;

// ─── Tier classification ──────────────────────────────────────────────────────

function classifyTier(entry: PersistentMemoryEntry): MemoryTier {
  const age = Date.now() - entry.timestamp;
  if (age < TIER_THRESHOLDS_MS.hot)  return "hot";
  if (age < TIER_THRESHOLDS_MS.warm) return "warm";
  if (age < TIER_THRESHOLDS_MS.cold) return "cold";
  return "expired";
}

function updateTiers(): void {
  for (const e of _store) e.tier = classifyTier(e);
}

// ─── LRU eviction ────────────────────────────────────────────────────────────

function evictEntries(): void {
  updateTiers();
  // Evict expired first
  const beforeExpired = _store.length;
  for (let i = _store.length - 1; i >= 0; i--) {
    if (_store[i].tier === "expired") _store.splice(i, 1);
  }
  if (_store.length <= MAX_ENTRIES) return;

  // Then evict cold + low access
  const toEvict = _store
    .map((e, idx) => ({ idx, score: e.accessCount + (e.tier === "cold" ? 0 : 100) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, EVICTION_BATCH);

  for (const { idx } of toEvict.reverse()) {
    _store.splice(idx, 1);
  }
  void beforeExpired; // suppress unused warning
}

// ─── Entry construction ───────────────────────────────────────────────────────

function buildFromReply(
  reply: GenesisReply,
  category: PersistentMemoryCategory,
  isSaudi: boolean,
): PersistentMemoryEntry | null {
  const now = Date.now();
  let content = "";
  let keywords: string[] = [];

  switch (category) {
    case "thesis_snapshot":
      if (!reply.thesis && !reply.baseCase) return null;
      content = [reply.thesis, reply.baseCase, reply.committeeStance].filter(Boolean).join(" | ").slice(0, 200);
      keywords = ["thesis", reply.regime ?? "", isSaudi ? "saudi" : "global"];
      break;
    case "regime_observation":
      if (!reply.regime && !reply.macroChain) return null;
      content = `${reply.regime?.replace(/_/g, " ") ?? ""}: ${(reply.macroChain ?? "").slice(0, 120)}`;
      keywords = ["regime", reply.regime ?? "", isSaudi ? "saudi" : "global"];
      break;
    case "sector_pattern":
      if (!reply.sectorLens) return null;
      content = reply.sectorLens.slice(0, 160);
      keywords = ["sector", isSaudi ? "saudi" : "global", reply.regime ?? ""];
      break;
    case "saudi_transmission":
      if (!isSaudi || !reply.macroChain) return null;
      if (!/aramco|أرامكو|breakeven|نقطة.*التعادل|SAMA|sama/i.test(reply.macroChain)) return null;
      content = reply.macroChain.slice(0, 200);
      keywords = ["saudi", "aramco", "breakeven", "sama"];
      break;
    case "risk_pattern":
      if (!reply.secondOrderRisks && !reply.bearCase) return null;
      content = (reply.secondOrderRisks ?? reply.bearCase ?? "").slice(0, 160);
      keywords = ["risk", isSaudi ? "saudi" : "global"];
      break;
    case "allocator_lesson":
      if (!reply.committeeSynthesis?.finalStance) return null;
      content = reply.committeeSynthesis.finalStance.slice(0, 160);
      keywords = ["allocator", reply.committeeStance ?? "", isSaudi ? "saudi" : "global"];
      break;
    default:
      return null;
  }

  if (!content.trim()) return null;

  return {
    id: `pm_${++_entrySeq}_${now}`,
    category,
    content,
    keywords: keywords.filter(Boolean),
    isSaudi,
    timestamp: now,
    accessCount: 0,
    lastAccessed: now,
    tier: "hot",
    direction: reply.thesis
      ? (/صاعد|bullish|constructive|scale.in/i.test(reply.thesis ?? "") ? "bullish" :
         /هابط|bearish|defensive|avoid|reduce/i.test(reply.thesis ?? "") ? "bearish" : "neutral")
      : undefined,
    conviction: reply.confidence,
    policyStance:
      /eas|cut|pivot|تخفيف|تيسير/i.test(reply.voiceReasoning?.policy ?? "") ? "easing" :
      /tight|hike|restrictive|تشديد|رفع/i.test(reply.voiceReasoning?.policy ?? "") ? "tightening" :
      /hold|stable|ثبات/i.test(reply.voiceReasoning?.policy ?? "") ? "holding" : "unknown",
    oilSignal: isSaudi
      ? (/above|surplus|فوق|فائض|>.*80/i.test(reply.macroChain ?? "") ? "above" :
         /below|deficit|دون|عجز|<.*75/i.test(reply.macroChain ?? "") ? "below" : "near")
      : undefined,
  };
}

// ─── Relevance scoring ────────────────────────────────────────────────────────

function scoreEntryRelevance(
  entry: PersistentMemoryEntry,
  question: string,
  isSaudi: boolean,
): number {
  if (entry.tier === "expired") return 0;
  const text = question.toLowerCase();

  // Keyword match
  let score = entry.keywords.filter(k => k && text.includes(k.toLowerCase())).length;

  // Saudi affinity
  if (isSaudi && entry.isSaudi) score += 3;
  if (!isSaudi && !entry.isSaudi) score += 1;

  // Recency bonus
  if (entry.tier === "hot")  score += 2;
  if (entry.tier === "warm") score += 1;

  // Access count bonus (popular entries are more useful)
  score += Math.min(2, Math.floor(entry.accessCount / 2));

  return score;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Stores structured memory from a completed Genesis reply.
 * Auto-extracts across all relevant categories. Evicts if over capacity.
 */
export function storeMemory(reply: GenesisReply, isSaudi: boolean): number {
  const categories: PersistentMemoryCategory[] = [
    "thesis_snapshot", "regime_observation", "sector_pattern",
    "risk_pattern", "allocator_lesson",
    ...(isSaudi ? ["saudi_transmission" as PersistentMemoryCategory] : []),
  ];

  let stored = 0;
  for (const cat of categories) {
    const entry = buildFromReply(reply, cat, isSaudi);
    if (entry) { _store.push(entry); stored++; }
  }

  if (_store.length > MAX_ENTRIES) evictEntries();
  return stored;
}

/**
 * Queries the store for relevant entries. Returns up to 4 most relevant.
 * Updates access count and lastAccessed (LRU tracking).
 */
export function queryMemory(
  question: string,
  isSaudi: boolean,
  maxResults = 4,
): PersistentMemoryEntry[] {
  updateTiers();
  const scored = _store
    .map(e => ({ e, score: scoreEntryRelevance(e, question, isSaudi) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  const now = Date.now();
  const results = scored.map(x => { x.e.accessCount++; x.e.lastAccessed = now; return x.e; });
  return results;
}

/**
 * Retrieves the most recent thesis snapshot for a question type.
 * Returns null if none available or all stale.
 */
export function getLatestThesisForQuestion(
  question: string,
  isSaudi: boolean,
): PersistentMemoryEntry | null {
  updateTiers();
  const relevant = _store
    .filter(e => e.category === "thesis_snapshot" && e.tier !== "expired")
    .filter(e => isSaudi ? e.isSaudi : !e.isSaudi)
    .sort((a, b) => b.timestamp - a.timestamp);
  if (relevant.length === 0) return null;
  const best = relevant[0];
  best.accessCount++;
  best.lastAccessed = Date.now();
  return best;
}

/**
 * Builds a compact memory context block for prompt injection.
 * Only uses hot/warm tier entries.
 */
export function buildMemoryContext(
  entries: PersistentMemoryEntry[],
  lang: "ar" | "en",
): string {
  const fresh = entries.filter(e => e.tier === "hot" || e.tier === "warm");
  if (fresh.length === 0) return "";

  const ar = lang === "ar";
  const header = ar
    ? "الذاكرة المؤسسية الدائمة (أنماط من جلسات سابقة — سياق تحليلي محكوم):"
    : "Persistent institutional memory (patterns from prior sessions — governed analytical context):";

  const lines = fresh.slice(0, 3).map((e, i) => {
    const label = ar
      ? { thesis_snapshot: "أطروحة", regime_observation: "نظام", sector_pattern: "قطاعات",
          saudi_transmission: "انتقال سعودي", outcome_lesson: "درس", risk_pattern: "مخاطر",
          allocator_lesson: "درس المخصص" }[e.category]
      : e.category.replace(/_/g, " ");
    const tierNote = e.tier === "hot" ? "" : (ar ? " (أحدث بعض الشيء)" : " (slightly older)");
    return `${i + 1}. [${label}${tierNote}] ${e.content.slice(0, 120)}`;
  });

  const rule = ar
    ? "هذه الذاكرة تُعلم، لا تُحدد. البيانات الحية تتقدم دائماً. لا تُقدّم الذاكرة كحقيقة راهنة."
    : "This memory informs, it does not determine. Live data always takes precedence. Do not present memory as current fact.";

  return [header, ...lines, rule].join("\n");
}

/** Exports the full store state for potential external persistence. */
export function exportMemoryState(): MemoryExport {
  updateTiers();
  return {
    version: 1,
    exportedAt: Date.now(),
    entries: _store.filter(e => e.tier !== "expired"),
  };
}

/** Imports a previously exported state (e.g., on server restart). */
export function importMemoryState(data: MemoryExport): number {
  if (!data?.entries?.length) return 0;
  const now = Date.now();
  let imported = 0;
  for (const e of data.entries) {
    // Re-classify tier based on current time
    const age = now - e.timestamp;
    if (age < TIER_THRESHOLDS_MS.cold) {
      e.tier = classifyTier(e);
      _store.push(e);
      imported++;
    }
  }
  if (_store.length > MAX_ENTRIES) evictEntries();
  return imported;
}

/** Returns store health stats for logging (no sensitive data). */
export function getMemoryHealth(): string {
  updateTiers();
  const hot  = _store.filter(e => e.tier === "hot").length;
  const warm = _store.filter(e => e.tier === "warm").length;
  const cold = _store.filter(e => e.tier === "cold").length;
  return `total=${_store.length} hot=${hot} warm=${warm} cold=${cold} capacity=${MAX_ENTRIES}`;
}
