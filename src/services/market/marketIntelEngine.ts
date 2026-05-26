/**
 * Market Intelligence Engine — Genesis Phase
 *
 * Pure cross-asset analysis from AssetQuote[].
 * No network calls. No fake data. No trading logic.
 * Designed to inject compact, structured market context into Genesis.
 *
 * Computes:
 *  1. Market regime (risk_on / risk_off / volatile / mixed / neutral)
 *  2. Regime confidence score
 *  3. Regime transition detection (history-based momentum flip)
 *  4. Market stress score (0-100)
 *  5. Risk-on / risk-off directional score (-100..+100)
 *  6. Sector/asset rotation hints
 *  7. Correlation divergence warnings
 *  8. Asset breadth (bull/bear counts)
 */

import type { AssetCategory, AssetQuote } from "@/lib/market-data";

// ─── Output types ─────────────────────────────────────────────────────────────

export type MarketRegime = "risk_on" | "risk_off" | "volatile" | "mixed" | "neutral";

export type StressLevel = "low" | "moderate" | "elevated" | "high";

export type RotationSignal =
  | "broad_rally"
  | "broad_selloff"
  | "crypto_bid"
  | "metals_bid"
  | "defensive_bid"
  | "none";

export interface MarketIntelSummary {
  regime: MarketRegime;
  regimeConf: number;           // 0-100
  regimeTransition: boolean;    // true when momentum direction flipped in last 12h
  stressScore: number;          // 0-100
  stressLevel: StressLevel;
  riskOnScore: number;          // -100..+100 (positive = risk-on)
  rotation: {
    leading: AssetCategory[];   // top gaining categories
    lagging: AssetCategory[];   // top losing categories
    signal: RotationSignal;
  };
  divergence: {
    detected: boolean;
    description: string;        // "" when not detected
  };
  breadth: {
    bullN: number;
    bearN: number;
    total: number;
    bullPct: number;            // 0-100
  };
  dominantCategory: AssetCategory | null;
  compactContext: string;       // ≤350 chars — injected into Genesis AI context
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function categoryAvg(assets: AssetQuote[], cat: AssetCategory): number | null {
  const group = assets.filter((a) => a.category === cat);
  if (!group.length) return null;
  return group.reduce((s, a) => s + a.changePct, 0) / group.length;
}

// ─── 1+2. Regime classification + confidence ──────────────────────────────────

function classifyRegime(
  assets: AssetQuote[],
  riskOn: number,
): { regime: MarketRegime; conf: number } {
  const total = assets.length || 1;
  const bullN = assets.filter((a) => a.changePct > 0.5).length;
  const bearN = assets.filter((a) => a.changePct < -0.5).length;
  const highVolN = assets.filter((a) => Math.abs(a.changePct) > 2).length;

  const bullRatio = bullN / total;
  const bearRatio = bearN / total;
  const volRatio = highVolN / total;

  // Volatile: broad high moves in both directions
  if (volRatio >= 0.45 && bullRatio + bearRatio >= 0.65) {
    return { regime: "volatile", conf: Math.min(90, Math.round(volRatio * 100)) };
  }
  // Clear risk-on: majority advancing + positive risk-on signal
  if (bullRatio >= 0.60 && riskOn > 10) {
    return { regime: "risk_on", conf: Math.min(90, Math.round(bullRatio * 100 + riskOn * 0.2)) };
  }
  // Clear risk-off: majority declining + negative risk-on signal
  if (bearRatio >= 0.60 && riskOn < -10) {
    return { regime: "risk_off", conf: Math.min(90, Math.round(bearRatio * 100 + Math.abs(riskOn) * 0.2)) };
  }
  // Mild risk-on
  if (bullRatio >= 0.55 && bearRatio <= 0.25) {
    return { regime: "risk_on", conf: Math.round(55 + bullRatio * 20) };
  }
  // Mild risk-off
  if (bearRatio >= 0.55 && bullRatio <= 0.25) {
    return { regime: "risk_off", conf: Math.round(55 + bearRatio * 20) };
  }
  // Mixed when bull/bear ratio are close
  if (Math.abs(bullRatio - bearRatio) <= 0.15 && (bullRatio + bearRatio) >= 0.4) {
    return { regime: "mixed", conf: 52 };
  }
  return { regime: "neutral", conf: 50 };
}

// ─── 3. Regime transition (history momentum flip) ─────────────────────────────

function detectRegimeTransition(assets: AssetQuote[]): boolean {
  // Need at least 3 assets with ≥8 history points
  const withHistory = assets.filter((a) => a.history.length >= 8);
  if (withHistory.length < 3) return false;

  let flipped = 0;
  for (const asset of withHistory) {
    const h = asset.history;
    const mid = Math.floor(h.length / 2);
    const firstPrices = h.slice(0, mid).map((p) => p.p);
    const secondPrices = h.slice(mid).map((p) => p.p);
    if (!firstPrices.length || !secondPrices.length) continue;

    const firstChange =
      (firstPrices[firstPrices.length - 1] - firstPrices[0]) /
      Math.max(firstPrices[0], 0.0001);
    const secondChange =
      (secondPrices[secondPrices.length - 1] - secondPrices[0]) /
      Math.max(secondPrices[0], 0.0001);

    // Count as flipped when: sign reversed AND both moves exceed 0.3%
    if (
      Math.abs(firstChange) > 0.003 &&
      Math.abs(secondChange) > 0.003 &&
      firstChange * secondChange < 0
    ) {
      flipped++;
    }
  }

  // Transition when >40% of assets reversed direction mid-session
  return flipped / withHistory.length > 0.4;
}

// ─── 4. Stress score ─────────────────────────────────────────────────────────

function computeStress(assets: AssetQuote[]): number {
  if (!assets.length) return 0;
  const total = assets.length;
  const highVolN = assets.filter((a) => Math.abs(a.changePct) > 2).length;
  const sharplyDownN = assets.filter((a) => a.changePct < -3).length;
  const volBreadth = highVolN / total;
  const bearBreadth = sharplyDownN / total;
  return Math.min(100, Math.round(volBreadth * 55 + bearBreadth * 45));
}

// ─── 5. Risk-on / risk-off score (-100..+100) ─────────────────────────────────

function computeRiskOnScore(assets: AssetQuote[]): number {
  const crypto  = categoryAvg(assets, "crypto")     ?? 0;
  const stocks  = categoryAvg(assets, "stocks")     ?? 0;
  const metals  = categoryAvg(assets, "metals")     ?? 0;
  const oil     = categoryAvg(assets, "oil")        ?? 0;
  const bonds   = categoryAvg(assets, "bonds")      ?? 0;

  // Risk-on signal: crypto ↑, stocks ↑, oil ↑ weighted against metals ↑ and bonds ↑ (safe haven)
  const riskOnRaw =
    crypto  * 0.30 +
    stocks  * 0.30 +
    oil     * 0.15 -
    metals  * 0.15 -
    bonds   * 0.10;

  return Math.max(-100, Math.min(100, Math.round(riskOnRaw * 7)));
}

// ─── 6. Sector rotation ───────────────────────────────────────────────────────

const ALL_CATEGORIES: AssetCategory[] = ["crypto", "metals", "oil", "stocks", "currencies", "bonds"];

function detectRotation(assets: AssetQuote[]): MarketIntelSummary["rotation"] {
  const avgs = ALL_CATEGORIES
    .map((cat) => ({ cat, avg: categoryAvg(assets, cat) }))
    .filter((x): x is { cat: AssetCategory; avg: number } => x.avg !== null)
    .sort((a, b) => b.avg - a.avg);

  const leading = avgs.filter((x) => x.avg > 0.5).map((x) => x.cat);
  const lagging = avgs.filter((x) => x.avg < -0.5).map((x) => x.cat);

  const top = avgs[0];
  let signal: RotationSignal = "none";

  if (leading.length >= 3 && lagging.length <= 1) {
    signal = "broad_rally";
  } else if (lagging.length >= 3 && leading.length <= 1) {
    signal = "broad_selloff";
  } else if (top?.cat === "crypto" && top.avg > 2 && lagging.some((c) => c === "metals")) {
    signal = "crypto_bid";
  } else if (top?.cat === "metals" && top.avg > 1 && lagging.some((c) => c === "crypto" || c === "stocks")) {
    signal = "metals_bid";
  } else if (
    leading.some((c) => c === "metals" || c === "bonds") &&
    lagging.some((c) => c === "stocks" || c === "crypto")
  ) {
    signal = "defensive_bid";
  }

  return {
    leading: leading.slice(0, 2),
    lagging: lagging.slice(0, 2),
    signal,
  };
}

// ─── 7. Correlation divergence ────────────────────────────────────────────────

function detectDivergence(assets: AssetQuote[]): MarketIntelSummary["divergence"] {
  const btc    = assets.find((a) => a.symbol === "BTC")?.changePct;
  const xau    = assets.find((a) => a.symbol === "XAU")?.changePct;
  const crypto = categoryAvg(assets, "crypto");
  const stocks = categoryAvg(assets, "stocks");

  // Both BTC and Gold rising strongly → risk-on AND safe haven bid → macro uncertainty
  if (btc !== undefined && xau !== undefined && btc > 2 && xau > 1) {
    return { detected: true, description: "BTC+Gold both bid — cross-asset macro uncertainty" };
  }
  // Crypto weak while broader market advances → crypto-specific pressure
  if (crypto !== null && stocks !== null && crypto < -2 && stocks > 0.5) {
    return { detected: true, description: `Crypto weakness vs market strength — crypto-specific pressure` };
  }
  // Crypto surging while broader market falls → speculative rotation into crypto
  if (crypto !== null && stocks !== null && crypto > 3 && stocks < -0.5) {
    return { detected: true, description: `Crypto outpacing declining market — speculative rotation` };
  }
  // Gold strong AND stocks strong → possible stagflation/inflation concern
  if (xau !== undefined && stocks !== null && xau > 1.5 && stocks > 1) {
    return { detected: true, description: `Gold+equities both rising — inflation/hedging divergence` };
  }

  return { detected: false, description: "" };
}

// ─── 8. Compact context string (≤350 chars) ───────────────────────────────────

function buildCompactContext(s: MarketIntelSummary): string {
  const parts: string[] = [];

  // Regime + confidence
  parts.push(`Regime: ${s.regime.replace(/_/g, "-")} (${s.regimeConf}% conf)`);

  // Transition warning
  if (s.regimeTransition) parts.push("⚠ regime-shift detected");

  // Stress
  parts.push(`Stress: ${s.stressLevel} (${s.stressScore}/100)`);

  // Risk-on/off
  const riskDir = s.riskOnScore > 15 ? "risk-on" : s.riskOnScore < -15 ? "risk-off" : "neutral-flow";
  parts.push(`Flow: ${riskDir} (${s.riskOnScore > 0 ? "+" : ""}${s.riskOnScore})`);

  // Breadth
  parts.push(`Breadth: ${s.breadth.bullN}↑ ${s.breadth.bearN}↓ / ${s.breadth.total}`);

  // Rotation
  if (s.rotation.signal !== "none") {
    const lead = s.rotation.leading.length ? ` | leaders: ${s.rotation.leading.join(", ")}` : "";
    parts.push(`Rotation: ${s.rotation.signal.replace(/_/g, " ")}${lead}`);
  }

  // Divergence
  if (s.divergence.detected) {
    parts.push(`Divergence: ${s.divergence.description}`);
  }

  return parts.join(" | ");
}

// ─── Main export ──────────────────────────────────────────────────────────────

const EMPTY: MarketIntelSummary = {
  regime: "neutral",
  regimeConf: 0,
  regimeTransition: false,
  stressScore: 0,
  stressLevel: "low",
  riskOnScore: 0,
  rotation: { leading: [], lagging: [], signal: "none" },
  divergence: { detected: false, description: "" },
  breadth: { bullN: 0, bearN: 0, total: 0, bullPct: 0 },
  dominantCategory: null,
  compactContext: "",
};

export function computeMarketIntel(assets: AssetQuote[]): MarketIntelSummary {
  if (assets.length < 3) return EMPTY;

  const riskOnScore  = computeRiskOnScore(assets);
  const stressScore  = computeStress(assets);
  const { regime, conf: regimeConf } = classifyRegime(assets, riskOnScore);
  const regimeTransition = detectRegimeTransition(assets);
  const rotation         = detectRotation(assets);
  const divergence       = detectDivergence(assets);

  const total  = assets.length;
  const bullN  = assets.filter((a) => a.changePct > 0.5).length;
  const bearN  = assets.filter((a) => a.changePct < -0.5).length;
  const bullPct = Math.round((bullN / total) * 100);

  const stressLevel: StressLevel =
    stressScore >= 70 ? "high" :
    stressScore >= 45 ? "elevated" :
    stressScore >= 20 ? "moderate" : "low";

  // Dominant category: highest |avg changePct| with ≥1 asset
  let dominantCategory: AssetCategory | null = null;
  let domMax = 0;
  for (const cat of ALL_CATEGORIES) {
    const avg = categoryAvg(assets, cat);
    if (avg !== null && Math.abs(avg) > domMax) {
      domMax = Math.abs(avg);
      dominantCategory = cat;
    }
  }

  const summary: MarketIntelSummary = {
    regime, regimeConf, regimeTransition,
    stressScore, stressLevel, riskOnScore,
    rotation, divergence,
    breadth: { bullN, bearN, total, bullPct },
    dominantCategory,
    compactContext: "",
  };

  summary.compactContext = buildCompactContext(summary);
  return summary;
}
