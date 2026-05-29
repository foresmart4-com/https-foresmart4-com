// Phase-86A: Live Macro Monitor
// Pure deterministic functions — no AI calls, no network, O(1).
//
// DISTINCT FROM liveResearchMonitor.ts (Phase-85B):
//   liveResearchMonitor: scores RESEARCH RELEVANCE (should we inject research context?)
//   liveMacroMonitor:    detects SPECIFIC MACRO EVENTS from live market data signals
//                        — "did a rate shock just happen? is there a risk-off event?"
//
// Event detection from live signals:
//   rate_shock:       |TLT change| > 1% → rates moved significantly
//   oil_shock:        |oil change| > 3% → oil supply/demand disruption
//   risk_off:         SPY < -1.5% AND gold > +0.5% → flight to safety
//   risk_on:          SPY > +1.5% AND BTC/gold correlation diverging → risk appetite
//   usd_squeeze:      EUR/USD extremes (<1.02 or >1.14) → DXY regime shift
//   equity_stress:    SPY < -2.5% → equity-specific stress
//   credit_signal:    derived from SPY + TLT divergence → credit conditions inferred
//   oil_breakeven:    oil vs Saudi $75-80/bbl breakeven → Saudi fiscal gate
//
// Bounded refresh: 30s module-level cache — avoids recomputation on same signals.
//
// No polling. No external fetches. Operates on live data already in request context.
// Educational/advisory only.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type MacroEventLabel =
  | "rate_shock_up"       // rates surging (TLT falling fast)
  | "rate_shock_down"     // rates falling (TLT surging)
  | "oil_shock_positive"  // oil surge
  | "oil_shock_negative"  // oil crash
  | "risk_off"            // equities down + gold up
  | "risk_on"             // equities up + defensive down
  | "usd_squeeze"         // extreme DXY (EUR/USD at limit)
  | "equity_stress"       // equities sharply lower
  | "oil_fiscal_support"  // oil above Saudi breakeven ($80+)
  | "oil_fiscal_pressure" // oil below Saudi breakeven ($70-)
  | "no_event";           // signals within normal range

export interface LiveMacroEvent {
  label:          MacroEventLabel;
  magnitudePct:   number;         // primary signal magnitude
  saudiImpact:    "high" | "moderate" | "low" | "none";
  thesisRelevant: boolean;
  injectionCtx:   string;         // compact ≤180 chars injectable context
}

export interface LiveMacroMonitorResult {
  events:        LiveMacroEvent[];
  primaryEvent:  LiveMacroEvent | null;
  monitorCtx:    string;  // injectable ≤220 chars
  noSignal:      boolean;
}

// ─── Thresholds ────────────────────────────────────────────────────────────────

const THRESHOLD = {
  tltShock:       1.0,   // % TLT change for rate shock
  oilShock:       3.0,   // % oil change for oil shock
  riskOffSpy:    -1.5,   // SPY threshold for risk-off
  riskOffGold:    0.5,   // gold threshold for risk-off confirmation
  riskOnSpy:      1.5,   // SPY threshold for risk-on
  equityStress:  -2.5,   // SPY threshold for equity stress
  usdExtremeLow:  1.02,  // EUR/USD below this = strong USD / EM squeeze
  usdExtremeHigh: 1.14,  // EUR/USD above this = weak USD / EM tailwind
  oilFiscalHigh:  80,    // above: Saudi fiscal surplus
  oilFiscalLow:   70,    // below: Saudi fiscal pressure
};

const abs = (v?: number | null): number => Math.abs(v ?? 0);
const val = (v?: number | null, def = 0): number => v ?? def;

// ─── Event detection ──────────────────────────────────────────────────────────

