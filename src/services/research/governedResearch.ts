// Phase-71: Governed Knowledge Acquisition — Research Layer
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Distinct from Phase-50A (governedKnowledgeAcquisition.ts) which handles the
// generic source-to-corpus pipeline. This module adds:
//   - A concrete approved-source registry (universities, institutions, practitioners)
//   - Source state classification (approved / candidate_review / rejected / historical_only)
//   - Research topic classification from question content
//   - Governance rules enforcing approved-only sourcing
//
// No open crawling. No autonomous ingestion. No copyrighted text.
// Every source must be in the approved registry or classified as candidate/rejected.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SourceState =
  | "approved"          // in approved registry; peer-reviewed or institutional
  | "candidate_review"  // known source; not yet classified; requires governance
  | "rejected"          // social media, anonymous, unverified, or hype-driven
  | "historical_only";  // useful for historical context only; not live prediction

export type ResearchType =
  | "economic_research"        // macroeconomics, monetary theory, growth models
  | "policy_papers"            // CB, IMF, OECD, government policy documents
  | "institutional_publications" // annual reports, stability reviews, market surveys
  | "university_material"      // working papers, academic journals, dissertations
  | "historical_macro"         // postmortems, historical episode analyses
  | "practitioner_framework"   // documented investment frameworks from known practitioners
  | "unclassified";            // cannot be classified from available context

export type SourceTier = "tier_1" | "tier_2" | "practitioner" | "unknown";

export interface ApprovedSource {
  name: string;
  tier: SourceTier;
  domain: string;           // economics | central_banking | policy | markets | behavioral
  researchTypes: ResearchType[];
  credibilityAnchor: number; // 0-100 baseline credibility for this source
  biasFlag: string | null;   // known methodological or ideological bias, if any
  note: string;              // 1-sentence characterization
}

export interface ResearchClassification {
  researchType: ResearchType;
  sourceState: SourceState;
  matchedSource: ApprovedSource | null;
  governanceNote: string;    // 1 sentence on governance status
  fusionContext: string;     // compact ≤120 chars for Genesis injection
}

// ─── Approved source registry ──────────────────────────────────────────────────

