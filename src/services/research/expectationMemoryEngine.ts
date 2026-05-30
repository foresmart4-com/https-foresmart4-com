// Phase-87B: Expectation Memory Engine — durable persistence added
// Phase-87A: base engine (pure deterministic, O(1) per call)
//
// Phase-87B adds:
//   loadExpectationHistory()            — lazy load from Supabase Storage on first investment call
//   saveExpectationHistoryBackground()  — fire-and-forget save after each reply
//
// Storage: genesis-memory bucket, path genesis/v1/expectation-history.json
// Bounded: max 50 entries (vs 30 process-level buffer)
// Restart-safe: ring buffer is populated from storage on first load
// Fiduciary-safe: no PII, no personal financial data, no question text
// Pattern mirrors durableInstitutionalMemory.ts (Phase-85A).
//
// Phase-87A: Expectation Memory Engine
// Pure deterministic functions — no AI calls, no network, O(1) per call.
//
// Fixes the single-call policy surprise model in policyExpectationModel.ts
// which treats all reversed expectations equally regardless of how long
// that expectation was held.
//
// Long-held expectations that are reversed are MORE significant than
// recently-formed expectations — this is empirically true in financial markets.
// A consensus that has held for months produces larger repricing than a
// one-week expectation flip.
//
// Approach: TEXT-BASED inference of expectation duration and consensus strength.
// No external data. No polling. Stateless primary path.
//
// Optional bounded ring buffer (max 30 entries) for cross-call persistence.
// Ring buffer stores lightweight expectation fingerprints, not question text.
//
// Duration cues detected from question/context text:
//   long (4+ months):   "for months", "all year", "throughout Q3/H1/2024", "since [quarter]",
//                        "long-standing", "persistent", "entrenched", "deeply priced"
//   medium (4-10 weeks): "for weeks", "recently", "past few weeks", "over the past month"
//   short (< 2 weeks):   "just", "recently shifted", "new expectation", "this week", "yesterday"
//   unknown:             no duration cue detected
//
// Consensus strength cues:
//   strong:  "unanimous", "overwhelming", "broad consensus", "widely expected",
//            "market consensus", "all", "everyone expects", "universal"
//   moderate: "most", "largely", "generally", "broad", "consensus"
//   weak:    "divided", "split", "uncertain", "mixed", "some expect", "debated"
//   unknown: no cue detected
//
// persistenceScore (0-100):
//   duration × 0.6 + consensus × 0.4
//   Long + strong consensus = 90; Short + weak = 15.
//
// Delta amplification in policyExpectationModel:
//   adjustedDelta = base × (1 + persistenceScore / 200)
//   Maximum amplification: +50% for highest persistence.
//
// Bounded. No secrets. No PII. Educational/advisory only.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ExpectationDuration = "long" | "medium" | "short" | "unknown";
export type ConsensusStrength   = "strong" | "moderate" | "weak" | "unknown";

export interface ExpectationPersistenceResult {
  duration:            ExpectationDuration;
  durationScore:       number;  // 0-100
  consensusStrength:   ConsensusStrength;
  consensusScore:      number;  // 0-100
  persistenceScore:    number;  // 0-100: composite
  amplificationFactor: number;  // 1.0-1.50
}

// Optional ring-buffer entry (lightweight — no question text stored)
interface ExpectationRecord {
  timestamp:      number;
  expectedRegime: string;
  questionHash:   string;  // first 8 chars of question (not PII)
}

const _buffer: ExpectationRecord[] = [];
const BUFFER_MAX = 30;

// ─── Duration detection ───────────────────────────────────────────────────────

const LONG_DURATION_PATTERNS: RegExp[] = [
  /\b(for months|all year|throughout (Q[1-4]|H[12]|20\d\d)|since (Q[1-4]|H[12]|January|February|March|April|May|June|July|August|September|October|November|December))\b/i,
  /\b(long.standing|long.held|persistent|entrenched|deeply priced|firmly (held|priced|expected))\b/i,
  /\b(months of (pricing|expecting|consensus)|year.long|multi.month)\b/i,
];

const MEDIUM_DURATION_PATTERNS: RegExp[] = [
  /\b(for (several )?weeks|past (few )?weeks|over the past month|in recent weeks|last (few )?weeks)\b/i,
  /\b(weeks of (pricing|expecting)|monthly)\b/i,
];

