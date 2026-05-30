// Phase-90A: Advisory Escalation Engine
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Governs WHEN and HOW to raise the caution level beyond the base recommendation.
// Escalation logic answers: "Are there specific signals that require me to
// be more cautious than my baseline recommendation?"
//
// Distinct from the recommendation hierarchy (which sets the base level) —
// escalation adjusts the base level upward when specific warning signals fire.
//
// 5 escalation levels: none → mild → moderate → significant → critical
//
// Escalation sources (checked in priority order):
//   1. creditStress "extreme"                         → critical  (hard override)
//   2. creditStress "high" + macroBias "bearish"      → significant
//   3. fiduciaryAlert (2+ stress overlays in regime)  → significant
//   4. riskOff + stressSignal (global liquidity)      → moderate
//   5. crisis text signals detected                    → mild/moderate
//   6. regimeConf < 35                                 → mild (structural uncertainty)
//
// Multiple concurrent triggers → escalate to maximum active level.
//
// Escalation penalty on maxConfidenceAnchor:
//   none: 0, mild: -3, moderate: -7, significant: -12, critical: -18
//
// escalationNote ≤65 chars: describes the dominant escalation trigger.
// Educational/advisory only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type EscalationLevel = "none" | "mild" | "moderate" | "significant" | "critical";

export interface EscalationTrigger {
  trigger:  string;         // ≤55 chars: description
  source:   string;         // which signal triggered this
  severity: EscalationLevel;
}

export interface EscalationResult {
  finalEscalation:        EscalationLevel;
  triggers:               EscalationTrigger[];
  escalationNote:         string;   // ≤65 chars: primary trigger explanation
  confidencePenalty:      number;   // points deducted from maxConfidenceAnchor
  adjustedMaxConfidence:  number;   // 0-100: post-escalation confidence ceiling
}

// ─── Level ordering ───────────────────────────────────────────────────────────

const LEVEL_ORDER: Record<EscalationLevel, number> = {
  none: 0, mild: 1, moderate: 2, significant: 3, critical: 4,
};
const PENALTY: Record<EscalationLevel, number> = {
  none: 0, mild: 3, moderate: 7, significant: 12, critical: 18,
};

// ─── Crisis signal detection ─────────────────────────────────────────────────

const CRISIS_TEXT_PATTERNS = [
  /\b(banking.crisis|bank.run|deposit.outflow|funding.freeze|sovereign.crisis|imf.program|credit.event)\b/i,
  /\b(flash.crash|margin.call|forced.sell|liquidation.spiral|systemic.risk|contagion)\b/i,
];

function hasCrisisTextSignal(question: string, ctx: string): boolean {
  const text = `${question} ${ctx}`;
  return CRISIS_TEXT_PATTERNS.some(p => p.test(text));
}

// ─── Trigger detection ────────────────────────────────────────────────────────

function detectTriggers(input: {
  creditStressLevel:  "low" | "moderate" | "high" | "extreme";
  macroBias:          "bullish" | "bearish" | "neutral";
  fiduciaryAlert:     boolean;
  isRiskOff:          boolean;
  liquidityStressed:  boolean;
  question:           string;
  ctx:                string;
  regimeConf:         number;
}): EscalationTrigger[] {
  const { creditStressLevel, macroBias, fiduciaryAlert, isRiskOff, liquidityStressed, question, ctx, regimeConf } = input;
  const triggers: EscalationTrigger[] = [];

  if (creditStressLevel === "extreme") {
    triggers.push({ trigger: "Extreme credit stress: systemic risk elevated", source: "creditStress", severity: "critical" });
  }
  if (creditStressLevel === "high" && macroBias === "bearish") {
    triggers.push({ trigger: "High credit stress + bearish bias: combined downside risk", source: "creditStress+bias", severity: "significant" });
  }
  if (fiduciaryAlert) {
    triggers.push({ trigger: "Multiple concurrent stress overlays: fiduciary alert active", source: "regimeOntology", severity: "significant" });
  }
  if (isRiskOff && liquidityStressed) {
    triggers.push({ trigger: "Risk-off conditions + liquidity stress: risk premium rising", source: "capitalFlows+liquidity", severity: "moderate" });
  } else if (isRiskOff) {
    triggers.push({ trigger: "Risk-off capital flow: deployment caution elevated", source: "capitalFlows", severity: "mild" });
  }
  if (hasCrisisTextSignal(question, ctx)) {
    triggers.push({ trigger: "Crisis language detected in context: heightened caution", source: "crisisText", severity: "moderate" });
  }
  if (regimeConf < 35) {
    triggers.push({ trigger: "Low regime confidence: structural uncertainty elevated", source: "regimeConf", severity: "mild" });
  }

  return triggers;
}

// ─── Final escalation ─────────────────────────────────────────────────────────

function resolveEscalation(triggers: EscalationTrigger[]): EscalationLevel {
  if (triggers.length === 0) return "none";
  return triggers.reduce<EscalationLevel>((max, t) => {
    return LEVEL_ORDER[t.severity] > LEVEL_ORDER[max] ? t.severity : max;
  }, "none");
}

function buildEscalationNote(triggers: EscalationTrigger[], level: EscalationLevel): string {
  if (level === "none") return "No escalation triggers active";
  const primary = triggers.sort((a, b) => LEVEL_ORDER[b.severity] - LEVEL_ORDER[a.severity])[0];
  return `Escalation[${level}]: ${primary.trigger.slice(0, 45)}`.slice(0, 65);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeAdvisoryEscalation(input: {
  creditStressLevel:  "low" | "moderate" | "high" | "extreme";
  macroBias:          "bullish" | "bearish" | "neutral";
  fiduciaryAlert:     boolean;      // from regimeOntologyEngine (Phase-87B)
  isRiskOff:          boolean;      // derived from capitalFlowEngine riskMode
  liquidityStressed:  boolean;      // from globalLiquidityEngine stressSignal
  question:           string;
  ctx:                string;
  regimeConf:         number;
  baseMaxConfidence:  number;       // from convictionGovernor
}): EscalationResult {
  const triggers = detectTriggers(input);
  const finalEscalation = resolveEscalation(triggers);
  const penalty = PENALTY[finalEscalation];
  const adjustedMaxConfidence = Math.max(25, input.baseMaxConfidence - penalty);

  return {
    finalEscalation,
    triggers,
    escalationNote:        buildEscalationNote(triggers, finalEscalation),
    confidencePenalty:     penalty,
    adjustedMaxConfidence,
  };
}