export const APPROVED_SOURCES: ApprovedSource[] = [
  // Tier-1 Universities
  { name: "Harvard", tier: "tier_1", domain: "economics", researchTypes: ["economic_research","university_material"], credibilityAnchor: 92, biasFlag: null, note: "Broad macro, fiscal, and development economics research." },
  { name: "Yale", tier: "tier_1", domain: "economics", researchTypes: ["economic_research","university_material","historical_macro"], credibilityAnchor: 90, biasFlag: null, note: "Shiller macro valuation, behavioral, and long-run return research." },
  { name: "MIT", tier: "tier_1", domain: "economics", researchTypes: ["economic_research","university_material"], credibilityAnchor: 93, biasFlag: null, note: "Monetary economics, trade, and development research." },
  { name: "Chicago", tier: "tier_1", domain: "economics", researchTypes: ["economic_research","university_material"], credibilityAnchor: 91, biasFlag: "monetarist_lean", note: "Free-market, monetarist tradition; strong empirical methods." },
  { name: "Stanford", tier: "tier_1", domain: "economics", researchTypes: ["economic_research","university_material"], credibilityAnchor: 90, biasFlag: null, note: "Macro, finance, and technology economics research." },
  { name: "Oxford", tier: "tier_1", domain: "economics", researchTypes: ["economic_research","policy_papers","university_material"], credibilityAnchor: 89, biasFlag: null, note: "Development economics, macro policy, and EU economics." },
  { name: "Cambridge", tier: "tier_1", domain: "economics", researchTypes: ["economic_research","university_material","historical_macro"], credibilityAnchor: 89, biasFlag: "keynesian_lean", note: "Keynesian tradition; macroeconomics and post-Keynesian research." },
  { name: "LSE", tier: "tier_1", domain: "economics", researchTypes: ["economic_research","policy_papers","university_material"], credibilityAnchor: 88, biasFlag: null, note: "Financial economics, international macro, and regulation research." },
  { name: "Wharton", tier: "tier_1", domain: "markets", researchTypes: ["economic_research","university_material","institutional_publications"], credibilityAnchor: 88, biasFlag: null, note: "Finance, portfolio theory, and empirical asset pricing." },
  { name: "Princeton", tier: "tier_1", domain: "economics", researchTypes: ["economic_research","university_material","policy_papers"], credibilityAnchor: 91, biasFlag: null, note: "Monetary economics, international finance, and macro research." },
  { name: "Columbia", tier: "tier_1", domain: "economics", researchTypes: ["economic_research","university_material","policy_papers"], credibilityAnchor: 88, biasFlag: null, note: "Development economics, financial crises, and macro research." },
  { name: "INSEAD", tier: "tier_1", domain: "markets", researchTypes: ["university_material","institutional_publications","practitioner_framework"], credibilityAnchor: 85, biasFlag: null, note: "Finance, strategy, and emerging market research." },
  // Central banks and multilaterals
  { name: "Federal Reserve", tier: "tier_2", domain: "central_banking", researchTypes: ["policy_papers","institutional_publications","economic_research"], credibilityAnchor: 94, biasFlag: null, note: "Primary US monetary policy authority; FEDS Notes and working papers." },
  { name: "ECB", tier: "tier_2", domain: "central_banking", researchTypes: ["policy_papers","institutional_publications","economic_research"], credibilityAnchor: 93, biasFlag: null, note: "Euro area monetary policy; working papers and financial stability reviews." },
  { name: "IMF", tier: "tier_2", domain: "policy", researchTypes: ["policy_papers","economic_research","institutional_publications"], credibilityAnchor: 91, biasFlag: null, note: "Global macro surveillance, WEO, and GFSR publications." },
  { name: "World Bank", tier: "tier_2", domain: "policy", researchTypes: ["policy_papers","economic_research","institutional_publications"], credibilityAnchor: 89, biasFlag: null, note: "Development economics, poverty, and emerging market research." },
  { name: "BIS", tier: "tier_2", domain: "central_banking", researchTypes: ["policy_papers","institutional_publications","economic_research","historical_macro"], credibilityAnchor: 93, biasFlag: null, note: "Financial stability, credit cycles, and cross-border banking research." },
  { name: "OECD", tier: "tier_2", domain: "policy", researchTypes: ["policy_papers","institutional_publications","economic_research"], credibilityAnchor: 88, biasFlag: null, note: "Comparative policy research; Economic Outlook publications." },
  { name: "SAMA", tier: "tier_2", domain: "central_banking", researchTypes: ["policy_papers","institutional_publications"], credibilityAnchor: 87, biasFlag: null, note: "Saudi Arabian Monetary Authority; SAR peg policy and local banking data." },
  { name: "BoE", tier: "tier_2", domain: "central_banking", researchTypes: ["policy_papers","institutional_publications","economic_research"], credibilityAnchor: 92, biasFlag: null, note: "UK monetary policy; Quarterly Bulletin and financial stability reports." },
  { name: "BoJ", tier: "tier_2", domain: "central_banking", researchTypes: ["policy_papers","institutional_publications","economic_research"], credibilityAnchor: 90, biasFlag: null, note: "Japan monetary policy; working papers on liquidity traps and yield curve control." },
  // Practitioner frameworks
  { name: "Dalio", tier: "practitioner", domain: "markets", researchTypes: ["practitioner_framework","economic_research"], credibilityAnchor: 78, biasFlag: null, note: "Debt cycle and all-weather portfolio frameworks; empirical rather than academic." },
  { name: "Marks", tier: "practitioner", domain: "markets", researchTypes: ["practitioner_framework"], credibilityAnchor: 76, biasFlag: null, note: "Credit cycle, risk-adjusted return, and second-level thinking frameworks." },
  { name: "Fama", tier: "tier_1", domain: "markets", researchTypes: ["economic_research","university_material"], credibilityAnchor: 93, biasFlag: "efficient_market_lean", note: "EMH, factor premia, and empirical asset pricing; Nobel laureate." },
  { name: "Shiller", tier: "tier_1", domain: "markets", researchTypes: ["economic_research","university_material"], credibilityAnchor: 91, biasFlag: "behavioral_lean", note: "CAPE valuation, narrative economics, and irrational exuberance research." },
  { name: "Minsky", tier: "tier_1", domain: "economics", researchTypes: ["economic_research","historical_macro"], credibilityAnchor: 88, biasFlag: "institutional_lean", note: "Financial instability hypothesis; endogenous credit cycle theory." },
  { name: "Keynes", tier: "tier_1", domain: "economics", researchTypes: ["economic_research","historical_macro"], credibilityAnchor: 90, biasFlag: "keynesian_lean", note: "Aggregate demand, fiscal multiplier, and animal spirits frameworks." },
  { name: "Friedman", tier: "tier_1", domain: "economics", researchTypes: ["economic_research","historical_macro","policy_papers"], credibilityAnchor: 90, biasFlag: "monetarist_lean", note: "Monetarist inflation theory, permanent income hypothesis, Great Depression revisionism." },
  { name: "Soros", tier: "practitioner", domain: "markets", researchTypes: ["practitioner_framework","historical_macro"], credibilityAnchor: 74, biasFlag: null, note: "Reflexivity theory; boom-bust cycle framework; macro trading perspective." },
];

// ─── Source detection ──────────────────────────────────────────────────────────

