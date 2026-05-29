// Phase-85A: Memory Lifecycle Governor
// Pure deterministic functions — no AI calls, no network, O(1) amortised.
//
// Enforces governed memory health across the institutional memory pipeline:
//   • Tier enforcement (hot/warm/cold/expired) with time-aware classification
//   • Confidence decay: different decay rates per category
//   • Contradiction detection: entries with opposite direction for same context
//   • Duplicate suppression: near-identical keyword overlap pruned
//   • Bounded growth: eviction priority — expired → contradicted-old → cold-low-access
//
// Called by durableInstitutionalMemory before save and before query.
// All functions are pure and operate on copies — no in-place mutation.
//
// No secrets. No PII. No broker data.

import type { PersistentMemoryEntry, PersistentMemoryCategory, MemoryTier } from "./persistentMemoryStore";

// ─── Constants ─────────────────────────────────────────────────────────────────

const TIER_AGES_MS: Record<MemoryTier, number> = {
  hot:     20 * 60 * 1000,
  warm:    60 * 60 * 1000,
  cold:    3  * 60 * 60 * 1000,
  expired: Infinity,
};

// Decay half-lives per category (ms): faster for regime/sector, slower for historical
const DECAY_HALF_LIVES: Record<PersistentMemoryCategory, number> = {
  thesis_snapshot:    90 * 60 * 1000,   // 90 min
  regime_observation: 45 * 60 * 1000,   // 45 min (regime shifts)
  sector_pattern:     60 * 60 * 1000,   // 60 min
  saudi_transmission: 75 * 60 * 1000,   // 75 min (slower: fiscal patterns stable)
  outcome_lesson:     120 * 60 * 1000,  // 2h (learning persists longer)
  risk_pattern:       60 * 60 * 1000,   // 60 min
  allocator_lesson:   90 * 60 * 1000,   // 90 min
};

const DUPLICATE_KEYWORD_OVERLAP_THRESHOLD = 0.70; // 70% keyword overlap → duplicate
const CONTRADICTION_MIN_SCORE = 2;               // minimum score to trigger contradiction
const MAX_ENTRIES_HARD = 80;
const EVICTION_BATCH = 12;

// ─── Tier classification ──────────────────────────────────────────────────────

export function classifyTier(entry: PersistentMemoryEntry, now = Date.now()): MemoryTier {
  const age = now - entry.timestamp;
  if (age < TIER_AGES_MS.hot)  return "hot";
  if (age < TIER_AGES_MS.warm) return "warm";
  if (age < TIER_AGES_MS.cold) return "cold";
  return "expired";
}

export function applyTierClassification(entries: PersistentMemoryEntry[]): PersistentMemoryEntry[] {
  const now = Date.now();
  return entries.map(e => ({ ...e, tier: classifyTier(e, now) }));
}

// ─── Confidence decay ─────────────────────────────────────────────────────────

/**
 * Returns decayed conviction score (0-100) based on entry age and category.
 * Uses exponential decay: C(t) = C0 × exp(-λt)  where λ = ln(2) / half_life
 */
export function decayedConviction(entry: PersistentMemoryEntry, now = Date.now()): number {
  if (entry.conviction === undefined) return 50;
  const halfLife = DECAY_HALF_LIVES[entry.category] ?? 60 * 60 * 1000;
  const age = now - entry.timestamp;
  const lambda = Math.LN2 / halfLife;
  return Math.max(10, Math.round(entry.conviction * Math.exp(-lambda * age)));
}

// ─── Contradiction detection ─────────────────────────────────────────────────

/**
 * Identifies pairs of entries that are likely contradicting each other:
 * same isSaudi flag + opposite direction + similar keywords.
 * Returns indices of the OLDER entry in each contradicting pair.
 */
export function detectContradictions(entries: PersistentMemoryEntry[]): Set<number> {
  const toEvict = new Set<number>();
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (a.isSaudi !== b.isSaudi) continue;
      if (!a.direction || !b.direction) continue;
      const oppositeDir =
        (a.direction === "bullish" && b.direction === "bearish") ||
        (a.direction === "bearish" && b.direction === "bullish");
      if (!oppositeDir) continue;
      // Check for shared keywords (same domain)
      const sharedKw = a.keywords.filter(k => b.keywords.includes(k)).length;
      if (sharedKw >= CONTRADICTION_MIN_SCORE) {
        // Evict older entry
        toEvict.add(a.timestamp < b.timestamp ? i : j);
      }
    }
  }
  return toEvict;
}

// ─── Duplicate suppression ────────────────────────────────────────────────────

/**
 * Returns indices of duplicate entries (same category + high keyword overlap).
 * Keeps the newer entry.
 */
