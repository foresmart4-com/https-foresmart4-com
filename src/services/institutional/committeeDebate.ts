// Phase-65: Company Selection & Committee Debate Engine
// Pure deterministic functions — no AI calls, no network, O(1).
// Injects investment committee framing into Genesis when company/opportunity questions appear.

export type CommitteeStance =
  | "selective_over_broad"
  | "defensive"
  | "conditional_opportunity"
  | "wait_for_confirmation"
  | "insufficient_edge";

interface TrackASlice {
  regime?: string;
  macroBias?: "bullish" | "bearish" | "neutral";
  creditStressLevel?: "low" | "moderate" | "high" | "extreme";
  regimeConf?: number;
}

interface TrackDSlice {
  uncertaintyLevel?: "low" | "moderate" | "high" | "extreme";
  primaryRisk?: string;
  thesisWeakness?: string;
}

interface ConsensusSlice {
  dominantBias: "bullish" | "bearish" | "neutral";
  agreementScore: number;
  strength: "strong" | "moderate" | "weak" | "conflicted";
}

// Detects questions asking for company names or investment opportunities
const COMPANY_SELECTION_PATTERN =
  /which compan|best stock|top stock|where to invest|what to buy|what should I buy|highest gain|best opportunit|أي شركة|أفضل سهم|أين أستثمر|ماذا أشتري|أعلى عائد|أفضل فرصة|which shares|best shares|recommend|توصية|pick|اختر|select|انتقاء|buy now|اشترِ|invest in|استثمر في/i;

export function isCompanySelectionQuestion(question: string): boolean {
  return COMPANY_SELECTION_PATTERN.test(question);
}

export function deriveCommitteeStance(
  trackA: TrackASlice | null,
  trackD: TrackDSlice | null,
  consensus: ConsensusSlice,
): CommitteeStance {
  const uncertainty = trackD?.uncertaintyLevel ?? "moderate";
  const credit = trackA?.creditStressLevel ?? "moderate";
  const strength = consensus.strength;
  const bias = consensus.dominantBias;
  const regimeConf = trackA?.regimeConf ?? 50;

  if (uncertainty === "extreme" || credit === "extreme") return "defensive";
  if (strength === "conflicted" || uncertainty === "high") return "wait_for_confirmation";
  if (strength === "weak" || regimeConf < 45) return "insufficient_edge";
  if (bias === "bearish") return "defensive";
  if (strength === "strong" && bias === "bullish" && credit !== "high") return "selective_over_broad";
  return "conditional_opportunity";
}

const SELECTION_FRAMEWORK = `Company Selection Framework (apply before naming any company):

Required filters — a company must pass ALL to warrant discussion:

1. EARNINGS QUALITY
   - Revenue growth must be organic, not acquisition-driven or one-time.
   - Earnings must convert to free cash flow at an acceptable rate (FCF/NI ratio matters).
   - Watch for rising receivables or inventory as signs of quality deterioration.

2. BALANCE SHEET STRENGTH
   - Net debt/EBITDA should be regime-appropriate: ≤2x in normal cycle, ≤1x in high credit stress.
   - Interest coverage ratio should comfortably exceed cost of debt — especially important in high-rate environments.
   - Avoid companies with refinancing needs in the current rate environment without confirmed access.

3. VALUATION DISCIPLINE
   - Current P/E or EV/EBITDA vs historical range and sector peers.
   - Identify if premium is justified by earnings growth rate or if multiple compression risk exists.
   - In high-rate environments: duration risk applies to long-P/E growth names; prefer shorter payback.

4. LIQUIDITY
   - Sufficient daily traded volume to enter and exit without market impact.
   - Avoid illiquid names in risk-off regimes — the bid disappears first.

5. MARKET LEADERSHIP
   - Pricing power and competitive moat — can they sustain margins in an inflationary or demand-pressure regime?
   - Is the company a price-setter or price-taker in its segment?

6. DOWNSIDE RESILIENCE
   - What is the likely floor in a bear scenario? (Net asset value, dividend yield anchor, government strategic importance)
   - Does the company benefit from any counter-cyclical revenue stream?

7. MACRO SENSITIVITY
   - Explicitly map: oil price sensitivity, rates sensitivity, DXY sensitivity, China demand sensitivity.
   - A company passing all other filters but maximally exposed to the dominant macro risk may still be a poor entry.`;

