// Phase-84B: Adaptive Calibration Engine
// Pure deterministic functions — no AI calls, no network, O(1) amortised.
//
// Purpose: Track the history of governor decisions and validation scores,
// then suggest BOUNDED weight adjustments to improve governor accuracy over time.
//
// Conservative by design:
//   - Adjustments only when 5+ consistent calls support the change
//   - Maximum adjustment per dimension: ±0.03 per calibration cycle
//   - Default weights restored if calibration history is thin
//   - No self-modifying code: adjustments are suggestions, not forced overrides
//   - All weights clamped to [0.10, 0.40] — no dimension can dominate or vanish
//
// Bounded adaptation: the engine CAN'T make the governor fail-unsafe.
// If in doubt, it returns the default conservative weights.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalibrationRecord {
  timestamp: number;
  promptType: string;
  governorDecision: string;              // allow/repair_required/insufficient_evidence/stale_memory_warning
  compositeScore: number;
  validationScore: number;
  judgmentScore: number;
  depthScore: number;
  knowledgeScore: number;
  repairApplied: boolean;
  isSaudi: boolean;
}

export interface GovernorWeights {
  validationHarness: number;   // default 0.30
  judgmentScore:     number;   // default 0.28
  depthRulesScore:   number;   // default 0.25
  knowledgeUseScore: number;   // default 0.17
}

