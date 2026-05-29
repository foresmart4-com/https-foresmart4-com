// Phase-76: Institutional Research Intake
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Activates controlled, governed intake architecture for Genesis.
// No autonomous fetching. No copyrighted dumping. No self-training.
// All intake is: governed, summarized, structured, classified, credibility-scored.
//
// Approved source preparation:
//   Universities: Harvard, Yale, MIT, Chicago, Stanford, Oxford, Cambridge,
//     LSE, Princeton, Columbia, Wharton, INSEAD
//   Institutions: Fed, ECB, IMF, World Bank, BIS, OECD, SAMA, BoE, BoJ
//   Practitioners: Dalio, Marks, Buffett, Munger, Fama, Shiller, Minsky,
//     Keynes, Friedman, Soros
//
// Intake states:
//   approved_intake        — vetted source; passes governance; ready for feeding
//   pending_review         — source recognised but not yet cleared; awaiting governance
//   historical_reference   — historical material; advisory and analogical use only
//   theory_reference       — theoretical framework; balance with competing schools required
//   institutional_reference — CB/IMF/multilateral; high credibility; primary macro signal
//   rejected_intake        — social media, anonymous, unverified; blocked from feeding

import {
  APPROVED_SOURCES,
  detectSourceState,
  matchApprovedSource,
  detectResearchType,
  type ApprovedSource,
} from "./governedResearch";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type IntakeState =
  | "approved_intake"
  | "pending_review"
  | "historical_reference"
  | "theory_reference"
  | "institutional_reference"
  | "rejected_intake";

export type ResearchCategory =
  | "policy_paper"
  | "institutional_publication"
  | "economic_research"
  | "historical_study"
  | "theory_summary"
  | "practitioner_framework"
  | "macro_study"
  | "unclassified";

export interface IntakeRecord {
  id: string;
  sourceAttribution: string;    // name of source (institution/author/publication)
  researchCategory: ResearchCategory;
  intakeState: IntakeState;
  credibilityScore: number;     // 0-100
  biasFlag: string | null;      // known methodological bias if any
  governanceNote: string;       // 1 sentence: why this state was assigned
  structuredSummary: string;    // ≤200 chars: structured content description
  intakeContext: string;        // ≤150 chars: compact Genesis-injectable context
  safeForFeeding: boolean;      // approved_intake | historical_reference | theory_reference | institutional_reference
}

export interface IntakeClassification {
  intakeState: IntakeState;
  researchCategory: ResearchCategory;
  credibilityScore: number;
  biasFlag: string | null;
  governanceNote: string;
  structuredSummary: string;
  intakeContext: string;
  safeForFeeding: boolean;
}

// ─── Category detection ────────────────────────────────────────────────────────

const CATEGORY_PATTERNS: Array<{ category: ResearchCategory; pattern: RegExp }> = [
  { category: "policy_paper",            pattern: /\b(policy|monetary policy|fiscal policy|regulation|regulatory|framework|outlook|projection|mandate|target|guidance|policy paper|سياسة|إطار|توجيه)\b/i },
  { category: "institutional_publication",pattern: /\b(annual report|stability review|survey|bulletin|quarterly review|financial stability|global financial|world economic outlook|تقرير سنوي|مراجعة|نشرة)\b/i },
  { category: "historical_study",        pattern: /\b(historical|history|postmortem|episode|crisis of|great depression|stagflation|oil shock|1929|1930s|1970s|1973|1979|1986|1987|1997|1998|2000|2008|2020|التاريخ|أزمة|مرحلة)\b/i },
  { category: "theory_summary",          pattern: /\b(theory|hypothesis|framework|model|paradigm|school|doctrine|theorem|theoretical|نظرية|فرضية|نموذج|مدرسة)\b/i },
  { category: "practitioner_framework",  pattern: /\b(memo|letter to investors|principles|framework|approach|philosophy|all.weather|debt cycle|margin of safety|reflexivity|مذكرة|مبادئ|فلسفة)\b/i },
  { category: "economic_research",       pattern: /\b(working paper|nber|ssrn|journal|empirical|econometric|academic|peer.reviewed|dissertation|بحث|ورقة بحثية|تجريبي)\b/i },
  { category: "macro_study",             pattern: /\b(macro|regime|cycle|gdp|pmi|inflation|growth|recession|expansion|monetary|fiscal|macro study|كلي|دورة|نمو)\b/i },
];

