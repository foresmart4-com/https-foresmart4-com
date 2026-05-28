/**
 * Thesis Laboratory Intelligence — Phase 42
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Evaluates the structural state of active market theses by weighing
 * supporting and contradictory evidence signals. Identifies competing
 * interpretations and prevents narrative lock.
 *
 * Thesis states:
 *   emerging_thesis    — forming thesis; evidence thin or very recent
 *   monitored_thesis   — coherent directional thesis with partial support
 *   supported_thesis   — multiple confirming signals; structural backing present
 *   fragile_thesis     — directional view but significant counter-evidence present
 *   invalidated_thesis — invalidation conditions likely triggered; thesis compromised
 *   competing_theses   — contradictory directional views with comparable evidence weight
 *
 * Design rules:
 * - No single-thesis bias: competing_theses is a valid and informative state
 * - No forced conviction: fragile_thesis and invalidated_thesis are honest outcomes
 * - No narrative lock: hasSingleNarrative=false is the goal, not an error
 * - No execution logic: evaluative intelligence only
 * - Deterministic: all gates derive from observable signals
 */

import type { ThesisEntry } from "@/services/learning/thesisMemory";
import type { OutcomeSummary } from "@/services/learning/outcomeEngine";
import type { StrategicBias } from "@/services/intelligence/strategicEngine";
import type { FirewallState } from "@/services/governance/decisionFirewall";
import type { DebateBalance } from "@/services/intelligence/debateEngine";
import type { CredibilityLabel } from "@/services/credibility/credibilityEngine";
import type { CalibrationScore } from "@/services/learning/decisionScoring";
import type { TrustState } from "@/services/intelligence/trustStrategyEngine";
import type { AttributionLabel } from "@/services/learning/outcomeAttribution";
import type { MarketRegime } from "@/services/market/marketIntelEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThesisLabState =
  | "emerging_thesis"    // evidence thin; thesis forming
  | "monitored_thesis"   // partial support; coherent direction
  | "supported_thesis"   // multiple confirming signals; structural backing
  | "fragile_thesis"     // directional but significant counter-evidence
  | "invalidated_thesis" // invalidation conditions likely triggered
  | "competing_theses";  // contradictory views with comparable evidence

export interface ThesisLabInput {
  theses: ThesisEntry[];
  outcomeSummary: OutcomeSummary;
  strategicBias: StrategicBias;
  hasStrategicConflict: boolean;
  firewallState: FirewallState;
  debateBalance: DebateBalance;
  hasMaterialDisagreement: boolean;
  credibilityLabel: CredibilityLabel;
  calibrationScore: CalibrationScore;
  trustState: TrustState;
  attributionLabel: AttributionLabel;
  marketRegime: MarketRegime;
  hasActiveVulnerability: boolean;
  ar: boolean;
}

export interface ThesisLabResult {
  thesisState: ThesisLabState;
  thesisCount: number;              // active (non-resolved) thesis count
  activeAssets: string[];           // assets with active directional theses
  supportStrength: "strong" | "moderate" | "weak" | "absent";
  competingViews: boolean;          // true when competing_theses state
  suppressedByGovernance: boolean;  // true when firewall/calibration blocks escalation
  hasSingleNarrative: boolean;      // false = good (competing views prevent lock-in)
  narrative: string;                // 1-2 sentences, hedged language
  contextString: string;            // compact ≤130 chars; empty when no theses
  readonly isCausal: false;         // always false — evaluative, never causal
}

// ─── Active thesis extraction ─────────────────────────────────────────────────

interface ActiveThesis {
  asset: string;
  direction: ThesisEntry["direction"];
  confidence: number;
  hasInvalidation: boolean;
  regimeMismatch: boolean;
  isRecent: boolean;  // generated within last 2h
}

