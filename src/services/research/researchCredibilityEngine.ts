// Phase-75: Research Governance + Credibility System
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Distinct from credibilityEngine.ts (Phase 34) which scores QUESTION
// credibility based on source signals in the user's text (rumor vs
// institutional). This module scores RESEARCH SOURCES themselves:
//   - Is this source in the approved universe?
//   - What is its empirical support strength?
//   - What is its institutional reliability?
//   - How recent/relevant is its methodology?
//   - What is its known bias risk?
//
// Approved universe:
//   Tier-1 universities: Harvard, Yale, MIT, Chicago, Stanford, Oxford,
//     Cambridge, LSE, Wharton, Princeton, Columbia, INSEAD
//   Institutions: Fed, ECB, IMF, World Bank, BIS, OECD, SAMA, BoE, BoJ
//   Practitioner frameworks: Dalio, Marks, Fama, Shiller, Minsky, Keynes,
//     Friedman, Soros, Buffett, Munger
//
// Evidence > reputation. No celebrity authority. Bias risk always disclosed.

import { APPROVED_SOURCES, type ApprovedSource, type SourceTier } from "./governedResearch";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type EmpiricalSupport =
  | "strong"      // peer-reviewed; replication evidence; CB/IMF consensus
  | "moderate"    // empirically grounded but contested or limited replication
  | "practitioner"// experiential framework; not peer-reviewed; useful heuristic
  | "limited";    // theoretical; limited empirical grounding; use with caution

export type BiasRisk =
  | "low"         // methodology is transparent; competing schools represented
  | "moderate"    // methodological lean; use competing views to balance
  | "high";       // strong ideological or institutional commitment; verify independently

export interface SourceCredibilityScore {
  sourceName: string;
  credibilityScore: number;  // 0-100
  empiricalSupport: EmpiricalSupport;
  institutionalReliability: number; // 0-100: consistency, track record, peer review
  recencyScore: number;      // 0-100: methodology currency
  biasRisk: BiasRisk;
  biasNote: string | null;   // specific bias if known
  approvedSource: ApprovedSource | null;
  tier: SourceTier;
  usageGuidance: string;     // 1 sentence: how to use this source in analysis
  contextString: string;     // compact ≤120 chars for Genesis injection
}

export interface ResearchCredibilityResult {
  sourceScores: SourceCredibilityScore[];
  highestCredibility: SourceCredibilityScore | null;
  dominantBiasRisk: BiasRisk;
  governanceNote: string;    // 1 sentence overall governance assessment
  fusionContext: string;     // injectable Genesis context ≤150 chars
}

// ─── Source scoring tables ────────────────────────────────────────────────────

interface SourceScoringRule {
  pattern: RegExp;
  empiricalSupport: EmpiricalSupport;
  institutionalReliability: number;
  recencyScore: number;
  biasRisk: BiasRisk;
  biasNote: string | null;
  usageGuidance: string;
}

