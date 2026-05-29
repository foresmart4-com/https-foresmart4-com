// Phase-72: Knowledge Graph
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Distinct from knowledgeCorpus.ts (flat 22-card static list) and
// knowledgeLibrary.ts (flat 13-card Phase-28 library).
// This module represents RELATIONSHIPS between economic concepts as a graph:
//   - Nodes: economic concepts (inflation, liquidity, credit stress, etc.)
//   - Edges: causal, amplifying, constraining, conflicting relationships
//
// Graph query: given a question/regime, find relevant concept nodes and
// traverse their relationships to build a concept-linkage context string.
// No flat summaries — graph structure enforces linkage thinking.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type EdgeType =
  | "causes"        // A directly causes B
  | "amplifies"     // A makes B stronger when both present
  | "constrains"    // A limits or suppresses B
  | "conflicts_with"// A and B point in opposite directions
  | "enables"       // A is a prerequisite for B
  | "transmits_to"; // macro transmission: A propagates its effect to B

export type ConceptDomain =
  | "monetary"    // CB policy, rates, money supply
  | "fiscal"      // government spending, deficits, debt
  | "credit"      // credit conditions, spreads, lending
  | "liquidity"   // market and funding liquidity
  | "commodities" // oil, metals, energy
  | "sentiment"   // risk appetite, positioning, behavioral
  | "growth"      // GDP, earnings, PMI
  | "currency"    // FX, DXY, SAR peg
  | "inflation"   // CPI, real rates, price levels
  | "valuation";  // P/E, EV/EBITDA, yield spreads

export interface GraphNode {
  id: string;
  label: string;
  domain: ConceptDomain;
  keywords: string[];  // lowercase match keywords
}

export interface GraphEdge {
  from: string;     // node id
  to: string;       // node id
  type: EdgeType;
  description: string; // ≤80 chars: mechanism or condition
  strength: "strong" | "moderate" | "conditional"; // confidence in the relationship
}

export interface GraphQueryResult {
  matchedNodes: GraphNode[];
  relevantEdges: GraphEdge[];
  conceptLinkage: string;  // multi-hop chain description
  graphContext: string;    // compact injectable context ≤200 chars
}

// ─── Concept graph ─────────────────────────────────────────────────────────────

export const KNOWLEDGE_NODES: GraphNode[] = [
  { id: "inflation",       label: "Inflation",           domain: "inflation",  keywords: ["inflation","cpi","price","تضخم","أسعار"] },
  { id: "real_rates",      label: "Real Interest Rates", domain: "monetary",   keywords: ["real rate","real yield","معدل حقيقي"] },
  { id: "nominal_rates",   label: "Nominal Rates",       domain: "monetary",   keywords: ["interest rate","yield","fed funds","rate hike","فائدة","عائد"] },
  { id: "liquidity",       label: "Global Liquidity",    domain: "liquidity",  keywords: ["liquidity","qe","quantitative easing","سيولة","تيسير"] },
  { id: "credit_stress",   label: "Credit Stress",       domain: "credit",     keywords: ["credit stress","spread","hy spread","ائتمان","فروقات"] },
  { id: "risk_appetite",   label: "Risk Appetite",       domain: "sentiment",  keywords: ["risk on","risk off","risk appetite","شهية","مخاطرة"] },
  { id: "oil_price",       label: "Oil Price",           domain: "commodities",keywords: ["oil","crude","wti","brent","نفط","برنت"] },
  { id: "dxy_usd",         label: "USD/DXY",             domain: "currency",   keywords: ["dollar","dxy","usd","eur/usd","دولار","دي إكس واي"] },
  { id: "fiscal_space",    label: "Fiscal Space",        domain: "fiscal",     keywords: ["fiscal","deficit","surplus","government spending","مالي","ميزانية"] },
  { id: "earnings",        label: "Earnings Cycle",      domain: "growth",     keywords: ["earnings","eps","profit","أرباح","عائد"] },
  { id: "valuations",      label: "Asset Valuations",    domain: "valuation",  keywords: ["valuation","pe ratio","multiple","تقييم","مضاعف"] },
  { id: "growth",          label: "Economic Growth",     domain: "growth",     keywords: ["gdp","growth","pmi","expansion","نمو","ناتج"] },
  { id: "em_flows",        label: "EM Capital Flows",    domain: "currency",   keywords: ["em flows","emerging market","capital flow","تدفق","ناشئة"] },
  { id: "sar_peg",         label: "SAR Peg Constraint",  domain: "monetary",   keywords: ["sar peg","sama","saudi","riyal","ربط","ريال"] },
  { id: "china_demand",    label: "China Demand",        domain: "growth",     keywords: ["china","chinese","pmi","الصين","طلب صيني"] },
  { id: "gold",            label: "Gold",                domain: "commodities",keywords: ["gold","xau","paxg","ذهب"] },
  { id: "credit_cycle",    label: "Credit Cycle",        domain: "credit",     keywords: ["credit cycle","lending","leverage","دورة ائتمان","رافعة"] },
];