export function detectDuplicates(entries: PersistentMemoryEntry[]): Set<number> {
  const toEvict = new Set<number>();
  for (let i = 0; i < entries.length; i++) {
    if (toEvict.has(i)) continue;
    for (let j = i + 1; j < entries.length; j++) {
      if (toEvict.has(j)) continue;
      const a = entries[i];
      const b = entries[j];
      if (a.category !== b.category) continue;
      if (a.isSaudi !== b.isSaudi) continue;
      // Keyword overlap
      const kwA = new Set(a.keywords.map(k => k.toLowerCase()));
      const kwB = b.keywords.map(k => k.toLowerCase());
      const overlap = kwB.filter(k => kwA.has(k)).length;
      const unionSize = Math.max(kwA.size, 1);
      if (overlap / unionSize >= DUPLICATE_KEYWORD_OVERLAP_THRESHOLD) {
        // Evict older
        toEvict.add(a.timestamp < b.timestamp ? i : j);
      }
    }
  }
  return toEvict;
}

// ─── Bounded growth enforcement ──────────────────────────────────────────────

interface EvictionScore {
  idx: number;
  score: number;  // lower = evict first
}

function evictionPriority(entry: PersistentMemoryEntry, now: number): number {
  const tier = classifyTier(entry, now);
  const tierScore = tier === "hot" ? 100 : tier === "warm" ? 60 : tier === "cold" ? 20 : 0;
  const accessScore = Math.min(30, entry.accessCount * 5);
  return tierScore + accessScore;
}

/**
 * Trims entries to maxSize using priority-based eviction.
 * Eviction order: expired → contradicted-old → cold+low-access → warm+low-access
 */
export function enforceMemoryBounds(
  entries: PersistentMemoryEntry[],
  maxSize = MAX_ENTRIES_HARD,
): PersistentMemoryEntry[] {
  if (entries.length <= maxSize) return entries;

  const now = Date.now();
  const withTier = applyTierClassification(entries);

  // First pass: remove expired
  let result = withTier.filter(e => e.tier !== "expired");
  if (result.length <= maxSize) return result;

  // Second pass: remove contradictions
  const contradictionIdx = detectContradictions(result);
  result = result.filter((_, i) => !contradictionIdx.has(i));
  if (result.length <= maxSize) return result;

  // Third pass: score-based eviction
  const scored: EvictionScore[] = result.map((e, idx) => ({
    idx,
    score: evictionPriority(e, now),
  })).sort((a, b) => a.score - b.score);

  const toRemove = new Set(
    scored.slice(0, Math.ceil(result.length - maxSize + EVICTION_BATCH / 2))
          .map(s => s.idx),
  );
  return result.filter((_, i) => !toRemove.has(i));
}

// ─── Full governance pass ─────────────────────────────────────────────────────

export interface GovernanceReport {
  inputCount:       number;
  outputCount:      number;
  expired:          number;
  contradictions:   number;
  duplicates:       number;
  evicted:          number;
}

/**
 * Applies the full lifecycle governance pipeline to a set of entries.
 * Returns a clean, bounded, contradiction-free set.
 * Pure — does not mutate input.
 */
export function applyLifecycleGovernance(
  entries: PersistentMemoryEntry[],
  maxSize = MAX_ENTRIES_HARD,
): { entries: PersistentMemoryEntry[]; report: GovernanceReport } {
  const inputCount = entries.length;
  let working = applyTierClassification(entries);

  // Remove expired
  const expiredCount = working.filter(e => e.tier === "expired").length;
  working = working.filter(e => e.tier !== "expired");

  // Remove duplicates
  const dupIdx = detectDuplicates(working);
  const dupCount = dupIdx.size;
  working = working.filter((_, i) => !dupIdx.has(i));

  // Remove contradictions
  const contraIdx = detectContradictions(working);
  const contraCount = contraIdx.size;
  working = working.filter((_, i) => !contraIdx.has(i));

  // Enforce bounds
  const beforeBounds = working.length;
  working = enforceMemoryBounds(working, maxSize);
  const evictedCount = Math.max(0, beforeBounds - working.length);

  return {
    entries: working,
    report: {
      inputCount,
      outputCount:    working.length,
      expired:        expiredCount,
      contradictions: contraCount,
      duplicates:     dupCount,
      evicted:        evictedCount,
    },
  };
}

// ─── Query filter ─────────────────────────────────────────────────────────────

/**
 * Filters entries for query use: only hot/warm, sorted by access recency.
 * Applies confidence decay to the conviction field before returning.
 */
export function filterForQuery(
  entries: PersistentMemoryEntry[],
  maxResults = 4,
): PersistentMemoryEntry[] {
  const now = Date.now();
  return entries
    .filter(e => e.tier === "hot" || e.tier === "warm")
    .map(e => ({ ...e, conviction: decayedConviction(e, now) }))
    .sort((a, b) => b.lastAccessed - a.lastAccessed)
    .slice(0, maxResults);
}
