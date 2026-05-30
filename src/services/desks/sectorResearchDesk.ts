// Phase-89A: Sector Research Desk
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Distinct from sectorIntelligence.ts (Phase-64):
//   sectorIntelligence: rotation context string injected as "Sector intelligence:"
//                       prompt block; regime → sector winners/losers narrative
//   sectorResearchDesk: institutional DESK BRIEFING with structured sector signals —
//                       detects active sectors in the question, maps regime to
//                       desk-specific winners/losers, produces conviction score
//
// The sector desk is the primary voice when the question centres on:
//   specific sectors (energy, banks, tech, cyclicals, defensives),
//   sector rotation, company selection framework, industry dynamics,
//   TASI/Saudi sector allocation, sector-specific valuation
//
// Saudi sector coverage: Energy/Aramco, Banks, Petrochemicals/SABIC,
//   Real Estate/REITs, Telecom, Consumer, Utilities, Healthcare
//
// Global sector coverage: Energy, Financials, Technology, Industrials,
//   Consumer Discretionary, Consumer Staples, Healthcare, Utilities, Materials
//
// deskConviction (0-100): higher when question names specific sectors or
//   asks about rotation/selection.
// deskBriefing ≤160 chars injectable.
// Educational/advisory only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type SectorId =
  | "energy" | "banks" | "tech" | "industrials" | "consumer_disc"
  | "consumer_staples" | "healthcare" | "utilities" | "materials"
  | "petrochemicals" | "real_estate" | "telecom";

export interface SectorDeskBriefing {
  deskId:           "sector";
  activeSectors:    SectorId[];      // sectors detected in question
  regimeWinners:    string;          // ≤55 chars: winning sectors in current regime
  regimeLosers:     string;          // ≤55 chars: losing sectors in current regime
  saudiSectorNote:  string | null;   // ≤60 chars: Saudi-specific sector note if applicable
  deskConviction:   number;          // 0-100
  deskBriefing:     string;          // ≤160 chars injectable
  isActive:         boolean;
}

// ─── Sector keyword detection ─────────────────────────────────────────────────

// Note: patterns use start-of-word \b but NOT end-of-word \b for prefixes
// (e.g., "tech" should match "technology"; "consumer discret" matches "consumer discretionary")
const SECTOR_KEYWORD_MAP: Record<SectorId, RegExp> = {
  energy:           /\b(energy\b|oil\b|gas\b|aramco\b|crude\b|petroleum\b|نفط|طاقة)/i,
  banks:            /\b(bank\w*|financ\w*|lending\b|credit.creat|nim\b|borrow\w*|بنك|مصرف|تمويل)/i,
  tech:             /\b(tech\w*|software\b|semicon\w*|digital\b|تقنية|برمجيات)/i,
  industrials:      /\b(industri\w*|manufactur\w*|capital.goods|defence\b|صناعة|تصنيع)/i,
  consumer_disc:    /\b(consumer.discret|retail\b|leisure\b|travel\b|luxury\b|استهلاك)/i,
  consumer_staples: /\b(consumer.staples|food\b|beverage\b|household\b|staples\b|مواد.غذائية)/i,
  healthcare:       /\b(health\w*|pharma\w*|biotech\b|medical\b|hospital\b|صحة|دواء)/i,
  utilities:        /\b(utilit\w*|power.sector|electric\w*|water.sector|مرافق|كهرباء)/i,
  materials:        /\b(materials?\b|chemical|metal\b|mining\b|steel\b|cement\b|مواد|أسمنت)/i,
  petrochemicals:   /\b(petrochem\w*|sabic\b|naphtha\b|polymer\b|ethylene\b|بتروكيماوي|سابك)/i,
  real_estate:      /\b(real.estate|reit\b|property\b|mortgage\b|عقار|صندوق.عقاري)/i,
  telecom:          /\b(telecom\w*|mobile.sector|broadband\b|stc\b|اتصالات|موبايل)/i,
};

function detectActiveSectors(text: string): SectorId[] {
  return (Object.entries(SECTOR_KEYWORD_MAP) as [SectorId, RegExp][])
    .filter(([, p]) => p.test(text))
    .map(([id]) => id);
}

export function scoreSectorRelevance(question: string, ctx: string): number {
  const text = `${question} ${ctx}`;
  const sectorHits = detectActiveSectors(text).length;
  // Match "which sector" OR "which sectors" (plural), and other rotation signals
  const rotationHit = /\b(sector.rotation|which.sectors?|sector.outlook|sector.alloc|sector.pick|sector.select)\b/i.test(text) ? 20 : 0;
  return Math.min(100, sectorHits * 18 + rotationHit + 5);
}

// ─── Regime → sector mapping ──────────────────────────────────────────────────

type PrimaryRegime =
  | "bull_trending" | "bear_ranging" | "high_vol_risk_off"
  | "low_vol_accumulation" | "macro_transition";

interface SectorRegimeMap {
  winners: string;  // ≤50 chars
  losers:  string;  // ≤50 chars
}