const COMMITTEE_DEBATE_STRUCTURE = `Investment Committee Debate Structure:

STEP 1 — Selection framework (always first; no company names until framework is stated)
Apply the 7 filters above to define the criteria set that any candidate must meet in the current regime.

STEP 2 — Bull committee (advocate for investing):
- What specific macro or sector tailwind supports this category right now?
- What earnings or balance sheet quality floor limits the downside?
- What valuation entry point makes the risk/reward asymmetric to the upside?
- Which catalyst in the near term could re-rate the sector or company?

STEP 3 — Bear committee (advocate for avoiding):
- What is the primary macro risk that could impair this category?
- Is current valuation pricing in too much optimism?
- What credit or liquidity risk is the bull committee underweighting?
- What would need to happen for this thesis to fail quickly?

STEP 4 — Committee final stance (choose one):
- selective_over_broad: Framework conditions are met for a focused, criteria-driven set; broad exposure underperforms selectivity in this regime.
- conditional_opportunity: Opportunity exists but requires specific confirmation before committing; name the condition.
- defensive: Risk/reward is unfavorable in this regime; capital preservation framing is appropriate.
- wait_for_confirmation: Evidence is split; the committee is on watch but unwilling to commit a directional view until a specific data point resolves.
- insufficient_edge: The evidence base does not support a high-conviction view; name what is missing.

STEP 5 — If any company names are mentioned:
- They are ILLUSTRATIVE EXAMPLES ONLY — not recommendations.
- They are conditional on current valuation, fundamental, and liquidity data not available in this context.
- The committee does not endorse any named company without current financial statement review.`;

export function buildCommitteeDebateContext(
  question: string,
  trackA: TrackASlice | null,
  trackD: TrackDSlice | null,
  consensus: ConsensusSlice,
): string {
  if (!isCompanySelectionQuestion(question)) return "";

  const stance = deriveCommitteeStance(trackA, trackD, consensus);

  const stanceDescriptions: Record<CommitteeStance, string> = {
    selective_over_broad: "Macro and credit conditions support a focused, criteria-driven allocation; broad index exposure underperforms selectivity. The committee favors quality over momentum.",
    conditional_opportunity: "Opportunity exists in the sector but requires a specific confirmation event before the committee commits. Name the confirmation condition explicitly.",
    defensive: "The current risk/reward favors capital preservation over deployment. The committee frames any names in context of defensive characteristics: yield, balance sheet, downside floor.",
    wait_for_confirmation: "The macro framework is split and the committee is on watch. Premature commitment is a risk — name the specific unresolved variable that must clear before taking a view.",
    insufficient_edge: "The evidence base is too thin to produce a high-conviction framework. The committee acknowledges what data is missing and avoids directional company calls.",
  };

  const macroFilter = (() => {
    const regime = (trackA?.regime ?? "").replace(/_/g, " ");
    const credit = trackA?.creditStressLevel ?? "moderate";
    const bias = consensus.dominantBias;
    const lines: string[] = [`Current regime: ${regime} | Dominant bias: ${bias} | Credit: ${credit}`];
    if (credit === "high" || credit === "extreme") {
      lines.push("Credit stress filter: high-leverage names should be excluded from the framework regardless of earnings quality.");
    }
    if (bias === "bearish") {
      lines.push("Bearish macro filter: entry criteria should require exceptional valuation discount to compensate for macro headwind.");
    }
    if (trackD?.primaryRisk) {
      lines.push(`Primary risk to screen against: ${trackD.primaryRisk}`);
    }
    return lines.join("\n");
  })();

  return `Investment Committee Context:

The user is asking for company names or investment opportunities. The committee does NOT jump to names.
Instead, apply the following structure:

${SELECTION_FRAMEWORK}

${COMMITTEE_DEBATE_STRUCTURE}

Committee stance for this context: ${stance}
${stanceDescriptions[stance]}

Regime-adjusted macro filter:
${macroFilter}

GOVERNANCE RULES — MANDATORY:
- NEVER present a company name as a buy recommendation.
- NEVER claim certainty about a company's future performance.
- Any named company is illustrative only — conditional on fundamental review not available here.
- The committee debate must surface both sides; the bear case must be as specific as the bull case.
- Language allowed: "illustrative example", "meets the framework criteria in principle", "warrants investigation".
- Language forbidden: "buy X now", "guaranteed return", "best investment", "certain outperformer".`;
}