export interface CalibrationState {
  weights: GovernorWeights;
  callCount: number;
  repairRate: number;           // 0-1: fraction of calls that needed repair
  insufficientRate: number;     // 0-1: fraction that were insufficient
  passRate: number;             // 0-1: fraction that passed on first try
  calibrationQuality: "stable" | "adapting" | "insufficient_data";
  calibrationNote: string;      // log-safe description
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS: GovernorWeights = {
  validationHarness: 0.30,
  judgmentScore:     0.28,
  depthRulesScore:   0.25,
  knowledgeUseScore: 0.17,
};

const WEIGHT_BOUNDS = { min: 0.10, max: 0.40 };
const MAX_ADJUSTMENT_PER_CYCLE = 0.03;
const MIN_CALLS_FOR_ADAPTATION = 5;
const HISTORY_WINDOW = 30;   // rolling window of last N investment calls

// ─── Process-level calibration store ─────────────────────────────────────────

const _history: CalibrationRecord[] = [];

// ─── Record management ────────────────────────────────────────────────────────

/**
 * Records the outcome of a governor evaluation for future calibration.
 */
export function recordCalibrationResult(record: CalibrationRecord): void {
  _history.push(record);
  // Keep only last HISTORY_WINDOW records
  if (_history.length > HISTORY_WINDOW) {
    _history.shift();
  }
}

// ─── Statistics computation ───────────────────────────────────────────────────

function computeStats(records: CalibrationRecord[]) {
  if (records.length === 0) return null;
  const total = records.length;
  const repairCount = records.filter(r => r.repairApplied).length;
  const insufficientCount = records.filter(r => r.governorDecision === "insufficient_evidence").length;
  const passCount = records.filter(r => r.governorDecision === "allow" && !r.repairApplied).length;

  const avgValidation = records.reduce((s, r) => s + r.validationScore, 0) / total;
  const avgJudgment   = records.reduce((s, r) => s + r.judgmentScore, 0) / total;
  const avgDepth      = records.reduce((s, r) => s + r.depthScore, 0) / total;
  const avgKnowledge  = records.reduce((s, r) => s + r.knowledgeScore, 0) / total;

  return {
    total, repairCount, insufficientCount, passCount,
    repairRate: repairCount / total,
    insufficientRate: insufficientCount / total,
    passRate: passCount / total,
    avgValidation, avgJudgment, avgDepth, avgKnowledge,
  };
}

// ─── Weight adjustment logic ──────────────────────────────────────────────────
// Conservative bounded adaptation: if a dimension consistently scores low,
// reduce its weight slightly (so it doesn't pull the composite down unfairly).
// If a dimension consistently scores high and repairs are happening anyway,
// the deeper dimensions (depth, judgment) might need more weight.

function computeAdjustedWeights(stats: NonNullable<ReturnType<typeof computeStats>>): GovernorWeights {
  const w = { ...DEFAULT_WEIGHTS };

  if (stats.total < MIN_CALLS_FOR_ADAPTATION) return w;

  // Rule 1: If validation is consistently high (>80) but repair rate is still high,
  // reduce validation weight slightly and increase judgment weight.
  if (stats.avgValidation > 80 && stats.repairRate > 0.3) {
    w.validationHarness = Math.max(WEIGHT_BOUNDS.min, w.validationHarness - MAX_ADJUSTMENT_PER_CYCLE);
    w.judgmentScore     = Math.min(WEIGHT_BOUNDS.max, w.judgmentScore + MAX_ADJUSTMENT_PER_CYCLE);
  }

  // Rule 2: If knowledge scores are consistently low (<60), reduce knowledge weight
  // slightly (can't penalise heavily for structural gaps) and give depth more weight.
  if (stats.avgKnowledge < 60 && stats.avgKnowledge > 0) {
    w.knowledgeUseScore = Math.max(WEIGHT_BOUNDS.min, w.knowledgeUseScore - MAX_ADJUSTMENT_PER_CYCLE);
    w.depthRulesScore   = Math.min(WEIGHT_BOUNDS.max, w.depthRulesScore + MAX_ADJUSTMENT_PER_CYCLE);
  }

  // Rule 3: If insufficient_evidence rate is high (>20%), the composite threshold
  // may be too strict for current answer quality — reduce depth weight slightly.
  if (stats.insufficientRate > 0.20) {
    w.depthRulesScore = Math.max(WEIGHT_BOUNDS.min, w.depthRulesScore - (MAX_ADJUSTMENT_PER_CYCLE / 2));
    w.judgmentScore   = Math.min(WEIGHT_BOUNDS.max, w.judgmentScore   + (MAX_ADJUSTMENT_PER_CYCLE / 2));
  }

  // Normalise: weights must sum to 1.0
  const sum = w.validationHarness + w.judgmentScore + w.depthRulesScore + w.knowledgeUseScore;
  if (Math.abs(sum - 1.0) > 0.001) {
    const factor = 1.0 / sum;
    w.validationHarness *= factor;
    w.judgmentScore     *= factor;
    w.depthRulesScore   *= factor;
    w.knowledgeUseScore *= factor;
  }

  return w;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the current calibrated governor weights.
 * If insufficient history, returns the safe default weights.
 * Pure O(1) relative to HISTORY_WINDOW size.
 */
export function getCalibrationState(): CalibrationState {
  const stats = computeStats(_history);

  if (!stats || stats.total < MIN_CALLS_FOR_ADAPTATION) {
    return {
      weights: { ...DEFAULT_WEIGHTS },
      callCount: _history.length,
      repairRate: stats?.repairRate ?? 0,
      insufficientRate: stats?.insufficientRate ?? 0,
      passRate: stats?.passRate ?? 0,
      calibrationQuality: "insufficient_data",
      calibrationNote: `not enough data (${_history.length}/${MIN_CALLS_FOR_ADAPTATION} calls) — using default weights`,
    };
  }

  const weights = computeAdjustedWeights(stats);
  const isAdapting =
    Math.abs(weights.validationHarness - DEFAULT_WEIGHTS.validationHarness) > 0.005 ||
    Math.abs(weights.judgmentScore     - DEFAULT_WEIGHTS.judgmentScore)     > 0.005;

  const calibrationNote = `calls=${stats.total} pass=${(stats.passRate * 100).toFixed(0)}% repair=${(stats.repairRate * 100).toFixed(0)}% insufficient=${(stats.insufficientRate * 100).toFixed(0)}% weights=v${weights.validationHarness.toFixed(2)}/j${weights.judgmentScore.toFixed(2)}/d${weights.depthRulesScore.toFixed(2)}/k${weights.knowledgeUseScore.toFixed(2)}`;

  return {
    weights,
    callCount: stats.total,
    repairRate: stats.repairRate,
    insufficientRate: stats.insufficientRate,
    passRate: stats.passRate,
    calibrationQuality: isAdapting ? "adapting" : "stable",
    calibrationNote,
  };
}

/**
 * Returns current calibrated weights without full state.
 * Convenience function for the governor.
 */
export function getCalibratedWeights(): GovernorWeights {
  return getCalibrationState().weights;
}

/**
 * Resets calibration history (e.g., after a regime shift).
 * Bounded: does not affect default weights.
 */
export function resetCalibrationHistory(): void {
  _history.length = 0;
}
