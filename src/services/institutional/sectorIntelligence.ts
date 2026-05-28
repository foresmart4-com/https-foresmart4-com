// Phase-64: Deep Market & Sector Intelligence
// Pure deterministic functions — no AI calls, no network, O(1).
// Injects sector rotation and sensitivity context into the Genesis fusion prompt.

interface TrackASlice {
  regime?: string;
  macroBias?: "bullish" | "bearish" | "neutral";
  creditStressLevel?: "low" | "moderate" | "high" | "extreme";
  ratesEnv?: string;
}

interface LiveSlice {
  oilPrice?: number | null;
  oilChangePct?: number | null;
  eurUsd?: number | null;
}

const SAUDI_PATTERN = /tasi|saudi|سعود|تاسي|أرامكو|aramco|gulf|خليج|sabic|ساسكو|dfm|adx|nomu|نمو/i;
const SECTOR_PATTERN = /sector|قطاع|bank|bank|بنك|energy|طاقة|tech|تقنية|health|صحة|consumer|مستهلك|reit|صندوق عقاري|telecom|اتصالات|petrochem|بتروكيماوي|utility|مرافق|industri|صناعي|financ|مالي|cyclical|دوري|defensi|دفاعي|commodity|سلع/i;
const COMPANY_ROTATION_PATTERN = /which sector|sector rotation|best sector|قطاع أفضل|دوران قطاع|أي قطاع|sector outlook|توقعات قطاع/i;

export function isSectorQuestion(question: string): boolean {
  return SECTOR_PATTERN.test(question) || COMPANY_ROTATION_PATTERN.test(question);
}

export function isSaudiQuestion(question: string): boolean {
  return SAUDI_PATTERN.test(question);
}

// Derives macro regime label from trackA
function regimeLabel(trackA: TrackASlice | null): string {
  if (!trackA?.regime) return "unclear";
  return trackA.regime.replace(/_/g, " ");
}

// Derives cycle phase from regime and bias
function cyclePhase(trackA: TrackASlice | null): "early_expansion" | "mid_cycle" | "late_cycle" | "contraction" | "transition" {
  if (!trackA) return "transition";
  const regime = (trackA.regime ?? "").toLowerCase();
  const bias = trackA.macroBias ?? "neutral";
  if (regime.includes("bull") && bias === "bullish") return "mid_cycle";
  if (regime.includes("accumulation")) return "early_expansion";
  if (regime.includes("risk-off") || regime.includes("bear")) return "contraction";
  if (regime.includes("transition")) return "transition";
  return "mid_cycle";
}