const SOURCE_SCORING_RULES: SourceScoringRule[] = [
  // Fed / major CBs
  {
    pattern: /\b(federal reserve|fed|fomc|feds notes)\b/i,
    empiricalSupport: "strong", institutionalReliability: 95, recencyScore: 92,
    biasRisk: "low", biasNote: null,
    usageGuidance: "Primary monetary policy authority; treat policy signals as the highest-credibility macro input.",
  },
  {
    pattern: /\b(ecb|european central bank)\b/i,
    empiricalSupport: "strong", institutionalReliability: 92, recencyScore: 90,
    biasRisk: "low", biasNote: null,
    usageGuidance: "Euro area policy authority; working papers are rigorous; policy signals are definitive for EUR macro.",
  },
  {
    pattern: /\b(bis|bank for international settlements)\b/i,
    empiricalSupport: "strong", institutionalReliability: 93, recencyScore: 88,
    biasRisk: "low", biasNote: null,
    usageGuidance: "Credit cycle and systemic risk research is best-in-class; treat credit gap metrics as primary indicators.",
  },
  {
    pattern: /\b(imf|international monetary fund)\b/i,
    empiricalSupport: "strong", institutionalReliability: 88, recencyScore: 85,
    biasRisk: "moderate", biasNote: "Historically Washington Consensus lean; conditionality frameworks evolving post-2008.",
    usageGuidance: "WEO and GFSR are primary macro benchmarks; acknowledge bias toward austerity in some country programs.",
  },
  {
    pattern: /\b(sama|saudi arabian monetary authority)\b/i,
    empiricalSupport: "moderate", institutionalReliability: 82, recencyScore: 80,
    biasRisk: "moderate", biasNote: "Government institution; data is authoritative but policy framing reflects Saudi priorities.",
    usageGuidance: "Authoritative for SAR peg, local banking data, and Saudi fiscal statistics; interpret policy signals in government context.",
  },
  // Tier-1 universities
  {
    pattern: /\b(harvard|yale|mit|princeton|stanford|chicago|columbia|oxford|cambridge|lse|wharton|insead)\b/i,
    empiricalSupport: "strong", institutionalReliability: 88, recencyScore: 82,
    biasRisk: "low", biasNote: null,
    usageGuidance: "Peer-reviewed research; use for theoretical grounding; acknowledge school-specific methodological traditions.",
  },
  // Chicago school specifically
  {
    pattern: /\b(chicago (school|university|booth)|university of chicago)\b/i,
    empiricalSupport: "strong", institutionalReliability: 90, recencyScore: 80,
    biasRisk: "moderate", biasNote: "Monetarist and free-market methodological tradition; less emphasis on market imperfections.",
    usageGuidance: "Strong empirical methods; balance with Keynesian/institutional perspectives especially for financial stability topics.",
  },
  // Cambridge / Post-Keynesian
  {
    pattern: /\b(cambridge (university|school)|post.keynesian|new cambridge)\b/i,
    empiricalSupport: "strong", institutionalReliability: 85, recencyScore: 75,
    biasRisk: "moderate", biasNote: "Keynesian and post-Keynesian tradition; less emphasis on supply-side dynamics.",
    usageGuidance: "Strong for fiscal policy and aggregate demand; balance with monetarist perspectives for inflation dynamics.",
  },
  // Nobel laureate practitioners (used as theoretical anchors)
  {
    pattern: /\b(fama|eugene fama)\b/i,
    empiricalSupport: "strong", institutionalReliability: 92, recencyScore: 78,
    biasRisk: "moderate", biasNote: "EMH champion; strong evidence on factor premia; resists behavioral explanations for anomalies.",
    usageGuidance: "Primary source for factor investing and EMH; balance with Shiller and behavioral finance for valuation and market extremes.",
  },
  {
    pattern: /\b(shiller|robert shiller)\b/i,
    empiricalSupport: "strong", institutionalReliability: 90, recencyScore: 83,
    biasRisk: "low", biasNote: null,
    usageGuidance: "Primary source for CAPE valuation, narrative economics, and long-horizon return analysis; Nobel laureate empirical work.",
  },
  {
    pattern: /\b(minsky|hyman minsky)\b/i,
    empiricalSupport: "strong", institutionalReliability: 85, recencyScore: 82,
    biasRisk: "moderate", biasNote: "Institutional economics tradition; financial instability hypothesis has strong explanatory but limited predictive precision.",
    usageGuidance: "Use for credit cycle positioning and systemic risk framing; cannot predict Minsky moment timing.",
  },
  // Practitioner frameworks
  {
    pattern: /\b(dalio|ray dalio|bridgewater)\b/i,
    empiricalSupport: "practitioner", institutionalReliability: 76, recencyScore: 80,
    biasRisk: "moderate", biasNote: "Proprietary framework; empirically grounded but not peer-reviewed; may reflect Bridgewater's own positioning.",
    usageGuidance: "Debt cycle and all-weather frameworks are useful heuristics; treat as practitioner hypothesis not academic theory.",
  },
  {
    pattern: /\b(marks|howard marks|oaktree)\b/i,
    empiricalSupport: "practitioner", institutionalReliability: 74, recencyScore: 78,
    biasRisk: "low", biasNote: null,
    usageGuidance: "Credit cycle and risk-adjusted return frameworks are practically grounded; use for qualitative cycle positioning.",
  },
  {
    pattern: /\b(buffett|warren buffett|berkshire)\b/i,
    empiricalSupport: "practitioner", institutionalReliability: 80, recencyScore: 70,
    biasRisk: "low", biasNote: "Long-horizon US equity focus; may not apply to non-US, short-horizon, or macro-driven contexts.",
    usageGuidance: "Value investing and business quality frameworks; most applicable for individual equity selection not macro allocation.",
  },
  {
    pattern: /\b(soros|george soros)\b/i,
    empiricalSupport: "practitioner", institutionalReliability: 72, recencyScore: 72,
    biasRisk: "moderate", biasNote: "Reflexivity is not peer-reviewed; experiential framework from macro trading not academic economics.",
    usageGuidance: "Reflexivity and boom-bust cycle useful for narrative analysis; treat as qualitative framework not quantitative model.",
  },
  // Social media / rejected sources
  {
    pattern: /\b(twitter|reddit|tiktok|instagram|telegram|youtube|influencer|anonymous|blog post|tweet)\b/i,
    empiricalSupport: "limited", institutionalReliability: 10, recencyScore: 50,
    biasRisk: "high", biasNote: "Social media origin; popularity ≠ credibility; no peer review; high manipulation risk.",
    usageGuidance: "Do not use as analytical evidence. At most, note as a sentiment signal — never as a macro or investment insight.",
  },
];

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreSource(name: string, text: string): SourceCredibilityScore | null {
  const rule = SOURCE_SCORING_RULES.find(r => r.pattern.test(text) || r.pattern.test(name));
  if (!rule) return null;

  const approved = APPROVED_SOURCES.find(s =>
    new RegExp(`\\b${s.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));

  const baseCredibility = approved?.credibilityAnchor ?? 60;
  const biasDeduction = rule.biasRisk === "high" ? 30 : rule.biasRisk === "moderate" ? 8 : 0;
  const credibilityScore = Math.max(5, Math.min(100, Math.round(
    (baseCredibility * 0.5) + (rule.institutionalReliability * 0.3) + (rule.recencyScore * 0.2) - biasDeduction,
  )));

  const contextString = `Credibility: ${credibilityScore}/100 (${rule.empiricalSupport}, bias: ${rule.biasRisk})${rule.biasNote ? ` — ${rule.biasNote.slice(0, 50)}` : ""}`.slice(0, 120);

  return {
    sourceName: approved?.name ?? name,
    credibilityScore,
    empiricalSupport: rule.empiricalSupport,
    institutionalReliability: rule.institutionalReliability,
    recencyScore: rule.recencyScore,
    biasRisk: rule.biasRisk,
    biasNote: rule.biasNote,
    approvedSource: approved ?? null,
    tier: approved?.tier ?? "unknown",
    usageGuidance: rule.usageGuidance,
    contextString,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function scoreResearchCredibility(question: string, ctx: string): ResearchCredibilityResult {
  const text = `${question} ${ctx}`;
  const sourceScores: SourceCredibilityScore[] = [];

  for (const rule of SOURCE_SCORING_RULES) {
    if (rule.pattern.test(text)) {
      const score = scoreSource("", text);
      if (score && !sourceScores.some(s => s.sourceName === score.sourceName)) {
        sourceScores.push(score);
      }
    }
  }

  const highestCredibility = sourceScores.length > 0
    ? sourceScores.reduce((a, b) => a.credibilityScore > b.credibilityScore ? a : b)
    : null;

  const dominantBiasRisk: BiasRisk = sourceScores.some(s => s.biasRisk === "high") ? "high"
    : sourceScores.some(s => s.biasRisk === "moderate") ? "moderate" : "low";

  const governanceNote = highestCredibility
    ? `Highest credibility source: ${highestCredibility.sourceName} (${highestCredibility.credibilityScore}/100, ${highestCredibility.empiricalSupport} empirical support).`
    : "No approved source detected — treat as unverified; apply candidate_review governance.";

  const fusionContext = highestCredibility
    ? `Research credibility: ${highestCredibility.sourceName} ${highestCredibility.credibilityScore}/100 | bias: ${dominantBiasRisk}`.slice(0, 150)
    : "Research credibility: no approved source | unverified context".slice(0, 150);

  return { sourceScores, highestCredibility, dominantBiasRisk, governanceNote, fusionContext };
}