function detectCategory(text: string): ResearchCategory {
  for (const { category, pattern } of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return category;
  }
  return "unclassified";
}

// ─── Institutional source patterns (tier_2 CBs / multilaterals) ───────────────

const INSTITUTIONAL_TIER2_PATTERN = /\b(federal reserve|fed|fomc|feds notes|ecb|european central bank|imf|international monetary fund|world bank|bis|bank for international settlements|oecd|sama|saudi arabian monetary authority|boe|bank of england|boj|bank of japan)\b/i;
const THEORY_ANCHOR_PATTERN = /\b(keynes|keynesian|friedman|monetarist|minsky|austrian|hayek|schumpeter|fisher|samuelson|solow|new keynesian|post.keynesian|modern monetary|طيني|كينز|فريدمان|مينسكي)\b/i;
const HISTORICAL_TRIGGER_PATTERN = /\b(1929|1930s|great depression|1970s|stagflation|oil shock|1973|1979|1986|1987|1997|2000|2008|gfc|covid|2020|postmortem|historical episode|التاريخ الاقتصادي)\b/i;

// ─── Intake state derivation ──────────────────────────────────────────────────

function deriveIntakeState(
  text: string,
  matchedSource: ApprovedSource | null,
  category: ResearchCategory,
): IntakeState {
  const sourceState = detectSourceState(text);

  if (sourceState === "rejected") return "rejected_intake";

  if (HISTORICAL_TRIGGER_PATTERN.test(text) || category === "historical_study") {
    return "historical_reference";
  }

  if (INSTITUTIONAL_TIER2_PATTERN.test(text) && matchedSource?.tier === "tier_2") {
    return "institutional_reference";
  }

  if (
    THEORY_ANCHOR_PATTERN.test(text) ||
    category === "theory_summary"
  ) {
    return "theory_reference";
  }

  if (sourceState === "approved" && matchedSource) {
    return "approved_intake";
  }

  return "pending_review";
}

// ─── Credibility scoring ──────────────────────────────────────────────────────

function computeIntakeCredibility(
  matchedSource: ApprovedSource | null,
  intakeState: IntakeState,
  category: ResearchCategory,
): number {
  if (intakeState === "rejected_intake") return 5;

  const base = matchedSource?.credibilityAnchor ?? 60;

  const categoryBonus: Record<ResearchCategory, number> = {
    economic_research:        8,
    policy_paper:             6,
    institutional_publication:5,
    historical_study:         3,
    theory_summary:           2,
    practitioner_framework:  -5,
    macro_study:              3,
    unclassified:            -10,
  };

  const stateBonus: Partial<Record<IntakeState, number>> = {
    institutional_reference: 5,
    approved_intake:         3,
    theory_reference:        0,
    historical_reference:   -3,
    pending_review:         -10,
  };

  const raw = base + (categoryBonus[category] ?? 0) + (stateBonus[intakeState] ?? 0);
  return Math.max(5, Math.min(100, Math.round(raw)));
}

// ─── Governance note builder ──────────────────────────────────────────────────

function buildGovernanceNote(
  intakeState: IntakeState,
  matchedSource: ApprovedSource | null,
  credibilityScore: number,
): string {
  switch (intakeState) {
    case "approved_intake":
      return `Approved intake: ${matchedSource?.name ?? "institutional"} (${matchedSource?.tier ?? "unknown"}, ${credibilityScore}/100) — cleared for knowledge feeding.`;
    case "institutional_reference":
      return `Institutional reference: ${matchedSource?.name ?? "CB/multilateral"} — primary policy source; ${credibilityScore}/100 credibility; treat policy signals as highest-priority macro input.`;
    case "theory_reference":
      return `Theory reference: theoretical framework detected — credibility ${credibilityScore}/100; balance with competing schools before injection; no single-school dominance.`;
    case "historical_reference":
      return `Historical reference: advisory and analogical use only — ${credibilityScore}/100; do not apply as deterministic prediction for current regime.`;
    case "pending_review":
      return `Pending review: source not yet cleared by governance — credibility ${credibilityScore}/100; treat as moderate-credibility candidate; requires governance approval before full feeding.`;
    case "rejected_intake":
      return `Rejected intake: social/anonymous/unverified origin — credibility ${credibilityScore}/100; blocked from knowledge feeding; do not use as analytical evidence.`;
  }
}