export const KNOWLEDGE_EDGES: GraphEdge[] = [
  // Inflation chain
  { from: "nominal_rates", to: "real_rates",    type: "causes",      description: "Rate hikes raise real rates unless inflation rises equally",      strength: "strong" },
  { from: "real_rates",    to: "valuations",    type: "constrains",  description: "Higher real rates compress equity and bond multiples",            strength: "strong" },
  { from: "liquidity",     to: "inflation",     type: "amplifies",   description: "Excess liquidity passes into asset then consumer prices",         strength: "moderate" },
  { from: "oil_price",     to: "inflation",     type: "transmits_to",description: "Oil feeds into energy/transport CPI; second-round via wages",     strength: "strong" },
  { from: "inflation",     to: "nominal_rates", type: "causes",      description: "CB responds to inflation persistence with rate increases",         strength: "strong" },
  // Liquidity chain
  { from: "liquidity",     to: "risk_appetite", type: "enables",     description: "Dollar liquidity expansion supports cross-asset risk-on",         strength: "strong" },
  { from: "dxy_usd",       to: "liquidity",     type: "constrains",  description: "Strong USD drains dollar liquidity from non-US markets",          strength: "strong" },
  { from: "credit_stress", to: "liquidity",     type: "constrains",  description: "Funding stress reduces effective liquidity even at low rates",    strength: "strong" },
  // Credit cycle
  { from: "credit_cycle",  to: "growth",        type: "amplifies",   description: "Credit expansion drives investment and consumption above trend",  strength: "strong" },
  { from: "credit_cycle",  to: "credit_stress", type: "causes",      description: "Minsky: stability breeds instability; leverage peaks trigger stress", strength: "strong" },
  { from: "credit_stress", to: "risk_appetite", type: "constrains",  description: "Spread widening signals funding risk; reduces risk appetite",     strength: "strong" },
  // Oil fiscal Saudi chain
  { from: "oil_price",     to: "fiscal_space",  type: "causes",      description: "Saudi budget breakeven ~$75-80/bbl; oil above = surplus",        strength: "strong" },
  { from: "fiscal_space",  to: "growth",        type: "enables",     description: "Saudi surplus funds Vision 2030 capex → GDP growth",             strength: "strong" },
  // USD / EM chain
  { from: "dxy_usd",       to: "em_flows",      type: "constrains",  description: "DXY strength → EM repatriation incentive → capital outflows",    strength: "strong" },
  { from: "dxy_usd",       to: "oil_price",     type: "conflicts_with",description: "Oil priced in USD: strong DXY → demand-side headwind for oil",  strength: "moderate" },
  { from: "em_flows",      to: "sar_peg",       type: "transmits_to",description: "Foreign outflows pressure SAR-pegged liquidity even with fixed rate", strength: "moderate" },
  // China demand
  { from: "china_demand",  to: "oil_price",     type: "amplifies",   description: "China drives ~15% of global oil demand; PMI directional signal", strength: "strong" },
  { from: "china_demand",  to: "growth",        type: "amplifies",   description: "China is the marginal demand driver for global commodities",       strength: "strong" },
  // Risk appetite
  { from: "risk_appetite", to: "valuations",    type: "enables",     description: "Risk-on compresses risk premia → multiple expansion",            strength: "strong" },
  { from: "gold",          to: "risk_appetite", type: "conflicts_with",description: "Gold rising in haven mode = risk appetite absent or falling",    strength: "moderate" },
  // Earnings
  { from: "growth",        to: "earnings",      type: "causes",      description: "GDP expansion drives revenue growth → earnings cycle uplift",      strength: "strong" },
  { from: "inflation",     to: "earnings",      type: "amplifies",   description: "Moderate inflation supports nominal revenue but margins compress at extremes", strength: "conditional" },
  { from: "earnings",      to: "valuations",    type: "enables",     description: "Strong earnings growth justifies higher multiples",                strength: "strong" },
  // Rates-valuation
  { from: "nominal_rates", to: "valuations",    type: "constrains",  description: "Higher discount rate reduces PV of future cash flows → P/E compression", strength: "strong" },
  // Nominal rates → fiscal
  { from: "nominal_rates", to: "fiscal_space",  type: "constrains",  description: "Higher rates raise debt service costs → reduce fiscal space",    strength: "moderate" },
];

