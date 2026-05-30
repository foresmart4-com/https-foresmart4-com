// Phase-89B: Cross-Asset Transmission Engine
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Distinct from crossMarketFusion.ts (Phase-67):
//   crossMarketFusion: 8-dimension causal SPILLOVER NARRATIVE strings for each
//                      live data dimension (oil/rates/USD/liquidity/China/etc.)
//   crossAssetTransmissionEngine: systematic DIRECTIONAL TRANSMISSION CHAINS
//                      across specific asset-class PAIRS — traces WHERE a shock
//                      in one asset class transmits TO and HOW FORCEFULLY
//
// Distinct from crossMarketRegime.ts (Phase-41):
//   crossMarketRegime: REGIME LABELS from cross-market signal ALIGNMENT
//   crossAssetTransmissionEngine: CHAIN MECHANICS — the path through which
//                      one asset's movement forces changes in another
//
// 5 transmission pairs modelled:
//   bonds → equities:    yield direction → discount rate → equity multiple
//   DXY → commodities:   USD strength → commodity USD-pricing → demand effect
//   yields → growth:     rate level + credit stress → financing cost → earnings
//   oil → liquidity:     oil price → petrodollar recycling → dollar liquidity
//   FX → risk appetite:  DXY direction → EM capital flows → global risk capacity
//
// Each link is only ACTIVE when underlying live signals are present and above
// minimum significance threshold. No active signal = link excluded.
//
// Causal language is always CONDITIONAL: "suggests → may transmit → implies"
// Never: "will cause", "definitely transmits", "guaranteed to impact"
//
// Educational/advisory only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type TransmissionPair =
  | "bonds_to_equities"
  | "dxy_to_commodities"
  | "yields_to_growth"
  | "oil_to_liquidity"
  | "fx_to_risk_appetite";

export type TransmissionDirection = "amplifying" | "dampening" | "neutral";
export type TransmissionMagnitude = "strong" | "moderate" | "weak";

export interface AssetTransmissionLink {
  pair:      TransmissionPair;
  direction: TransmissionDirection;
  narrative: string;  // ≤72 chars: conditional causal chain
  magnitude: TransmissionMagnitude;
  isActive:  boolean;
}

export interface CrossAssetTransmissionResult {
  activeLinks:       AssetTransmissionLink[];
  dominantLink:      AssetTransmissionLink | null;
  transmissionCtx:   string;   // ≤240 chars injectable
  amplificationRisk: boolean;  // true when ≥2 amplifying links active
}

// ─── Transmission detectors ───────────────────────────────────────────────────

function bondToEquity(
  tltChangePct: number | null | undefined,
): AssetTransmissionLink {
  const pair: TransmissionPair = "bonds_to_equities";
  if (tltChangePct == null || Math.abs(tltChangePct) < 0.4) {
    return { pair, direction: "neutral", narrative: "", magnitude: "weak", isActive: false };
  }
  const magnitude: TransmissionMagnitude = Math.abs(tltChangePct) >= 2 ? "strong" : Math.abs(tltChangePct) >= 1 ? "moderate" : "weak";
  if (tltChangePct < 0) {
    // TLT falling → yields rising → always amplifying pressure on equities (rate rise = discount rate ↑)
    // Direction is amplifying for any significant decline; only "neutral" for marginal moves
    const dir: TransmissionDirection = magnitude !== "weak" ? "amplifying" : "neutral";
    return {
      pair, direction: dir, magnitude, isActive: true,
      narrative: `Yields rising (TLT ${tltChangePct.toFixed(1)}%) → discount rate ↑ → P/E compression; long-duration most exposed`,
    };
  }
  // TLT rising → yields falling → equity multiple relief
  return {
    pair, direction: "dampening", magnitude, isActive: true,
    narrative: `Yields falling (TLT +${tltChangePct.toFixed(1)}%) → discount rate relief → duration bid; equity re-rating possible`,
  };
}

function dxyToCommodities(eurUsd: number | null | undefined): AssetTransmissionLink {
  const pair: TransmissionPair = "dxy_to_commodities";
  if (eurUsd == null) {
    return { pair, direction: "neutral", narrative: "", magnitude: "weak", isActive: false };
  }
  if (eurUsd < 1.05) {
    return {
      pair, direction: "amplifying", magnitude: "strong", isActive: true,
      narrative: `DXY strength (EUR/USD ${eurUsd.toFixed(2)}) → commodity USD pricing pressure → oil/metals demand headwind`,
    };
  }
  if (eurUsd > 1.12) {
    return {
      pair, direction: "dampening", magnitude: "moderate", isActive: true,
      narrative: `USD softening (EUR/USD ${eurUsd.toFixed(2)}) → commodity support; EM purchasing power improves`,
    };
  }
  return { pair, direction: "neutral", narrative: "", magnitude: "weak", isActive: false };
}