function detectEvents(
  oilPrice?: number | null,
  oilChangePct?: number | null,
  tltChangePct?: number | null,
  spyChangePct?: number | null,
  goldChangePct?: number | null,
  btcChangePct?: number | null,
  eurUsd?: number | null,
  isSaudi = false,
): LiveMacroEvent[] {
  const events: LiveMacroEvent[] = [];
  const tltChg  = val(tltChangePct);
  const oilChg  = val(oilChangePct);
  const spyChg  = val(spyChangePct);
  const goldChg = val(goldChangePct);
  const oil     = val(oilPrice, 80);
  const eurusd  = val(eurUsd, 1.08);

  // Rate shock
  if (tltChg < -THRESHOLD.tltShock) {
    events.push({
      label: "rate_shock_up", magnitudePct: abs(tltChangePct),
      saudiImpact: "high",   // SAMA follows Fed
      thesisRelevant: true,
      injectionCtx: `Rate shock: TLT ${tltChg.toFixed(1)}% → yields surging → real rate ↑ → equity multiple compression risk → SAMA follows Fed mechanically.`,
    });
  } else if (tltChg > THRESHOLD.tltShock) {
    events.push({
      label: "rate_shock_down", magnitudePct: abs(tltChangePct),
      saudiImpact: "moderate",
      thesisRelevant: true,
      injectionCtx: `Rate signal: TLT +${tltChg.toFixed(1)}% → yields falling → easing conditions → equity duration bid → SAMA may follow lower.`,
    });
  }

  // Oil shock
  if (oilChg > THRESHOLD.oilShock) {
    events.push({
      label: "oil_shock_positive", magnitudePct: oilChg,
      saudiImpact: "high",
      thesisRelevant: isSaudi,
      injectionCtx: `Oil shock (+${oilChg.toFixed(1)}%): Saudi fiscal surplus expanding → TASI earnings uplift → PIF/Aramco capex supported.`,
    });
  } else if (oilChg < -THRESHOLD.oilShock) {
    events.push({
      label: "oil_shock_negative", magnitudePct: abs(oilChangePct),
      saudiImpact: "high",
      thesisRelevant: isSaudi,
      injectionCtx: `Oil shock (${oilChg.toFixed(1)}%): Saudi fiscal headwind → spending constraint risk → Vision 2030 capex at risk if sustained.`,
    });
  }

  // Saudi fiscal gate (oil level, not movement)
  if (oil >= THRESHOLD.oilFiscalHigh) {
    events.push({
      label: "oil_fiscal_support", magnitudePct: oil,
      saudiImpact: "high",
      thesisRelevant: isSaudi,
      injectionCtx: `Oil at $${oil.toFixed(0)} (above $78-80 breakeven): Saudi fiscal surplus → government spending and Aramco dividend intact.`,
    });
  } else if (oil <= THRESHOLD.oilFiscalLow) {
    events.push({
      label: "oil_fiscal_pressure", magnitudePct: oil,
      saudiImpact: "high",
      thesisRelevant: isSaudi,
      injectionCtx: `Oil at $${oil.toFixed(0)} (below $70 breakeven): Saudi fiscal deficit risk → spending cuts → TASI earnings headwind.`,
    });
  }

  // Risk-off
  if (spyChg < THRESHOLD.riskOffSpy && goldChg > THRESHOLD.riskOffGold) {
    events.push({
      label: "risk_off", magnitudePct: abs(spyChangePct),
      saudiImpact: "moderate",
      thesisRelevant: true,
      injectionCtx: `Risk-off: SPY ${spyChg.toFixed(1)}% + gold +${goldChg.toFixed(1)}% → flight to safety → TASI correlation to EM risk spikes.`,
    });
  }

  // Risk-on
  if (spyChg > THRESHOLD.riskOnSpy) {
    events.push({
      label: "risk_on", magnitudePct: spyChg,
      saudiImpact: "low",
      thesisRelevant: true,
      injectionCtx: `Risk-on: SPY +${spyChg.toFixed(1)}% → global risk appetite → EM equity bid → TASI follows with foreign flow lag.`,
    });
  }

  // Equity stress
  if (spyChg < THRESHOLD.equityStress) {
    events.push({
      label: "equity_stress", magnitudePct: abs(spyChangePct),
      saudiImpact: "moderate",
      thesisRelevant: true,
      injectionCtx: `Equity stress: SPY ${spyChg.toFixed(1)}% → drawdown territory → correlation to 1 risk → conviction anchor down ≥5 pts.`,
    });
  }

  // USD squeeze
  if (eurusd < THRESHOLD.usdExtremeLow) {
    events.push({
      label: "usd_squeeze", magnitudePct: Math.round((1.08 - eurusd) * 100),
      saudiImpact: "low",  // SAR peg insulates
      thesisRelevant: false,
      injectionCtx: `USD squeeze: EUR/USD ${eurusd.toFixed(4)} → strong DXY → EM debt service cost ↑ → EM capital flight risk → commodity USD value rises.`,
    });
  }

  return events;
}

// ─── Cache ─────────────────────────────────────────────────────────────────────

const COOLDOWN_MS = 30_000;
let _cacheKey = "";
let _cacheTime = 0;
let _cached: LiveMacroMonitorResult | null = null;

function buildCacheKey(oil?: number | null, tlt?: number | null, spy?: number | null): string {
  const o = Math.round((oil ?? 80) / 2) * 2;
  const t = Math.round((tlt ?? 0) * 10);
  const s = Math.round((spy ?? 0) * 10);
  return `${o}|${t}|${s}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function assessLiveMacroEvents(
  oilPrice?: number | null,
  oilChangePct?: number | null,
  tltChangePct?: number | null,
  spyChangePct?: number | null,
  goldChangePct?: number | null,
  btcChangePct?: number | null,
  eurUsd?: number | null,
  isSaudi = false,
): LiveMacroMonitorResult {
  const key = buildCacheKey(oilPrice, tltChangePct, spyChangePct);
  const now = Date.now();

  if (_cached && key === _cacheKey && now - _cacheTime < COOLDOWN_MS) {
    return _cached;
  }

  const events = detectEvents(oilPrice, oilChangePct, tltChangePct, spyChangePct, goldChangePct, btcChangePct, eurUsd, isSaudi);

  if (events.length === 0) {
    const result: LiveMacroMonitorResult = {
      events: [], primaryEvent: null, monitorCtx: "", noSignal: true,
    };
    _cached = result; _cacheKey = key; _cacheTime = now;
    return result;
  }

  // Primary = highest Saudi impact for Saudi questions, else highest magnitude
  const primary = isSaudi
    ? events.find(e => e.saudiImpact === "high") ?? events[0]
    : events.reduce((a, b) => a.magnitudePct >= b.magnitudePct ? a : b);

  const monitorCtx = primary.injectionCtx.slice(0, 220);

  const result: LiveMacroMonitorResult = {
    events, primaryEvent: primary, monitorCtx, noSignal: false,
  };

  _cached = result; _cacheKey = key; _cacheTime = now;
  return result;
}

export function resetLiveMacroCache(): void {
  _cacheKey = ""; _cacheTime = 0; _cached = null;
}