const SHORT_DURATION_PATTERNS: RegExp[] = [
  /\b(just|this week|yesterday|last (few )?days|recently (shifted|changed|pivoted)|new (expectation|consensus))\b/i,
  /\b(sudden|abrupt|surprise (shift|change|reversal))\b/i,
];

function detectDuration(text: string): { duration: ExpectationDuration; score: number } {
  if (LONG_DURATION_PATTERNS.some(p => p.test(text)))
    return { duration: "long", score: 90 };
  if (MEDIUM_DURATION_PATTERNS.some(p => p.test(text)))
    return { duration: "medium", score: 55 };
  if (SHORT_DURATION_PATTERNS.some(p => p.test(text)))
    return { duration: "short", score: 20 };
  return { duration: "unknown", score: 35 };  // default: moderate duration assumption
}

// ─── Consensus strength detection ────────────────────────────────────────────

const STRONG_CONSENSUS_PATTERNS: RegExp[] = [
  /\b(unanimous|overwhelming|broad consensus|widely expected|market consensus|universal|all (market|analyst|investor)s?|everyone expects?)\b/i,
  /\b(fully priced|completely priced|100% priced|strong consensus|entrenched (view|belief|expectation))\b/i,
];

const MODERATE_CONSENSUS_PATTERNS: RegExp[] = [
  /\b(most (market|analyst|investor|participant)s?|largely (expected|priced)|generally (expected|anticipated)|broad(ly)? (expected|priced))\b/i,
  /\b(consensus (is|was|has been)|widely (anticipated|expected|priced)|majority)\b/i,
];

const WEAK_CONSENSUS_PATTERNS: RegExp[] = [
  /\b(divided|split|uncertain|mixed (view|expectation|signal)|some expect|debated|not (fully |)priced|tentative|contested)\b/i,
  /\b(50.50|coin flip|no consensus|disagreement|bifurcated)\b/i,
];

function detectConsensus(text: string): { strength: ConsensusStrength; score: number } {
  if (STRONG_CONSENSUS_PATTERNS.some(p => p.test(text)))
    return { strength: "strong", score: 90 };
  if (MODERATE_CONSENSUS_PATTERNS.some(p => p.test(text)))
    return { strength: "moderate", score: 60 };
  if (WEAK_CONSENSUS_PATTERNS.some(p => p.test(text)))
    return { strength: "weak", score: 20 };
  return { strength: "unknown", score: 40 };
}

// ─── Ring buffer helpers ──────────────────────────────────────────────────────

export function recordExpectation(
  expectedRegime: string,
  question: string,
): void {
  const entry: ExpectationRecord = {
    timestamp:      Date.now(),
    expectedRegime,
    questionHash:   question.slice(0, 8),
  };
  _buffer.push(entry);
  if (_buffer.length > BUFFER_MAX) _buffer.shift();
}

/** Returns whether the given expectation has appeared in recent buffer (cross-call persistence) */
export function checkExpectationPersisted(expectedRegime: string, withinMs = 30 * 60_000): boolean {
  const cutoff = Date.now() - withinMs;
  return _buffer.some(e => e.expectedRegime === expectedRegime && e.timestamp >= cutoff);
}

export function clearExpectationBuffer(): void { _buffer.length = 0; }
export function getExpectationBufferSize(): number { return _buffer.length; }

// ─── Phase-87B: Durable persistence ──────────────────────────────────────────
// Same governed pattern as durableInstitutionalMemory.ts (Phase-85A).
// Storage: genesis-memory bucket, genesis/v1/expectation-history.json
// Bounded: DURABLE_MAX entries. No PII. No question text. Fire-and-forget saves.

const BUCKET_NAME    = "genesis-memory";
const EXPECTATION_PATH = "genesis/v1/expectation-history.json";
const DURABLE_MAX    = 50;

type DurableStorageStatus = "untested" | "available" | "unavailable";
let _durableStatus: DurableStorageStatus = "untested";
let _durableLoadedOnce = false;
let _durableLoadedAt   = 0;
const RELOAD_COOLDOWN_MS = 10 * 60 * 1000;

interface DurableExpectationHistory {
  records: ExpectationRecord[];
  savedAt: number;
}