const SAUDI_SECTOR_CONTEXT = `Saudi/TASI sector map (apply only when Saudi/Gulf context is confirmed):

Banks (25-30% TASI weight):
- Macro sensitivity: High. Rising US rates → SAMA must shadow Fed → bank NIM expansion IF curve is steep; NIM compression if curve inverts.
- Regime winners: mid-cycle with stable credit; oil above fiscal breakeven (strong government deposits).
- Regime losers: high credit stress; rate inversion; oil below $75/bbl → government deposit withdrawal.
- Key variable: loan growth and provisioning cycle; Saudi mortgage market expansion.

Energy / Aramco (~50-55% TASI weight):
- Macro sensitivity: Critical. Oil price drives dividend capacity and fiscal policy. Aramco yield anchors TASI valuation.
- Regime winners: oil > $80/bbl + global risk-on + Vision 2030 spending momentum.
- Regime losers: oil < $70/bbl + DXY surge + demand slowdown (China PMI < 50).
- Key variable: Aramco dividend per share commitment and Q-on-Q production levels.

Petrochemicals / SABIC:
- Macro sensitivity: High. Tracks naphtha-oil spread. China industrial demand is primary structural driver.
- Regime winners: China manufacturing recovery + oil/naphtha spread expansion + weak USD.
- Regime losers: China slowdown + margin compression from feedstock costs.

Telecom:
- Macro sensitivity: Moderate. Defensive characteristics; Vision 2030 digital infrastructure spend supports capex cycle.
- Regime winners: high uncertainty / defensive rotation; stable earnings compounder.
- Regime losers: rising rates if heavily leveraged; spectrum cost escalation.

Healthcare:
- Macro sensitivity: Low-moderate. Defensive. Driven by Vision 2030 healthcare expansion and insurance mandates.
- Regime winners: defensive rotation; earnings visibility.

Consumer (discretionary and staples):
- Macro sensitivity: Moderate. Linked to domestic income growth, oil price (government transfers), and expat population.
- Regime winners: strong oil + fiscal spending + Vision 2030 tourism projects.
- Regime losers: oil below breakeven → fiscal tightening → consumer confidence decline.

Utilities:
- Macro sensitivity: Low. Rate-sensitive valuations; regulated revenues.
- Regime winners: rate-cutting cycle; defensive positioning.
- Regime losers: rising rates + high leverage.

Industrials / Contractors:
- Macro sensitivity: Moderate-high. Directly tied to Vision 2030 megaproject capex. Oil-funded fiscal surplus is the catalyst.
- Regime winners: oil > $80 + active NEOM/giga-project contracts + Saudi government budget surplus.

REITs:
- Macro sensitivity: High rate sensitivity. Rising US rates → discount rate pressure → NAV compression.
- Regime winners: rate easing + strong office/retail occupancy + tourism recovery.`;

const GLOBAL_SECTOR_CONTEXT = `Global sector map (apply to macro-driven rotation logic):

Technology (growth/duration):
- Macro sensitivity: High. Long-duration asset — most sensitive to rate and liquidity cycle.
- Regime winners: rate-easing cycle + liquidity expansion + AI/software capex cycle + weak USD.
- Regime losers: rate hike cycle + credit tightening + DXY surge + multiple compression risk.

Financials / Banks:
- Macro sensitivity: High. NIM expansion in rising-rate shallow curve; credit losses in deep inversion or recession.
- Regime winners: steep yield curve + strong credit + moderate inflation.

Energy:
- Macro sensitivity: Critical. Oil price + demand outlook drives everything.
- Regime winners: global demand recovery + supply discipline + geopolitical premium.

Cyclicals (industrials, materials, autos):
- Macro sensitivity: High. Early-to-mid cycle beneficiaries.
- Regime winners: GDP expansion + low unemployment + infrastructure spending.
- Regime losers: PMI contraction + inventory correction + DXY strength.

Defensives (staples, healthcare, utilities):
- Macro sensitivity: Low. Capital preservation in risk-off.
- Regime winners: high uncertainty + credit stress + recessionary signals.

Commodities:
- Macro sensitivity: Critical. DXY inverse + China demand + supply chain.
- Regime winners: DXY weakness + China PMI recovery + underinvestment cycle.
- Regime losers: DXY surge + demand slowdown + speculative unwind.

Rates-sensitive sectors (utilities, REITs, long-duration bonds):
- Macro sensitivity: Critical. Inverse to rate direction.
- Regime winners: rate-cutting cycle + easing bias confirmed by TLT rally.`;

