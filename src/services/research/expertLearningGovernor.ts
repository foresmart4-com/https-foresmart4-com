// Phase-85D: Expert Learning Governor
// Pure deterministic functions — no AI calls, no network, O(1) per call.
//
// Self-improving expert cognition through bounded adaptive weighting.
// Maintains a process-level ring buffer of CognitiveFeedbackRecord entries
// and derives adjusted weights for thinkers, schools, and playbooks.
//
// BOUNDED ADAPTATION — strict governance rules:
//   - Weight range: 0.80 ≤ weight ≤ 1.20 (±20% of baseline 1.00)
//   - Minimum samples: 5 records before any adjustment
//   - Decay: weights decay toward 1.00 with 8-hour half-life
//   - Ring buffer: max 60 records (oldest evicted)
//   - NO self-modifying code: base profiles never change, only multipliers
//
// Weight formula (after minimum samples):
//   usefulness = count(contribution ≥ 50) / total appearances
//   rawAdjust = usefulness × 0.40 (max ±0.20 range over [0,1] usefulness)
//   weight = 0.80 + rawAdjust × 2 → range [0.80, 1.20]
//   After time-decay: w(t) = 1.0 + (w - 1.0) × exp(-λ × age)
//
// ExpertWeights: map of { [id: string]: number } where 1.0 = baseline.
// Used by adaptivePlaybookRanking and detectRelevantThinkers/Schools.
//
// No secrets. No PII. No broker data. Educational/advisory only.

import type { CognitiveFeedbackRecord } from "./cognitiveFeedbackEngine";

// ─── Constants ─────────────────────────────────────────────────────────────────

const RING_BUFFER_MAX    = 60;
const MIN_SAMPLES        = 5;
const WEIGHT_MIN         = 0.80;
const WEIGHT_MAX         = 1.20;
const CONTRIBUTION_FLOOR = 50;    // contributions ≥ this count as "useful"
const DECAY_HALF_LIFE_MS = 8 * 60 * 60 * 1000;  // 8 hours

// ─── State ────────────────────────────────────────────────────────────────────

const _feedbackBuffer: CognitiveFeedbackRecord[] = [];

// Cache: recomputed lazily when buffer changes
let _weightCache: Record<string, number> | null = null;
let _lastCacheTimestamp = 0;
const CACHE_TTL_MS = 30_000;  // 30 second weight cache

// ─── Ring buffer management ───────────────────────────────────────────────────

export function recordFeedback(record: CognitiveFeedbackRecord): void {
  _feedbackBuffer.push(record);
  if (_feedbackBuffer.length > RING_BUFFER_MAX) {
    _feedbackBuffer.shift();  // evict oldest
  }
  _weightCache = null;  // invalidate cache
}

export function getFeedbackBufferSize(): number {
  return _feedbackBuffer.length;
}

export function clearFeedbackBuffer(): void {
  _feedbackBuffer.length = 0;
  _weightCache = null;
}

// ─── Weight computation ────────────────────────────────────────────────────────

function exponentialDecay(weight: number, ageMs: number): number {
  if (weight === 1.0) return 1.0;
  const lambda = Math.LN2 / DECAY_HALF_LIFE_MS;
  const deviation = weight - 1.0;
  return 1.0 + deviation * Math.exp(-lambda * ageMs);
}

function computeWeightsFromBuffer(now: number): Record<string, number> {
  // Aggregate per-id statistics
  const stats: Record<string, { appearances: number; useful: number; lastSeen: number }> = {};

  for (const record of _feedbackBuffer) {
    const age = now - record.timestamp;
    if (age > 24 * 60 * 60 * 1000) continue;  // ignore records older than 24h

    const ageDecayFactor = Math.exp(-Math.LN2 / DECAY_HALF_LIFE_MS * age);

    // Thinkers
    for (const id of record.activatedThinkerIds) {
      if (!stats[id]) stats[id] = { appearances: 0, useful: 0, lastSeen: 0 };
      stats[id].appearances += 1;
      const ps = record.pieceScores.find(p => p.ids.includes(id));
      if (ps && ps.actualContribution >= CONTRIBUTION_FLOOR) {
        stats[id].useful += ageDecayFactor;
      }
      stats[id].lastSeen = Math.max(stats[id].lastSeen, record.timestamp);
    }

    // Schools
    for (const id of record.activatedSchoolIds) {
      if (!stats[id]) stats[id] = { appearances: 0, useful: 0, lastSeen: 0 };
      stats[id].appearances += 1;
      const ps = record.pieceScores.find(p => p.ids.includes(id));
      if (ps && ps.actualContribution >= CONTRIBUTION_FLOOR) {
        stats[id].useful += ageDecayFactor;
      }
      stats[id].lastSeen = Math.max(stats[id].lastSeen, record.timestamp);
    }

    // Playbook
    if (record.activatedPlaybookId) {
      const id = record.activatedPlaybookId;
      if (!stats[id]) stats[id] = { appearances: 0, useful: 0, lastSeen: 0 };
      stats[id].appearances += 1;
      if (record.cognitiveContributionScore >= CONTRIBUTION_FLOOR) {
        stats[id].useful += ageDecayFactor;
      }
      stats[id].lastSeen = Math.max(stats[id].lastSeen, record.timestamp);
    }
  }

  const weights: Record<string, number> = {};

  for (const [id, s] of Object.entries(stats)) {
    if (s.appearances < MIN_SAMPLES) {
      weights[id] = 1.0;  // insufficient data — baseline
      continue;
    }

    const usefulnessRatio = Math.min(1, s.useful / s.appearances);
    // Map [0,1] usefulness → [WEIGHT_MIN, WEIGHT_MAX]
    const rawWeight = WEIGHT_MIN + usefulnessRatio * (WEIGHT_MAX - WEIGHT_MIN);

    // Apply time decay toward 1.0 based on age of last observation
    const ageMs = now - s.lastSeen;
    const decayed = exponentialDecay(rawWeight, ageMs);

    weights[id] = Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, Math.round(decayed * 1000) / 1000));
  }

  return weights;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns current expert weights. Cached for 30s.
 * Call before thinker/school/playbook detection to apply learned preferences.
 */
export function getExpertWeights(): Record<string, number> {
  const now = Date.now();

  if (_weightCache && now - _lastCacheTimestamp < CACHE_TTL_MS) {
    return _weightCache;
  }

  _weightCache = computeWeightsFromBuffer(now);
  _lastCacheTimestamp = now;
  return _weightCache;
}

/**
 * Returns a human-readable summary of current weight adaptations.
 * Used for logging/diagnostics only.
 */
export function getAdaptationSummary(): string {
  const weights = getExpertWeights();
  const adapted = Object.entries(weights)
    .filter(([, w]) => Math.abs(w - 1.0) > 0.05)
    .map(([id, w]) => `${id}=${w.toFixed(2)}`)
    .join(", ");

  return adapted
    ? `expert-weights: ${adapted} (buffer=${_feedbackBuffer.length}/${RING_BUFFER_MAX})`
    : `expert-weights: all baseline (buffer=${_feedbackBuffer.length}/${RING_BUFFER_MAX})`;
}

/**
 * Fire-and-forget: record feedback after AI reply without blocking response path.
 * Never throws — errors are swallowed silently.
 */
export function recordFeedbackBackground(record: CognitiveFeedbackRecord): void {
  try {
    recordFeedback(record);
  } catch {
    // swallow silently — learning failure must never affect response delivery
  }
}