async function _storageDownload(): Promise<ExpectationRecord[] | null> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .download(EXPECTATION_PATH);
    if (error || !data) return null;
    const parsed = JSON.parse(await data.text()) as DurableExpectationHistory;
    return Array.isArray(parsed?.records) ? parsed.records : null;
  } catch {
    return null;
  }
}

async function _storageUpload(records: ExpectationRecord[]): Promise<boolean> {
  try {
    const payload: DurableExpectationHistory = { records, savedAt: Date.now() };
    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(EXPECTATION_PATH, JSON.stringify(payload), {
        contentType: "application/json",
        upsert: true,
      });
    if (error) {
      console.warn(`[expectation-memory] upload failed: ${error.message}`);
      return false;
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[expectation-memory] upload exception: ${msg}`);
    return false;
  }
}

/**
 * Lazily loads expectation history from Supabase Storage into the process-level
 * ring buffer. Called once per process on the first investment call.
 * Gracefully degrades when storage is unavailable.
 */
export async function loadExpectationHistory(): Promise<void> {
  const now = Date.now();
  if (_durableLoadedOnce && now - _durableLoadedAt < RELOAD_COOLDOWN_MS) return;
  _durableLoadedAt   = now;
  _durableLoadedOnce = true;
  if (_durableStatus === "unavailable") return;

  try {
    const records = await _storageDownload();
    if (records && records.length > 0) {
      // Merge into ring buffer, bounded by DURABLE_MAX, newest first
      const cutoff = now - 24 * 60 * 60 * 1000; // 24h retention for expectations
      const fresh  = records.filter(r => r.timestamp >= cutoff).slice(-DURABLE_MAX);
      for (const r of fresh) {
        if (!_buffer.some(b => b.questionHash === r.questionHash && b.expectedRegime === r.expectedRegime)) {
          _buffer.push(r);
        }
      }
      while (_buffer.length > BUFFER_MAX) _buffer.shift();
      console.log(`[expectation-memory] loaded durable history: ${fresh.length} records merged`);
    }
    _durableStatus = "available";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (_durableStatus !== "unavailable") {
      console.warn(`[expectation-memory] durable storage unavailable: ${msg}`);
    }
    _durableStatus = "unavailable";
  }
}

/**
 * Fire-and-forget save of current ring buffer to Supabase Storage.
 * Called after each investment reply. Never awaited on main path.
 */
export function saveExpectationHistoryBackground(): void {
  if (_durableStatus === "unavailable" || _buffer.length === 0) return;
  _saveExpectationHistory().catch(err => {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[expectation-memory] background save failed: ${msg}`);
    _durableStatus = "unavailable";
  });
}

async function _saveExpectationHistory(): Promise<void> {
  // Keep only recent entries (24h) and cap at DURABLE_MAX
  const cutoff  = Date.now() - 24 * 60 * 60 * 1000;
  const records = _buffer
    .filter(r => r.timestamp >= cutoff)
    .slice(-DURABLE_MAX);
  const ok = await _storageUpload(records);
  if (ok) {
    _durableStatus = "available";
    console.log(`[expectation-memory] saved durable history: ${records.length} records`);
  }
}

export function getExpectationStorageStatus(): DurableStorageStatus {
  return _durableStatus;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeExpectationPersistence(
  question: string,
  ctx: string,
  expectedRegime?: string,
): ExpectationPersistenceResult {
  const text = `${question} ${ctx}`;

  const { duration, score: durationScore }   = detectDuration(text);
  const { strength, score: consensusScore }  = detectConsensus(text);

  // Cross-call bonus: if same expectation appeared recently in buffer → duration boost
  let adjustedDurationScore = durationScore;
  if (expectedRegime && checkExpectationPersisted(expectedRegime)) {
    adjustedDurationScore = Math.min(90, durationScore + 20);
  }

  const persistenceScore = Math.round(adjustedDurationScore * 0.6 + consensusScore * 0.4);

  // Amplification: 1.0 (min) to 1.50 (max at persistenceScore=100)
  const amplificationFactor = 1.0 + (persistenceScore / 200);

  // Store in ring buffer for cross-call awareness
  if (expectedRegime) {
    recordExpectation(expectedRegime, question);
  }

  return {
    duration,
    durationScore:    adjustedDurationScore,
    consensusStrength: strength,
    consensusScore,
    persistenceScore,
    amplificationFactor,
  };
}
