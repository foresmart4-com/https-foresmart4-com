// Phase-89A: Policy Research Desk
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Distinct from policyIntelligenceEngine.ts (Phase-86A):
//   policyIntelligenceEngine: CB language CLASSIFICATION + policy regime detection
//                              (hawkish_explicit/dovish_lean/pivot_signal etc.)
//   policyResearchDesk: institutional DESK BRIEFING covering CB decisions,
//                       FISCAL POLICY, REGULATION, and SOVEREIGN policy —
//                       broader policy universe than just CB language tier
//
// Policy desk scope (4 domains):
//   central_bank: Fed/SAMA/ECB/BoE/BoJ decisions, forward guidance, dot-plot
//   fiscal_policy: government spending, budget deficit, stimulus, austerity
//   regulation:    financial regulation, market rules, compliance requirements
//   sovereign:     sovereign credit, government debt, geopolitical policy risk
//
// The policy desk is the primary voice when the question focuses on:
//   CB decisions/meetings, rate hike/cut timing, government spending/budget,
//   regulatory changes, sovereign risk, fiscal multipliers, SAMA/Fed linkage
//
// deskConviction (0-100): higher when question explicitly mentions CB, fiscal,
//   or regulatory context.
// deskBriefing ≤160 chars injectable.
// Educational/advisory only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type PolicyDomain  = "central_bank" | "fiscal_policy" | "regulation" | "sovereign";
export type CBStanceLabel = "hawkish" | "dovish" | "on_hold" | "pivoting" | "unknown";
export type FiscalSignal  = "expansionary" | "contractionary" | "neutral" | "unknown";

export interface PolicyDeskBriefing {
  deskId:            "policy";
  activeDomains:     PolicyDomain[];
  cbStance:          CBStanceLabel;
  cbContext:         string;          // ≤55 chars: CB-specific note
  fiscalSignal:      FiscalSignal;
  fiscalContext:     string;          // ≤50 chars: fiscal direction note
  sovereignRisk:     string | null;   // ≤50 chars if applicable
  deskConviction:    number;          // 0-100
  deskBriefing:      string;          // ≤160 chars injectable
  isActive:          boolean;
}

// ─── Policy domain detection ──────────────────────────────────────────────────

const DOMAIN_PATTERNS: Record<PolicyDomain, RegExp> = {
  central_bank:   /\b(fed|federal reserve|ecb|sama|central bank|rate (hike|cut|decision)|monetary policy|dot.plot|fomc|boe|boj|فائدة|سياسة نقدية|ساما)\b/i,
  fiscal_policy:  /\b(fiscal|government spend|budget|deficit|surplus|stimulus|austerity|tax|spending plan|ميزانية|إنفاق حكومي|عجز|فائض)\b/i,
  regulation:     /\b(regulat|compliance|rule|basel|capital require|leverage ratio|supervis|تنظيم|متطلبات.رأس.المال)\b/i,
  sovereign:      /\b(sovereign|government debt|credit.rating|moody|s&p|fitch|geopolit|government.bond|سيادي|ديون.حكومية)\b/i,
};

function detectActiveDomains(text: string): PolicyDomain[] {
  return (Object.entries(DOMAIN_PATTERNS) as [PolicyDomain, RegExp][])
    .filter(([, p]) => p.test(text))
    .map(([id]) => id);
}

export function scorePolicyRelevance(question: string, ctx: string): number {
  const text = `${question} ${ctx}`;
  const domainHits = detectActiveDomains(text).length;
  const cbDecisionHit = /\b(rate.decision|meeting|next.decision|hike.or.cut|pivot|when.will.the.fed)\b/i.test(text) ? 20 : 0;
  return Math.min(100, domainHits * 22 + cbDecisionHit + 5);
}

// ─── CB stance derivation ─────────────────────────────────────────────────────

function deriveCBStance(ratesEnv: string, question: string, ctx: string): CBStanceLabel {
  const text = `${ratesEnv} ${question} ${ctx}`.toLowerCase();
  if (/pivot|about.to.cut|preparing.to.cut|easing.cycle.start/.test(text)) return "pivoting";
  if (/tight|hawkish|restrict|hike|rate.rise|above.neutral/.test(text))    return "hawkish";
  if (/cut|eas|dovish|accommodat|below.neutral|rate.cut/.test(text))        return "dovish";
  if (/hold|pause|on.hold|stable.rate|unchanged.rate/.test(text))           return "on_hold";
  return "unknown";
}

