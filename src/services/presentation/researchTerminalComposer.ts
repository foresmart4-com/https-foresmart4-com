// Research Terminal Composer
// Defines the institutional rendering order for a Genesis response.
// Priority: memo → reasoning → evidence → scenarios → portfolio → monitoring → metadata
//
// Cards and regime badges are demoted to metadata tier (rendered last).
// The first visible content for the user is always the CIO memo or direct answer.

export type SectionRole =
  | "cio_memo"        // institutionalMemo — always first
  | "direct_answer"   // headline (CIO direct answer)
  | "reasoning"       // committee voices + synthesis (collapsible)
  | "thesis_cases"    // bull/base/bear cases + macro chain
  | "executive"       // executiveSummary (research mode)
  | "evidence"        // evidence + keyDrivers + supporting/opposing
  | "tracks"          // agent views track arbitration (collapsed)
  | "scenarios"       // scenario grid
  | "portfolio"       // portfolioImpact + simulation outputs
  | "monitoring"      // catalysts + risks + invalidation + watchItems
  | "metadata"        // regime badge + confidence bar + action card

export interface TerminalSection {
  role: SectionRole;
  priority: number;     // lower = rendered first (1 = highest)
  label: string;
  labelAr: string;
  collapsible: boolean;
  defaultOpen: boolean;
}

export const TERMINAL_SECTIONS: Record<SectionRole, TerminalSection> = {
  cio_memo:      { role: "cio_memo",      priority: 1, label: "CIO Memo",              labelAr: "مذكرة كبير المستثمرين", collapsible: false, defaultOpen: true },
  direct_answer: { role: "direct_answer", priority: 2, label: "Direct Answer",         labelAr: "الإجابة المباشرة",      collapsible: false, defaultOpen: true },
  reasoning:     { role: "reasoning",     priority: 3, label: "Committee Reasoning",   labelAr: "استدلال اللجنة",        collapsible: true,  defaultOpen: true },
  thesis_cases:  { role: "thesis_cases",  priority: 4, label: "Thesis Cases",          labelAr: "حالات الأطروحة",        collapsible: false, defaultOpen: true },
  executive:     { role: "executive",     priority: 5, label: "Executive Summary",     labelAr: "الملخص التنفيذي",       collapsible: false, defaultOpen: true },
  evidence:      { role: "evidence",      priority: 6, label: "Evidence",              labelAr: "الأدلة",               collapsible: false, defaultOpen: true },
  tracks:        { role: "tracks",        priority: 7, label: "Analytical Tracks",     labelAr: "المسارات التحليلية",    collapsible: true,  defaultOpen: false },
  scenarios:     { role: "scenarios",     priority: 8, label: "Scenarios",             labelAr: "السيناريوهات",          collapsible: false, defaultOpen: true },
  portfolio:     { role: "portfolio",     priority: 9, label: "Portfolio Implications",labelAr: "الأثر على المحفظة",     collapsible: false, defaultOpen: true },
  monitoring:    { role: "monitoring",    priority: 10, label: "Monitoring",           labelAr: "المراقبة",              collapsible: false, defaultOpen: true },
  metadata:      { role: "metadata",      priority: 11, label: "Analysis Metadata",   labelAr: "بيانات التحليل",        collapsible: true,  defaultOpen: false },
};

export interface TerminalPresencePlan {
  sections: Array<TerminalSection & { present: boolean }>;
  hasMemo: boolean;
  hasReasoning: boolean;
  hasThesisCases: boolean;
  hasEvidence: boolean;
  hasScenarios: boolean;
  hasPortfolio: boolean;
  memoFirst: boolean;        // true when institutionalMemo is populated (correct)
  reasoningVisible: boolean; // true when committee voices are surfaced
}

export interface ReplySnapshot {
  institutionalMemo?: string;
  headline?: string;
  thesis?: string;
  voiceReasoning?: { macro?: string; policy?: string; allocator?: string; behavioral?: string; historical?: string };
  committeeSynthesis?: { finalStance?: string; agreement?: string; disagreement?: string };
  frameworkSynthesis?: string;
  perspectiveMap?: string;
  reasoningPlurality?: string;
  bullCase?: string;
  bearCase?: string;
  baseCase?: string;
  macroChain?: string;
  executiveSummary?: string;
  evidence?: string[];
  keyDrivers?: string[];
  supportingCase?: string;
  opposingCase?: string;
  trackViewMacro?: string;
  trackViewTechnical?: string;
  trackViewCrossAsset?: string;
  trackViewRisk?: string;
  trackViewPositioning?: string;
  scenarios?: Array<{ label: string; probability: string; impact: string }>;
  portfolioImpact?: string;
  simulatedScenario?: string;
  catalysts?: string[];
  risks?: string[];
  invalidation?: string;
  watchItems?: string[];
  regime?: string;
  confidence?: number;
  suggestedAction?: { type: string } | null;
}

export function composeTerminalPlan(reply: ReplySnapshot): TerminalPresencePlan {
  const hasMemo = Boolean(reply.institutionalMemo?.trim());
  const hasHeadline = Boolean(reply.headline?.trim());

  const hasReasoning = Boolean(
    reply.voiceReasoning?.allocator ||
    reply.voiceReasoning?.macro ||
    reply.voiceReasoning?.historical ||
    reply.committeeSynthesis?.finalStance ||
    reply.frameworkSynthesis ||
    reply.perspectiveMap ||
    reply.reasoningPlurality,
  );

  const hasThesisCases = Boolean(reply.bullCase || reply.bearCase || reply.baseCase || reply.macroChain || reply.thesis);

  const hasExecutive = Boolean(reply.executiveSummary);

  const hasEvidence = Boolean(
    (reply.evidence && reply.evidence.length > 0) ||
    (reply.keyDrivers && reply.keyDrivers.length > 0) ||
    reply.supportingCase ||
    reply.opposingCase,
  );

  const hasTracks = Boolean(
    reply.trackViewMacro || reply.trackViewTechnical ||
    reply.trackViewCrossAsset || reply.trackViewRisk || reply.trackViewPositioning,
  );

  const hasScenarios = Boolean(reply.scenarios && reply.scenarios.length > 0);

  const hasPortfolio = Boolean(reply.portfolioImpact || reply.simulatedScenario);

  const hasMonitoring = Boolean(
    (reply.catalysts && reply.catalysts.length > 0) ||
    (reply.risks && reply.risks.length > 0) ||
    reply.invalidation ||
    (reply.watchItems && reply.watchItems.length > 0),
  );

  const hasMetadata = Boolean(reply.regime || (reply.confidence && reply.confidence > 0));

  const presenceMap: Record<SectionRole, boolean> = {
    cio_memo:      hasMemo,
    direct_answer: hasHeadline,
    reasoning:     hasReasoning,
    thesis_cases:  hasThesisCases,
    executive:     hasExecutive,
    evidence:      hasEvidence,
    tracks:        hasTracks,
    scenarios:     hasScenarios,
    portfolio:     hasPortfolio,
    monitoring:    hasMonitoring,
    metadata:      hasMetadata,
  };

  const sections = (Object.keys(TERMINAL_SECTIONS) as SectionRole[])
    .sort((a, b) => TERMINAL_SECTIONS[a].priority - TERMINAL_SECTIONS[b].priority)
    .map(role => ({ ...TERMINAL_SECTIONS[role], present: presenceMap[role] }));

  return {
    sections,
    hasMemo,
    hasReasoning,
    hasThesisCases,
    hasEvidence,
    hasScenarios,
    hasPortfolio,
    memoFirst: hasMemo,
    reasoningVisible: hasReasoning,
  };
}