function extractActive(theses: ThesisEntry[], currentRegime: MarketRegime): ActiveThesis[] {
  const now = Date.now();
  return theses
    .filter((t) => !t.outcome || t.outcome === "pending")
    .map((t) => ({
      asset: t.asset,
      direction: t.direction,
      confidence: t.confidence,
      hasInvalidation: !!t.invalidation,
      regimeMismatch: !!t.regimeAtSave && t.regimeAtSave !== currentRegime,
      isRecent: now - t.ts < 2 * 60 * 60 * 1000,
    }));
}

// ─── Direction conflict detection ─────────────────────────────────────────────

function hasDirectionalConflict(actives: ActiveThesis[]): boolean {
  const directional = actives.filter((t) => t.direction !== "neutral");
  if (directional.length < 2) return false;

  // Check for same-asset conflict first
  const byAsset = new Map<string, Set<string>>();
  for (const t of directional) {
    if (!byAsset.has(t.asset)) byAsset.set(t.asset, new Set());
    byAsset.get(t.asset)!.add(t.direction);
  }
  for (const dirs of byAsset.values()) {
    if (dirs.has("bullish") && dirs.has("bearish")) return true;
  }

  // Cross-asset conflict: bullish and bearish macro-level theses simultaneously
  const hasBull = directional.some((t) => t.direction === "bullish");
  const hasBear = directional.some((t) => t.direction === "bearish");
  return hasBull && hasBear && directional.length >= 3;
}

// ─── Support strength ─────────────────────────────────────────────────────────

function deriveSupportStrength(
  actives: ActiveThesis[],
  input: ThesisLabInput,
): "strong" | "moderate" | "weak" | "absent" {
  if (actives.length === 0) return "absent";

  const { calibrationScore, trustState, credibilityLabel,
    hasMaterialDisagreement, firewallState, attributionLabel } = input;

  let score = 0;

  // Calibration quality
  if (calibrationScore === "well_calibrated") score += 3;
  else if (calibrationScore === "moderately_calibrated") score += 1;
  else if (calibrationScore === "weakly_calibrated") score -= 2;

  // Trust
  if (trustState === "stable_calibration" || trustState === "improving_calibration") score += 2;
  else if (trustState === "fragile_calibration") score -= 2;

  // Credibility
  if (credibilityLabel === "high_credibility") score += 2;
  else if (credibilityLabel === "low_credibility") score -= 2;

  // Attribution
  if (attributionLabel === "evidence_aligned") score += 2;
  else if (attributionLabel === "luck_or_noise") score -= 2;

  // Disagreement / firewall
  if (hasMaterialDisagreement) score -= 2;
  if (firewallState === "blocked") score -= 3;
  else if (firewallState === "cleared") score += 1;

  if (score >= 6) return "strong";
  if (score >= 2) return "moderate";
  if (score >= 0) return "weak";
  return "absent";
}

// ─── State derivation ─────────────────────────────────────────────────────────

function deriveState(
  actives: ActiveThesis[],
  support: "strong" | "moderate" | "weak" | "absent",
  input: ThesisLabInput,
): ThesisLabState {
  const { outcomeSummary, firewallState, hasMaterialDisagreement,
    trustState, calibrationScore, debateBalance } = input;

  // No active theses
  if (actives.length === 0) return "emerging_thesis";

  // Invalidated: explicit outcomes or severe governance failure
  const hasInvalidatedOutcomes = outcomeSummary.invalidated > outcomeSummary.confirmed;
  if (
    hasInvalidatedOutcomes ||
    (firewallState === "blocked" && trustState === "fragile_calibration")
  ) {
    return "invalidated_thesis";
  }

  // Competing: directional conflict
  if (hasDirectionalConflict(actives) || (hasMaterialDisagreement && actives.length >= 2)) {
    return "competing_theses";
  }

  // Fragile: weak calibration or significant counter-evidence
  if (
    trustState === "fragile_calibration" ||
    calibrationScore === "weakly_calibrated" ||
    (hasMaterialDisagreement && support === "weak") ||
    (debateBalance === "contested" && support !== "strong")
  ) {
    return "fragile_thesis";
  }

  // Supported: strong signal backing
  if (support === "strong" && actives.length >= 1 && !hasMaterialDisagreement) {
    return "supported_thesis";
  }

  // Emerging: all very recent, thin support
  if (actives.every((t) => t.isRecent) && actives.length <= 1 && support === "weak") {
    return "emerging_thesis";
  }

  // Default: monitored
  return "monitored_thesis";
}