const SOURCE_PATTERNS: Array<{ pattern: RegExp; name: string }> = APPROVED_SOURCES.map(s => ({
  pattern: new RegExp(`\\b${s.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
  name: s.name,
}));

const REJECTED_PATTERNS = /twitter|reddit|tiktok|instagram|facebook|telegram|whatsapp|rumor|gossip|anonymous|social media|سوشيال|تويتر|تيك توك|تلغرام|شائعة|مجهول/i;
const HISTORICAL_PATTERNS = /\b(historical|history|1970s|1930s|great depression|1987|2000|dotcom|2008|2020|covid|oil shock|crisis of|postmortem)\b/i;

export function detectSourceState(text: string): SourceState {
  if (REJECTED_PATTERNS.test(text)) return "rejected";
  if (HISTORICAL_PATTERNS.test(text) && !SOURCE_PATTERNS.some(p => p.pattern.test(text))) return "historical_only";
  if (SOURCE_PATTERNS.some(p => p.pattern.test(text))) return "approved";
  return "candidate_review";
}

export function matchApprovedSource(text: string): ApprovedSource | null {
  for (const { pattern, name } of SOURCE_PATTERNS) {
    if (pattern.test(text)) return APPROVED_SOURCES.find(s => s.name === name) ?? null;
  }
  return null;
}

// ─── Research type detection ───────────────────────────────────────────────────

const TYPE_PATTERNS: Array<{ type: ResearchType; pattern: RegExp }> = [
  { type: "economic_research",          pattern: /working paper|journal|empirical|theory|model|academic|بحث اقتصادي|ورقة بحثية/i },
  { type: "policy_papers",             pattern: /\b(policy|monetary policy|fiscal|regulation|framework|report|outlook|forecast)\b/i },
  { type: "institutional_publications",pattern: /\b(annual report|stability review|survey|bulletin|quarterly review|تقرير سنوي)\b/i },
  { type: "university_material",       pattern: /\b(university|research paper|nber|ssrn|phd|dissertation|working paper|جامعة)\b/i },
  { type: "historical_macro",          pattern: /\b(historical|history|episode|crisis|analog|postmortem|great depression|stagflation|التاريخ|أزمة)\b/i },
  { type: "practitioner_framework",    pattern: /\b(framework|approach|philosophy|method|strategy|memo|letter to investors|مذكرة|إطار)\b/i },
];

export function detectResearchType(question: string): ResearchType {
  for (const { type, pattern } of TYPE_PATTERNS) {
    if (pattern.test(question)) return type;
  }
  return "unclassified";
}

// ─── Governance rules ──────────────────────────────────────────────────────────

const GOVERNANCE_RULES = [
  "No open internet crawling — approved sources only.",
  "No copyrighted verbatim text — compressed paraphrase only.",
  "No single-school dominance — competing frameworks required.",
  "No autonomous ingestion — all additions require human governance review.",
  "No social media or anonymous sourcing — institutional provenance required.",
  "Historical material: advisory and analogical only — not deterministic prediction.",
];

// ─── Public API ────────────────────────────────────────────────────────────────

export function classifyResearch(question: string, context: string): ResearchClassification {
  const combined = `${question} ${context}`;
  const sourceState = detectSourceState(combined);
  const researchType = detectResearchType(combined);
  const matchedSource = matchApprovedSource(combined);

  const governanceNote = sourceState === "approved"
    ? `Approved source (${matchedSource?.name ?? "institutional"}): credibility anchor ${matchedSource?.credibilityAnchor ?? 85}/100.`
    : sourceState === "rejected"
    ? "Rejected source detected — social/anonymous origin; credibility penalty applies."
    : sourceState === "historical_only"
    ? "Historical material — use as analogical context only; not live prediction."
    : "Candidate review — source not yet classified; treat as moderate credibility.";

  const fusionContext = `Research: ${researchType.replace(/_/g, " ")} | Source: ${sourceState}${matchedSource ? ` (${matchedSource.name})` : ""}`.slice(0, 120);

  return { researchType, sourceState, matchedSource, governanceNote, fusionContext };
}

export function buildResearchGovernanceContext(classification: ResearchClassification): string {
  const { researchType, sourceState, matchedSource, governanceNote } = classification;
  if (sourceState === "rejected") return `Research governance: rejected source — treat with maximum scepticism; no directional confidence from this material.`;
  if (sourceState === "approved" && matchedSource)
    return `Research governance: approved source (${matchedSource.name}, ${matchedSource.tier}, anchor ${matchedSource.credibilityAnchor}/100${matchedSource.biasFlag ? `, bias: ${matchedSource.biasFlag}` : ""}) | Type: ${researchType.replace(/_/g, " ")} | ${governanceNote}`;
  return `Research governance: ${sourceState} | ${researchType.replace(/_/g, " ")} | ${governanceNote}`;
}