// ─── Structured summary builder ───────────────────────────────────────────────

function buildStructuredSummary(
  title: string,
  source: string,
  category: ResearchCategory,
  intakeState: IntakeState,
  year?: number,
): string {
  const categoryLabel = category.replace(/_/g, " ");
  const yearPart = year ? ` (${year})` : "";
  const statePart = intakeState.replace(/_/g, " ");
  return `[${categoryLabel}${yearPart}] ${source} — "${title.slice(0, 80)}" | state: ${statePart}`.slice(0, 200);
}

// ─── Intake context builder ───────────────────────────────────────────────────

function buildIntakeContext(
  source: string,
  intakeState: IntakeState,
  credibilityScore: number,
  category: ResearchCategory,
): string {
  return `Intake: ${source} | ${intakeState.replace(/_/g, "-")} | ${credibilityScore}/100 | ${category.replace(/_/g, " ")}`.slice(0, 150);
}

// ─── Safe-for-feeding guard ───────────────────────────────────────────────────

const SAFE_STATES: ReadonlySet<IntakeState> = new Set([
  "approved_intake",
  "historical_reference",
  "theory_reference",
  "institutional_reference",
]);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * classifyIntake — classify a research document for governed intake.
 * Takes title, source attribution, and a structured summary string.
 * Returns complete governance classification. O(1), no side effects.
 */
export function classifyIntake(
  title: string,
  source: string,
  summary: string,
  year?: number,
): IntakeClassification {
  const combined = `${title} ${source} ${summary}`;

  const researchType  = detectResearchType(combined);
  const category      = detectCategory(combined);
  const matchedSource = matchApprovedSource(combined);
  const intakeState   = deriveIntakeState(combined, matchedSource, category);
  const credScore     = computeIntakeCredibility(matchedSource, intakeState, category);
  const biasFlag      = matchedSource?.biasFlag ?? null;
  const governanceNote = buildGovernanceNote(intakeState, matchedSource, credScore);
  const structuredSummary = buildStructuredSummary(title, source, category, intakeState, year);
  const intakeContext  = buildIntakeContext(
    matchedSource?.name ?? source.slice(0, 30),
    intakeState,
    credScore,
    category,
  );

  return {
    intakeState,
    researchCategory: category,
    credibilityScore: credScore,
    biasFlag,
    governanceNote,
    structuredSummary,
    intakeContext,
    safeForFeeding: SAFE_STATES.has(intakeState),
  };
}

/**
 * createIntakeRecord — wrap classifyIntake into a named record with an id.
 */
export function createIntakeRecord(
  id: string,
  title: string,
  source: string,
  summary: string,
  year?: number,
): IntakeRecord {
  const cls = classifyIntake(title, source, summary, year);
  const matchedSource = matchApprovedSource(`${title} ${source} ${summary}`);

  return {
    id,
    sourceAttribution: matchedSource?.name ?? source.slice(0, 60),
    researchCategory:  cls.researchCategory,
    intakeState:       cls.intakeState,
    credibilityScore:  cls.credibilityScore,
    biasFlag:          cls.biasFlag,
    governanceNote:    cls.governanceNote,
    structuredSummary: cls.structuredSummary,
    intakeContext:     cls.intakeContext,
    safeForFeeding:    cls.safeForFeeding,
  };
}

/**
 * getIntakeGovernanceSummary — returns a one-line governance summary for
 * Genesis injection, based on the most prominent intake state detected.
 */
export function getIntakeGovernanceSummary(question: string, context: string): string {
  const cls = classifyIntake(question, "", context);
  if (!cls.safeForFeeding && cls.intakeState !== "pending_review") {
    return `Research intake governance: ${cls.intakeState.replace(/_/g, " ")} — ${cls.governanceNote}`.slice(0, 200);
  }
  if (cls.intakeState === "institutional_reference" || cls.intakeState === "approved_intake") {
    return `Research intake: ${cls.intakeContext}`.slice(0, 150);
  }
  return "";
}