const SECTOR_REGIME_MAP: Record<PrimaryRegime, Record<"bullish"|"neutral"|"bearish", SectorRegimeMap>> = {
  bull_trending: {
    bullish: { winners: "Tech, Consumer Disc, Industrials",   losers: "Utilities, Staples, Healthcare" },
    neutral: { winners: "Financials, Tech, Energy",           losers: "Utilities, Staples" },
    bearish: { winners: "Energy, Financials",                  losers: "Tech, Consumer Disc" },
  },
  low_vol_accumulation: {
    bullish: { winners: "Tech, Consumer Disc, Materials",     losers: "Utilities, Healthcare" },
    neutral: { winners: "Tech, Industrials",                  losers: "Utilities" },
    bearish: { winners: "Financials, Energy",                 losers: "Tech, Consumer Disc" },
  },
  macro_transition: {
    bullish: { winners: "Energy, Financials (selective)",     losers: "Rate-sensitive long-duration" },
    neutral: { winners: "Defensives, Staples",                losers: "Cyclicals (wait for clarity)" },
    bearish: { winners: "Utilities, Healthcare, Staples",     losers: "Banks (spread risk), Tech" },
  },
  bear_ranging: {
    bullish: { winners: "Financials (NIM), Energy",           losers: "Growth tech, REITS" },
    neutral: { winners: "Healthcare, Utilities, Staples",     losers: "Discretionary, Materials" },
    bearish: { winners: "Healthcare, Staples, Cash",          losers: "Cyclicals, Banks, Energy" },
  },
  high_vol_risk_off: {
    bullish: { winners: "Defensive sectors, Gold miners",     losers: "Cyclicals, High-beta tech" },
    neutral: { winners: "Utilities, Healthcare, Staples",     losers: "Banks, Energy, Discretionary" },
    bearish: { winners: "Cash, Staples, Utilities",           losers: "Most risk assets" },
  },
};

function parsePrimaryRegime(regime: string): PrimaryRegime {
  const l = (regime ?? "").toLowerCase().replace(/[-\s]/g, "_");
  if (/bull.*trend|risk_on/.test(l))      return "bull_trending";
  if (/low_vol|accumulation/.test(l))     return "low_vol_accumulation";
  if (/high_vol|risk_off/.test(l))        return "high_vol_risk_off";
  if (/bear.*rang|contraction/.test(l))   return "bear_ranging";
  return "macro_transition";
}

// ─── Saudi sector note ────────────────────────────────────────────────────────

function buildSaudiSectorNote(oilPrice: number | null | undefined, activeSectors: SectorId[]): string | null {
  if (oilPrice == null) return null;
  const energyActive  = activeSectors.includes("energy") || activeSectors.includes("petrochemicals");
  const banksActive   = activeSectors.includes("banks");
  if (oilPrice > 82) {
    if (energyActive) return `Oil $${oilPrice} above breakeven; Aramco/petrochem supportive`;
    if (banksActive)  return `Oil > $82; Saudi fiscal surplus → strong bank deposits`;
    return `Oil $${oilPrice}; Saudi fiscal channel supportive`;
  }
  if (oilPrice < 72) {
    if (energyActive) return `Oil $${oilPrice} < breakeven; Aramco dividend risk`;
    if (banksActive)  return `Oil < $72; government deposit pressure → bank NIM risk`;
    return `Oil $${oilPrice} below ~$75-80 breakeven; fiscal pressure`;
  }
  return `Oil $${oilPrice} near breakeven; Saudi fiscal channel neutral`;
}

// ─── Desk briefing builder ────────────────────────────────────────────────────

function buildDeskBriefing(
  activeSectors: SectorId[],
  winners: string, losers: string,
  saudiNote: string | null,
  conviction: number,
): string {
  const sectorStr  = activeSectors.length > 0 ? activeSectors.slice(0, 3).join("/") : "broad sectors";
  const saudiPart  = saudiNote ? ` | ${saudiNote.slice(0, 55)}` : "";
  return `SECTOR [${sectorStr}]: Winners: ${winners.slice(0,50)} | Losers: ${losers.slice(0,45)}${saudiPart} [conv:${conviction}]`.slice(0, 160);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildSectorDeskBriefing(input: {
  question:    string;
  ctx:         string;
  regime:      string;
  macroBias:   "bullish" | "bearish" | "neutral";
  isSaudi:     boolean;
  oilPrice?:   number | null;
}): SectorDeskBriefing {
  const { question, ctx, regime, macroBias, isSaudi, oilPrice } = input;
  const text = `${question} ${ctx}`;

  const activeSectors   = detectActiveSectors(text);
  const relevanceScore  = scoreSectorRelevance(question, ctx);
  const primaryRegime   = parsePrimaryRegime(regime);
  const tier: "bullish" | "neutral" | "bearish" = macroBias === "bullish" ? "bullish" : macroBias === "bearish" ? "bearish" : "neutral";
  const { winners, losers } = SECTOR_REGIME_MAP[primaryRegime][tier];
  const saudiNote = isSaudi ? buildSaudiSectorNote(oilPrice, activeSectors) : null;

  // Conviction: from relevance + Saudi sector boost
  let conviction = Math.min(95, relevanceScore);
  if (isSaudi && (activeSectors.includes("energy") || activeSectors.includes("banks"))) {
    conviction = Math.min(95, conviction + 15);
  }

  const isActive = conviction >= 25;

  return {
    deskId:          "sector",
    activeSectors,
    regimeWinners:   winners,
    regimeLosers:    losers,
    saudiSectorNote: saudiNote,
    deskConviction:  conviction,
    deskBriefing:    buildDeskBriefing(activeSectors, winners, losers, saudiNote, conviction),
    isActive,
  };
}