// Builds the cycle-phase sector rotation comment
function buildRotationComment(cycle: ReturnType<typeof cyclePhase>, trackA: TrackASlice | null): string {
  const credit = trackA?.creditStressLevel ?? "moderate";
  const bias = trackA?.macroBias ?? "neutral";

  const rotationMap: Record<ReturnType<typeof cyclePhase>, string> = {
    early_expansion: `Rotation logic (early expansion): Cyclicals, industrials, and banks historically outperform in the early expansion phase as credit normalises and earnings recover from the trough. Defensives are the source of funds.`,
    mid_cycle: `Rotation logic (mid cycle): Broad-based participation; technology and consumer discretionary benefit from sustained earnings growth. Energy outperforms if oil holds above fiscal breakeven. Monitor credit spread widening for early late-cycle signal.`,
    late_cycle: `Rotation logic (late cycle): Defensives (healthcare, staples, utilities) become shelter; energy is the last cyclical to peak. Technology faces multiple compression from rising rates. Watch for credit stress escalation as the key rotation catalyst.`,
    contraction: `Rotation logic (contraction / risk-off): Defensive sectors (healthcare, staples, utilities) and gold/short-duration bonds outperform. Avoid high-leverage cyclicals and rate-sensitive growth. Energy is volatile — oil falling → fiscal drag → Saudi exposure warranted with caution.`,
    transition: `Rotation logic (transition / regime unclear): Sector conviction is reduced. Factor rotation (quality over momentum) is more reliable than sector rotation in transition. Wait for regime confirmation before concentrating sector exposure.`,
  };

  let comment = rotationMap[cycle];
  if (credit === "high" || credit === "extreme") {
    comment += ` Credit stress (${credit}) signals: reduce cyclical and high-leverage exposure; prioritise balance sheet quality and free cash flow visibility over growth multiples.`;
  }
  if (bias === "bearish") {
    comment += ` Dominant macro bias is bearish — sector calls should be framed as relative performance within a defensive posture, not outright long.`;
  }
  return comment;
}

export function buildSectorIntelligenceContext(
  question: string,
  trackA: TrackASlice | null,
  live: LiveSlice | null,
): string {
  const isSaudi = isSaudiQuestion(question);
  const isSector = isSectorQuestion(question);

  if (!isSaudi && !isSector) return "";

  const cycle = cyclePhase(trackA);
  const regime = regimeLabel(trackA);
  const rotationComment = buildRotationComment(cycle, trackA);

  const oilContext = live?.oilPrice != null
    ? `Live oil: $${live.oilPrice.toFixed(1)} (${((live.oilChangePct ?? 0) >= 0 ? "+" : "") + (live.oilChangePct ?? 0).toFixed(2)}%) — ${(live.oilChangePct ?? 0) > 1.5 ? "above breakeven support" : (live.oilChangePct ?? 0) < -1.5 ? "approaching fiscal stress threshold" : "near neutral for fiscal channel"}`
    : null;

  const dxyContext = live?.eurUsd != null
    ? `Live EUR/USD: ${live.eurUsd.toFixed(4)} — ${live.eurUsd <= 1.02 ? "DXY elevated → EM/commodity headwind → Saudi non-oil sector caution" : live.eurUsd >= 1.10 ? "DXY weak → EM/commodity tailwind → Saudi foreign flows supported" : "DXY neutral"}`
    : null;

  const lines: string[] = [
    "Sector Intelligence Context (apply sector rotation and sensitivity analysis):",
    `Current regime: ${regime} | Macro cycle: ${cycle.replace(/_/g, " ")}`,
    "",
    rotationComment,
    "",
    isSaudi ? SAUDI_SECTOR_CONTEXT : GLOBAL_SECTOR_CONTEXT,
  ];

  if (oilContext || dxyContext) {
    lines.push("", "Live market inputs for sector calibration:");
    if (oilContext) lines.push(`- ${oilContext}`);
    if (dxyContext) lines.push(`- ${dxyContext}`);
  }

  lines.push(
    "",
    "Sector reasoning requirements:",
    "- Do not list sectors without explaining WHY the current regime makes them winners or losers.",
    "- Name the specific macro link (rate, oil, credit, DXY, China demand) that drives each sector call.",
    "- Rotation logic must connect: macro regime → earnings cycle → sector sensitivity → relative positioning.",
    "- For Saudi questions: always address the oil→fiscal channel and SAMA/Fed linkage first.",
    "- Liquidity effects: when DXY is strong, EM and commodity-linked sectors face dual headwinds (currency + demand).",
    "- Policy effects: Vision 2030 capex is oil-funded; fiscal surplus/deficit is the toggle.",
  );

  return lines.join("\n");
}