// ─── Narrative builder ────────────────────────────────────────────────────────

function buildNarrative(
  state: ThesisLabState,
  count: number,
  activeAssets: string[],
  ar: boolean,
): string {
  const assetNote = activeAssets.length > 0
    ? (ar ? ` (${activeAssets.slice(0, 2).join("، ")})` : ` (${activeAssets.slice(0, 2).join(", ")})`)
    : "";

  if (ar) {
    switch (state) {
      case "supported_thesis":
        return `أطروحة مدعومة${assetNote}؛ إشارات متعددة تُؤيّد الاتجاه السائد. مؤيَّد — لا مُؤكَّد.`;
      case "monitored_thesis":
        return `أطروحة متماسكة قيد المتابعة${assetNote}؛ دعم جزئي مع عدم يقين قائم.`;
      case "competing_theses":
        return `وجهات نظر متنافسة نشطة${assetNote}؛ أدلة البيع والشراء قابلة للمقارنة. لا موقف مهيمن واضح.`;
      case "fragile_thesis":
        return `أطروحة هشّة${assetNote}؛ أدلة مضادة تُقيّد قناعة الاتجاه. الموقف المحافظ مناسب.`;
      case "invalidated_thesis":
        return `الشروط المُبطِلة يُرجَّح تفعيلها${assetNote}؛ الأساس الهيكلي للأطروحة تحت الضغط.`;
      case "emerging_thesis":
      default:
        return `أطروحة في طور التكوّن${count > 0 ? assetNote : ""}؛ أدلة محدودة — التأكيد مطلوب.`;
    }
  }
  switch (state) {
    case "supported_thesis":
      return `Thesis supported${assetNote}; multiple signals corroborate the dominant direction. Supported — not confirmed.`;
    case "monitored_thesis":
      return `Coherent thesis monitored${assetNote}; partial support with remaining uncertainty.`;
    case "competing_theses":
      return `Competing views active${assetNote}; bull and bear evidence comparable. No single dominant position.`;
    case "fragile_thesis":
      return `Thesis fragile${assetNote}; counter-evidence constrains directional conviction. Conservative posture appropriate.`;
    case "invalidated_thesis":
      return `Invalidation conditions likely triggered${assetNote}; structural thesis basis is under pressure.`;
    case "emerging_thesis":
    default:
      return `Thesis forming${count > 0 ? assetNote : ""}; limited evidence — further confirmation required.`;
  }
}

// ─── Context string ───────────────────────────────────────────────────────────

function buildContextString(
  state: ThesisLabState,
  activeAssets: string[],
): string {
  // No injection when no thesis context
  if (state === "emerging_thesis" && activeAssets.length === 0) return "";
  const assetStr = activeAssets.length > 0 ? `; ${activeAssets.slice(0, 2).join("/")}` : "";
  return `Thesis: ${state.replace(/_/g, " ")}${assetStr}`.slice(0, 130);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeThesisLab(input: ThesisLabInput): ThesisLabResult {
  const { theses, marketRegime, ar } = input;

  const actives = extractActive(theses, marketRegime);
  const supportStrength = deriveSupportStrength(actives, input);
  const thesisState = deriveState(actives, supportStrength, input);
  const activeAssets = [...new Set(actives.map((t) => t.asset))];
  const narrative = buildNarrative(thesisState, actives.length, activeAssets, ar);
  const contextString = buildContextString(thesisState, activeAssets);

  return {
    thesisState,
    thesisCount: actives.length,
    activeAssets,
    supportStrength,
    competingViews: thesisState === "competing_theses",
    suppressedByGovernance:
      input.firewallState === "blocked" ||
      input.trustState === "fragile_calibration",
    hasSingleNarrative: thesisState !== "competing_theses",
    narrative,
    contextString,
    isCausal: false,
  };
}