function yieldsToGrowth(
  tltChangePct: number | null | undefined,
  creditStress: "low" | "moderate" | "high" | "extreme",
): AssetTransmissionLink {
  const pair: TransmissionPair = "yields_to_growth";
  const isSignificant = (tltChangePct != null && tltChangePct < -1.0) &&
    (creditStress === "high" || creditStress === "extreme");
  if (!isSignificant) {
    return { pair, direction: "neutral", narrative: "", magnitude: "weak", isActive: false };
  }
  const magnitude: TransmissionMagnitude = creditStress === "extreme" ? "strong" : "moderate";
  return {
    pair, direction: "amplifying", magnitude, isActive: true,
    narrative: `Yield shock + ${creditStress} credit stress → financing cost spike → capex slowdown → earnings compression risk`,
  };
}

// Remove the unused constant (oil decline handled via oilChangePct signal)

function oilToLiquidity(
  oilPrice: number | null | undefined,
  oilChangePct: number | null | undefined,
  isSaudi: boolean,
): AssetTransmissionLink {
  const pair: TransmissionPair = "oil_to_liquidity";
  if (oilPrice == null || oilChangePct == null || Math.abs(oilChangePct) < 2) {
    return { pair, direction: "neutral", narrative: "", magnitude: "weak", isActive: false };
  }
  const magnitude: TransmissionMagnitude = Math.abs(oilChangePct) >= 5 ? "strong" : "moderate";
  if (oilChangePct < -2) {
    const saudiNote = isSaudi ? "; Saudi petrodollar recycling slows" : "";
    return {
      pair, direction: "amplifying", magnitude, isActive: true,
      narrative: `Oil -${Math.abs(oilChangePct).toFixed(1)}% → petrodollar recycling contraction → global dollar liquidity tightening${saudiNote}`,
    };
  }
  const saudiNote = isSaudi ? "; Saudi sovereign wealth recycling accelerates" : "";
  return {
    pair, direction: "dampening", magnitude, isActive: true,
    narrative: `Oil +${oilChangePct.toFixed(1)}% → petrodollar surplus reinvestment → global dollar liquidity injection${saudiNote}`,
  };
}

function fxToRiskAppetite(
  eurUsd: number | null | undefined,
  spyChangePct: number | null | undefined,
): AssetTransmissionLink {
  const pair: TransmissionPair = "fx_to_risk_appetite";
  if (eurUsd == null) {
    return { pair, direction: "neutral", narrative: "", magnitude: "weak", isActive: false };
  }
  if (eurUsd < 1.04) {
    const magnitude: TransmissionMagnitude = eurUsd < 1.00 ? "strong" : "moderate";
    return {
      pair, direction: "amplifying", magnitude, isActive: true,
      narrative: `Dollar strength (EUR/USD ${eurUsd.toFixed(2)}) → EM capital outflows → risk appetite contraction; GCC peg insulates SAR`,
    };
  }
  if (eurUsd > 1.13) {
    const magnitude: TransmissionMagnitude = "moderate";
    return {
      pair, direction: "dampening", magnitude, isActive: true,
      narrative: `USD softening → EM capital inflows → risk appetite expansion; commodity-exporting EM benefit most`,
    };
  }
  return { pair, direction: "neutral", narrative: "", magnitude: "weak", isActive: false };
}

// ─── Context builder ──────────────────────────────────────────────────────────

function trimTo(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 3) + "...";
}

function buildTransmissionCtx(links: AssetTransmissionLink[]): string {
  if (links.length === 0) return "No active cross-asset transmission signals detected.";
  const dominant = links.sort((a, b) => {
    const mScore = (m: TransmissionMagnitude) => m === "strong" ? 3 : m === "moderate" ? 2 : 1;
    return mScore(b.magnitude) - mScore(a.magnitude);
  })[0];
  const parts = links.slice(0, 3).map(l => trimTo(l.narrative, 75)).filter(Boolean);
  return parts.join(" | ").slice(0, 240);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildCrossAssetTransmission(input: {
  tltChangePct:      number | null | undefined;
  oilChangePct:      number | null | undefined;
  oilPrice:          number | null | undefined;
  eurUsd:            number | null | undefined;
  spyChangePct:      number | null | undefined;
  creditStressLevel: "low" | "moderate" | "high" | "extreme";
  macroBias:         "bullish" | "bearish" | "neutral";
  isSaudi:           boolean;
}): CrossAssetTransmissionResult {
  const { tltChangePct, oilChangePct, oilPrice, eurUsd, spyChangePct, creditStressLevel, isSaudi } = input;

  const allLinks: AssetTransmissionLink[] = [
    bondToEquity(tltChangePct),
    dxyToCommodities(eurUsd),
    yieldsToGrowth(tltChangePct, creditStressLevel),
    oilToLiquidity(oilPrice, oilChangePct, isSaudi),
    fxToRiskAppetite(eurUsd, spyChangePct),
  ];

  const activeLinks       = allLinks.filter(l => l.isActive);
  const dominantLink      = activeLinks.length > 0
    ? activeLinks.sort((a, b) => (b.magnitude === "strong" ? 1 : 0) - (a.magnitude === "strong" ? 1 : 0))[0]
    : null;
  const amplificationRisk = activeLinks.filter(l => l.direction === "amplifying").length >= 2;
  const transmissionCtx   = buildTransmissionCtx(activeLinks);

  return { activeLinks, dominantLink, transmissionCtx, amplificationRisk };
}