function buildCBContext(
  cbStance: CBStanceLabel,
  isSaudi: boolean,
  ratesEnv: string,
): string {
  const saudiNote = isSaudi ? " | SAMA peg: follows Fed" : "";
  const stanceMap: Record<CBStanceLabel, string> = {
    hawkish:  `CB hawkish; rate pressure on multiples${saudiNote}`,
    dovish:   `CB dovish; easing supports risk${saudiNote}`,
    on_hold:  `CB on hold; uncertainty elevated${saudiNote}`,
    pivoting: `CB pivot signal; market pricing cuts${saudiNote}`,
    unknown:  `CB stance unclear from context`,
  };
  return stanceMap[cbStance].slice(0, 55);
}

// ─── Fiscal signal derivation ─────────────────────────────────────────────────

function deriveFiscalSignal(question: string, ctx: string): FiscalSignal {
  const text = `${question} ${ctx}`.toLowerCase();
  if (/stimulus|expand|spending.rise|budget.increase|deficit.widen|expansionary/.test(text)) return "expansionary";
  if (/austerity|cut.spend|budget.cut|fiscal.tighten|surplus|contractionary/.test(text))    return "contractionary";
  if (/fiscal.neutral|stable.budget|no.change.in.spend/.test(text))                          return "neutral";
  return "unknown";
}

function buildFiscalContext(fiscalSignal: FiscalSignal, isSaudi: boolean, oilPrice: number | null | undefined): string {
  if (isSaudi && oilPrice != null) {
    if (oilPrice > 80) return `Saudi: fiscal surplus; Vision 2030 capex intact`;
    if (oilPrice < 70) return `Saudi: fiscal pressure; spending review risk`;
    return `Saudi: oil near breakeven; fiscal balance uncertain`;
  }
  const map: Record<FiscalSignal, string> = {
    expansionary: "Fiscal stimulus active; multiplier supportive",
    contractionary: "Fiscal tightening; multiplier drag",
    neutral: "Fiscal policy neutral; no added impulse",
    unknown: "Fiscal stance not clear from context",
  };
  return map[fiscalSignal].slice(0, 50);
}

// ─── Sovereign risk ───────────────────────────────────────────────────────────

function buildSovereignRisk(text: string): string | null {
  if (/\b(sovereign.risk|credit.downgrade|rating.cut|rating.watch|government.default|geopolit.risk)\b/i.test(text)) {
    return "Sovereign/rating risk flagged — conditional framing required";
  }
  return null;
}

// ─── Desk briefing builder ────────────────────────────────────────────────────

function buildDeskBriefing(
  activeDomains: PolicyDomain[],
  cbContext: string,
  fiscalContext: string,
  sovereignRisk: string | null,
  conviction: number,
): string {
  const domains = activeDomains.slice(0, 3).join("/") || "policy";
  const sovPart = sovereignRisk ? ` | ${sovereignRisk.slice(0, 35)}` : "";
  return `POLICY [${domains}]: ${cbContext.slice(0,50)} | ${fiscalContext.slice(0,45)}${sovPart} [conv:${conviction}]`.slice(0, 160);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildPolicyDeskBriefing(input: {
  question:    string;
  ctx:         string;
  ratesEnv:    string;
  isSaudi:     boolean;
  oilPrice?:   number | null;
}): PolicyDeskBriefing {
  const { question, ctx, ratesEnv, isSaudi, oilPrice } = input;
  const text = `${question} ${ctx}`;

  const activeDomains   = detectActiveDomains(text);
  const relevanceScore  = scorePolicyRelevance(question, ctx);
  const cbStance        = deriveCBStance(ratesEnv, question, ctx);
  const cbContext       = buildCBContext(cbStance, isSaudi, ratesEnv);
  const fiscalSignal    = deriveFiscalSignal(question, ctx);
  const fiscalContext   = buildFiscalContext(fiscalSignal, isSaudi, oilPrice);
  const sovereignRisk   = buildSovereignRisk(text);

  // Conviction: from relevance + SAMA/peg question boost
  let conviction = Math.min(95, relevanceScore);
  if (isSaudi && /sama|sar.peg|peg|riyal/.test(text.toLowerCase())) conviction = Math.min(95, conviction + 12);
  if (sovereignRisk !== null) conviction = Math.min(95, conviction + 8);

  const isActive = conviction >= 25;

  return {
    deskId:         "policy",
    activeDomains,
    cbStance,
    cbContext,
    fiscalSignal,
    fiscalContext,
    sovereignRisk,
    deskConviction: conviction,
    deskBriefing:   buildDeskBriefing(activeDomains, cbContext, fiscalContext, sovereignRisk, conviction),
    isActive,
  };
}
