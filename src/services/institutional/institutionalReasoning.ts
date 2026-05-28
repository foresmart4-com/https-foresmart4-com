// Phase-63: Institutional Reasoning Hardening
// Pure deterministic functions — no AI calls, no network, O(1).
// Injects macro chain + reasoning state context into the Genesis fusion prompt.

export type ReasoningState =
  | "high_coherence"
  | "debated_framework"
  | "thin_evidence"
  | "macro_conflict"
  | "valuation_conflict"
  | "uncertainty_dominant";

interface TrackASlice {
  regime: string;
  ratesEnv?: string;
  oilLiquidity?: string;
  dxyImpact?: string;
  creditStressLevel?: "low" | "moderate" | "high" | "extreme";
  macroBias?: "bullish" | "bearish" | "neutral";
  regimeConf?: number;
  macroSummary?: string;
}

interface TrackDSlice {
  uncertaintyLevel?: "low" | "moderate" | "high" | "extreme";
  primaryRisk?: string;
  thesisWeakness?: string;
  counterCase?: string;
  invalidationTrigger?: string;
  confidenceChallenge?: string;
}

interface ConsensusSlice {
  dominantBias: "bullish" | "bearish" | "neutral";
  agreementScore: number;
  strength: "strong" | "moderate" | "weak" | "conflicted";
  conflictNote?: string;
}

export function deriveReasoningState(
  trackA: TrackASlice | null,
  trackD: TrackDSlice | null,
  consensus: ConsensusSlice,
): ReasoningState {
  if (!trackA) return "thin_evidence";

  const regimeConf = trackA.regimeConf ?? 50;
  const credit = trackA.creditStressLevel ?? "moderate";
  const uncertainty = trackD?.uncertaintyLevel ?? "moderate";
  const strength = consensus.strength;

  if (uncertainty === "extreme" || uncertainty === "high") return "uncertainty_dominant";
  if (strength === "conflicted") return "macro_conflict";
  if (credit === "extreme") return "valuation_conflict";
  if (regimeConf >= 70 && strength === "strong") return "high_coherence";
  if (regimeConf < 45 || strength === "weak") return "thin_evidence";
  return "debated_framework";
}

// Builds the macro chain reasoning context injected into the fusion prompt.
// Forces AI to reason through each macro link explicitly instead of emitting
// generic regime labels.
export function buildInstitutionalReasoningContext(
  trackA: TrackASlice | null,
  trackD: TrackDSlice | null,
  consensus: ConsensusSlice,
): string {
  const state = deriveReasoningState(trackA, trackD, consensus);

  const stateDescriptions: Record<ReasoningState, string> = {
    high_coherence: "Macro chain is internally consistent — evidence, regime, and cross-asset signals reinforce each other.",
    debated_framework: "Macro chain has a dominant view but active counter-arguments; reasoning must name which side has stronger weight of evidence.",
    thin_evidence: "Evidence base is thin — reasoning must explicitly acknowledge what data is missing and avoid overstating conviction.",
    macro_conflict: "Tracks A, B, C produce conflicting signals — reasoning must frame both sides and explain which wins and why; do not collapse to a single direction without justification.",
    valuation_conflict: "Extreme credit stress is creating valuation distortion — confidence ceiling applies; reasoning must address spread risk and funding conditions.",
    uncertainty_dominant: "Uncertainty is the dominant signal — do not produce a directional thesis with high confidence; frame around scenario probability spread instead.",
  };

  const macroChainLinks = [
    "1. RATES: Central bank policy trajectory → risk-asset valuation multiple compression or expansion.",
    "2. LIQUIDITY: Global dollar liquidity (DXY, TLT, Fed balance sheet direction) → funding conditions for risk assets, EM, and commodities.",
    "3. INFLATION: CPI/PPI trajectory relative to CB target → real-rate environment → asset allocation rotation.",
    "4. CREDIT CONDITIONS: IG/HY spread direction → funding stress level → risk appetite and leverage cycle.",
    "5. GROWTH EXPECTATIONS: PMI/GDP trajectory → earnings cycle direction → equity multiple sustainability.",
    "6. EARNINGS CYCLE: Revenue and margin trajectory → bottom-up EPS growth → P/E compression or expansion pressure.",
    "7. VALUATION PRESSURE: Current multiples vs historical regime range → upside optionality vs downside mean-reversion risk.",
    "8. RISK APPETITE: Cross-asset confirmation (gold/BTC/DXY) → positioning → timing and size of the opportunity.",
  ];

  const trackContext: string[] = [];
  if (trackA) {
    if (trackA.ratesEnv) trackContext.push(`Rates/CB context: ${trackA.ratesEnv}`);
    if (trackA.oilLiquidity) trackContext.push(`Oil/liquidity context: ${trackA.oilLiquidity}`);
    if (trackA.dxyImpact) trackContext.push(`DXY context: ${trackA.dxyImpact}`);
    if (trackA.creditStressLevel) trackContext.push(`Credit stress: ${trackA.creditStressLevel}`);
    if (trackA.macroSummary) trackContext.push(`Macro summary: ${trackA.macroSummary}`);
  }
  if (trackD) {
    if (trackD.thesisWeakness) trackContext.push(`Weakest assumption: ${trackD.thesisWeakness}`);
    if (trackD.counterCase) trackContext.push(`Strongest counter: ${trackD.counterCase}`);
    if (trackD.invalidationTrigger) trackContext.push(`Invalidation event: ${trackD.invalidationTrigger}`);
    if (trackD.confidenceChallenge) trackContext.push(`Confidence constraint: ${trackD.confidenceChallenge}`);
  }

  return `Institutional Reasoning Framework:
Reasoning state: ${state} — ${stateDescriptions[state]}

Macro chain (reason through each link explicitly; do not skip to conclusion):
${macroChainLinks.join("\n")}

Available track evidence:
${trackContext.length > 0 ? trackContext.map((l) => `- ${l}`).join("\n") : "- Track evidence limited — reason from question context only."}

Required reasoning structure:
- Bull case: name the macro chain link(s) that support the bull scenario and what evidence would need to hold.
- Bear case: name the macro chain link(s) that create the primary bear risk and what could activate it.
- Base case: which case currently dominates and why — cite the specific macro link where the evidence is strongest.
- Dominant case justification: the single factor that tips the balance between bull and bear.
- Missing evidence: what observable data point or event would most change the conclusion.
- Thesis changer: the specific macro development (rate move, credit event, oil level, earnings miss) that would flip the dominant case.

Reasoning state rules:
- high_coherence: thesis can carry moderate-to-high confidence; all macro links aligned.
- debated_framework: thesis permitted but must acknowledge the counter; confidence 50-65%.
- thin_evidence: acknowledge data gaps; confidence ≤ 55%; conditional framing mandatory.
- macro_conflict: frame both sides explicitly; explain which wins on balance of evidence; no single-direction certainty.
- valuation_conflict: credit stress context dominates; confidence ceiling 60%; spread risk must appear in thesis or caveats.
- uncertainty_dominant: scenario spread > directional thesis; confidence ≤ 50%; no high-conviction framing.`;
}