// ─── Graph query ───────────────────────────────────────────────────────────────

function findMatchedNodes(question: string, ctx: string): GraphNode[] {
  const text = `${question} ${ctx}`.toLowerCase();
  return KNOWLEDGE_NODES.filter(n => n.keywords.some(k => text.includes(k)));
}

function findRelevantEdges(nodes: GraphNode[]): GraphEdge[] {
  const ids = new Set(nodes.map(n => n.id));
  return KNOWLEDGE_EDGES.filter(e => ids.has(e.from) || ids.has(e.to));
}

function buildConceptLinkage(nodes: GraphNode[], edges: GraphEdge[]): string {
  if (!nodes.length) return "No concept linkage detected.";
  // Build 2-3 strongest causal chains
  const causalEdges = edges.filter(e => e.type === "causes" || e.type === "transmits_to");
  const chains: string[] = [];
  for (const e of causalEdges.slice(0, 3)) {
    const from = KNOWLEDGE_NODES.find(n => n.id === e.from)?.label ?? e.from;
    const to   = KNOWLEDGE_NODES.find(n => n.id === e.to)?.label ?? e.to;
    chains.push(`${from} → ${to}: ${e.description}`);
  }
  const conflictEdges = edges.filter(e => e.type === "conflicts_with").slice(0, 1);
  for (const e of conflictEdges) {
    const from = KNOWLEDGE_NODES.find(n => n.id === e.from)?.label ?? e.from;
    const to   = KNOWLEDGE_NODES.find(n => n.id === e.to)?.label ?? e.to;
    chains.push(`${from} ↔ conflict ↔ ${to}: ${e.description}`);
  }
  return chains.join("; ") || `Concepts linked: ${nodes.slice(0, 3).map(n => n.label).join(", ")}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function queryKnowledgeGraph(question: string, ctx: string = ""): GraphQueryResult {
  const matchedNodes = findMatchedNodes(question, ctx);
  const relevantEdges = findRelevantEdges(matchedNodes);
  const conceptLinkage = buildConceptLinkage(matchedNodes, relevantEdges);

  const nodeLabels = matchedNodes.slice(0, 4).map(n => n.label).join(", ");
  const graphContext = matchedNodes.length > 0
    ? `Knowledge graph: [${nodeLabels}] — ${relevantEdges.length} relationships mapped`.slice(0, 200)
    : "";

  return { matchedNodes, relevantEdges, conceptLinkage, graphContext };
}
