/**
 * Approval Workflow Intelligence — Phase 35
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Classifies questions and ideas into a governed workflow state without
 * enabling any execution, order creation, or broker logic.
 *
 * Workflow states:
 *   observation         — informational insight only
 *   research_item       — worthy of monitoring / further research
 *   monitored_thesis    — coherent directional thesis being tracked
 *   approval_required   — high-conviction thesis requiring human review
 *   insufficient_quality — not strong enough to escalate
 *
 * Design rules:
 * - Conservative: observation is the honest default
 * - Firewall governance is preserved: blocked state hard-caps at observation
 * - No execution semantics: states are advisory workflow labels only
 * - No forced escalation: approval_required requires all conditions met
 * - No hidden escalation: blockedBy array is always transparent
 * - Deterministic: derived from input signals only, no randomness
 * - No buy/sell / trade / enter position language anywhere in this module
 */

import type { FirewallState } from "@/services/governance/decisionFirewall";
import type { CredibilityLabel } from "@/services/credibility/credibilityEngine";
import type { DebateBalance } from "@/services/intelligence/debateEngine";
import type { EventSignificance } from "@/services/macro/macroEventEngine";
import type { RelevanceState } from "@/services/research/researchCoverageEngine";
import type { CalibrationScore } from "@/services/learning/decisionScoring";
import type { TrustState } from "@/services/intelligence/trustStrategyEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkflowState =
  | "observation"          // informational; no escalation warranted
  | "research_item"        // monitoring / further research is reasonable
  | "monitored_thesis"     // coherent directional thesis is being tracked
  | "approval_required"    // high-conviction thesis; human review recommended
  | "insufficient_quality"; // attempt present but evidence too weak to escalate

export interface ApprovalWorkflowInput {
  question: string;
  firewallState: FirewallState;
  credibilityLabel: CredibilityLabel;
  debateBalance: DebateBalance;
  hasMaterialDisagreement: boolean;
  calibrationScore: CalibrationScore;
  trustState: TrustState;
  macroEventSignificance: EventSignificance;
  coverageRelevance: RelevanceState;
  hasActiveVulnerability: boolean;
  watchlistSymbols: string[];
  ar: boolean;
}

export interface ApprovalWorkflowResult {
  state: WorkflowState;
  escalationLevel: number;         // −1=insufficient, 0=observation, 1=research, 2=monitored, 3=approval
  blockedBy: string[];             // governance signals that prevented higher escalation
  allowedBy: string[];             // signals that justified the current level
  narrative: string;               // 1-sentence advisory explanation
  escalationGuard: string;         // top reason preventing higher escalation (or "" if none)
  contextString: string;           // compact ≤130 chars for AI injection
  requiresHumanReview: boolean;    // true only when state === "approval_required"
  hasEscalationConstraint: boolean;// true when any blocking rule fired
}

// ─── Escalation level map ─────────────────────────────────────────────────────

const LEVEL: Record<WorkflowState, number> = {
  insufficient_quality: -1,
  observation: 0,
  research_item: 1,
  monitored_thesis: 2,
  approval_required: 3,
};

// ─── Keyword detectors ────────────────────────────────────────────────────────

const ASSET_PATTERN =
  /\b(BTC|ETH|XAU|GOLD|OIL|WTI|BRENT|SPX|SPY|QQQ|TASI|2222|SABIC|AAPL|TSLA|NVDA|MSFT|AMZN|META|ARAMCO|EURUSD|GBPUSD|USDJPY|DXY|US10Y|TLT|GLD|SLV|XAGUSD|BTCUSDT|ETHUSDT)\b/i;

const DIRECTIONAL_PATTERN =
  /\b(bullish|bearish|long|short|upside|downside|rally|correction|صاعد|هابط|ارتفاع|انخفاض|صعود|هبوط)\b/i;

const THESIS_PATTERN =
  /\b(my view|my thesis|my position|i think|i believe|i'm convinced|conviction|i see|i expect|strong case|أعتقد|رأيي|أطروحتي|موقفي|قناعتي)\b/i;

const EVIDENCE_PATTERN =
  /\b(because|since|due to|given that|based on|driven by|supported by|citing|لأن|بسبب|استناداً إلى|نظراً لـ)\b/i;

const RESEARCH_PATTERN =
  /\b(analyze|analyse|research|deep.?dive|report on|study|investigate|evaluate|حلل|تحليل|بحث|تقرير|دراسة)\b/i;

// ─── Base score computation ───────────────────────────────────────────────────

interface ScoreComponents {
  hasAsset: boolean;
  hasMacroOrCoverage: boolean;
  hasDirectional: boolean;
  hasThesis: boolean;
  hasEvidence: boolean;
  hasPortfolioLink: boolean;
  hasResearchIntent: boolean;
}

function computeBaseScore(input: ApprovalWorkflowInput): { score: number; components: ScoreComponents } {
  const q = input.question;

  const hasAsset =
    ASSET_PATTERN.test(q) ||
    (input.watchlistSymbols.length > 0 &&
      input.watchlistSymbols.some((s) => q.toUpperCase().includes(s.toUpperCase())));

  const hasMacroOrCoverage =
    input.coverageRelevance === "high_relevance" ||
    input.coverageRelevance === "medium_relevance" ||
    input.macroEventSignificance === "meaningful" ||
    input.macroEventSignificance === "critical";

  const hasDirectional  = DIRECTIONAL_PATTERN.test(q);
  const hasThesis       = THESIS_PATTERN.test(q);
  const hasEvidence     = EVIDENCE_PATTERN.test(q);
  const hasPortfolioLink =
    /\b(portfolio|watchlist|my holdings|my assets|my positions|محفظة|قائمة المراقبة|أصولي)\b/i.test(q) ||
    (input.watchlistSymbols.length > 0 && ASSET_PATTERN.test(q));
  const hasResearchIntent = RESEARCH_PATTERN.test(q);

  const score =
    (hasAsset ? 1 : 0) +
    (hasMacroOrCoverage ? 1 : 0) +
    (hasDirectional ? 1 : 0) +
    (hasThesis ? 1 : 0) +
    (hasEvidence ? 1 : 0) +
    (hasPortfolioLink ? 1 : 0) +
    (hasResearchIntent ? 1 : 0);

  return {
    score,
    components: { hasAsset, hasMacroOrCoverage, hasDirectional, hasThesis, hasEvidence, hasPortfolioLink, hasResearchIntent },
  };
}

// ─── Governance cap computation ───────────────────────────────────────────────

interface GovernanceCap {
  hardCap: WorkflowState | null;  // null = no hard cap
  softDeduct: number;             // deducted from effective score threshold
  blockedBy: string[];
}

function computeGovernanceCap(input: ApprovalWorkflowInput): GovernanceCap {
  const blocked: string[] = [];
  let hardCap: WorkflowState | null = null;
  let softDeduct = 0;

  // Hard block: firewall blocked → observation only (governance mandate)
  if (input.firewallState === "blocked") {
    hardCap = hardCap === null || LEVEL[hardCap] > LEVEL["observation"] ? "observation" : hardCap;
    blocked.push("firewall blocked");
  }

  // Hard cap: low credibility → max research_item
  if (input.credibilityLabel === "low_credibility") {
    const cap: WorkflowState = "research_item";
    if (hardCap === null || LEVEL[hardCap] > LEVEL[cap]) hardCap = cap;
    blocked.push("low credibility");
  }

  // Hard cap: weakly calibrated → max research_item
  if (input.calibrationScore === "weakly_calibrated") {
    const cap: WorkflowState = "research_item";
    if (hardCap === null || LEVEL[hardCap] > LEVEL[cap]) hardCap = cap;
    blocked.push("weak calibration");
  }

  // Hard cap: fragile trust → max research_item
  if (input.trustState === "fragile_calibration") {
    const cap: WorkflowState = "research_item";
    if (hardCap === null || LEVEL[hardCap] > LEVEL[cap]) hardCap = cap;
    blocked.push("fragile trust calibration");
  }

  // Soft cap: firewall constrained → max monitored_thesis
  if (input.firewallState === "constrained") {
    const cap: WorkflowState = "monitored_thesis";
    if (hardCap === null || LEVEL[hardCap] > LEVEL[cap]) hardCap = cap;
    blocked.push("firewall constrained");
  }

  // Soft deduct: material disagreement → need 1 more point per level
  if (input.hasMaterialDisagreement) {
    softDeduct += 1;
    blocked.push("material debate disagreement");
  }

  // Soft deduct: critical macro event elevates uncertainty threshold
  if (input.macroEventSignificance === "critical") {
    softDeduct += 1;
    blocked.push("critical macro event uncertainty");
  }

  // Soft deduct: active portfolio vulnerability
  if (input.hasActiveVulnerability) {
    softDeduct += 1;
    blocked.push("active portfolio vulnerability");
  }

  return { hardCap, softDeduct, blockedBy: blocked };
}

// ─── State derivation ─────────────────────────────────────────────────────────

function deriveState(
  baseScore: number,
  components: ScoreComponents,
  cap: GovernanceCap,
): WorkflowState {
  const effective = baseScore - cap.softDeduct;

  // Hard block always wins
  if (cap.hardCap !== null) {
    // Firewall blocked → observation; even if score is high
    if (cap.hardCap === "observation") {
      return effective < 0 ? "insufficient_quality" : "observation";
    }
    // Other hard caps clamp the achievable ceiling
    const capped = stateFromScore(effective, components);
    return LEVEL[capped] <= LEVEL[cap.hardCap] ? capped : cap.hardCap;
  }

  // No hard cap — derive from score + component requirements
  if (effective < 0) return "insufficient_quality";
  return stateFromScore(effective, components);
}

function stateFromScore(score: number, c: ScoreComponents): WorkflowState {
  if (score <= 0) return "observation";
  if (score <= 2) return "research_item";
  // monitored_thesis: needs score ≥ 3 AND (directional OR thesis)
  if (score <= 4) {
    return (c.hasDirectional || c.hasThesis) ? "monitored_thesis" : "research_item";
  }
  // approval_required: needs score ≥ 5 AND directional AND thesis
  return (c.hasDirectional && c.hasThesis) ? "approval_required" : "monitored_thesis";
}

// ─── Allowed-by list ──────────────────────────────────────────────────────────

function buildAllowedBy(state: WorkflowState, c: ScoreComponents, input: ApprovalWorkflowInput): string[] {
  const allowed: string[] = [];
  if (state === "observation") { allowed.push("informational context only"); return allowed; }
  if (c.hasAsset) allowed.push("specific asset identified");
  if (c.hasMacroOrCoverage) allowed.push("macro or coverage relevance present");
  if (c.hasDirectional) allowed.push("directional language detected");
  if (c.hasThesis) allowed.push("conviction / thesis framing detected");
  if (c.hasEvidence) allowed.push("evidence / reasoning present");
  if (c.hasPortfolioLink) allowed.push("portfolio link present");
  if (c.hasResearchIntent) allowed.push("research intent detected");
  if (state === "approval_required") {
    if (input.firewallState === "cleared" || input.firewallState === "caution") allowed.push("firewall cleared");
    if (input.credibilityLabel !== "low_credibility") allowed.push("credibility acceptable");
    if (input.calibrationScore !== "weakly_calibrated") allowed.push("calibration acceptable");
  }
  return allowed;
}

// ─── Escalation guard (top blocking reason) ───────────────────────────────────

function topGuard(blockedBy: string[], state: WorkflowState, ar: boolean): string {
  if (!blockedBy.length) return "";
  const top = blockedBy[0];
  if (ar) {
    const AR: Record<string, string> = {
      "firewall blocked": "جدار الحماية محظور — تصعيد الثقة ممنوع",
      "low credibility": "مصداقية منخفضة — محدود بمستوى البحث",
      "weak calibration": "معايرة ضعيفة — محدود بمستوى البحث",
      "fragile trust calibration": "ثقة هشة — محدود بمستوى البحث",
      "firewall constrained": "جدار الحماية مقيَّد — محدود بالأطروحة المراقبة",
      "material debate disagreement": "خلاف نقاشي جوهري — تقليص قدرة التصعيد",
      "critical macro event uncertainty": "حدث كلي حرج — عدم يقين مرتفع",
      "active portfolio vulnerability": "ثغرة نشطة في المحفظة — تقليص قدرة التصعيد",
    };
    return AR[top] ?? top;
  }
  return top;
}

// ─── Narrative builders ────────────────────────────────────────────────────────

function buildNarrative(state: WorkflowState, guard: string, ar: boolean): string {
  switch (state) {
    case "approval_required":
      return ar
        ? "الأطروحة تستوفي معايير الثقة المطلوبة — مراجعة بشرية موصى بها قبل أي قرار."
        : "Thesis meets conviction criteria — human review is recommended before any decision.";
    case "monitored_thesis":
      return ar
        ? "أطروحة متماسكة يجري تتبعها — المتابعة التحليلية مبررة مع الإبقاء على الصياغة الشرطية."
        : "Coherent thesis is being tracked — analytical monitoring is justified; maintain conditional framing.";
    case "research_item":
      return ar
        ? `المراقبة والبحث مبرران${guard ? ` (${guard})` : ""} — الثقة الاتجاهية مقيّدة في الوقت الحالي.`
        : `Monitoring and research are reasonable${guard ? ` (${guard})` : ""} — directional conviction is currently constrained.`;
    case "insufficient_quality":
      return ar
        ? "الأدلة غير كافية للتصعيد — الاعتراف بالقيود وعدم صياغة أطروحة اتجاهية."
        : "Evidence is insufficient to escalate — acknowledge limitations and avoid directional thesis framing.";
    case "observation":
    default:
      return ar
        ? "رؤية إعلامية فقط — لا يوجد ما يستدعي التصعيد في الوقت الحالي."
        : "Informational insight only — no escalation is warranted at this time.";
  }
}

// ─── Context string builder ────────────────────────────────────────────────────

function buildContextString(state: WorkflowState, guard: string): string {
  if (state === "observation") return "";
  const guardStr = guard ? `; guard: ${guard.slice(0, 45)}` : "";
  return `Workflow: ${state.replace(/_/g, " ")}${guardStr}`.slice(0, 130);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeApprovalWorkflow(input: ApprovalWorkflowInput): ApprovalWorkflowResult {
  const { ar } = input;
  const { score, components } = computeBaseScore(input);
  const cap = computeGovernanceCap(input);
  const state = deriveState(score, components, cap);
  const allowedBy = buildAllowedBy(state, components, input);
  const guard = topGuard(cap.blockedBy, state, ar);
  const narrative = buildNarrative(state, guard, ar);
  const contextString = buildContextString(state, cap.blockedBy[0] ?? "");

  return {
    state,
    escalationLevel: LEVEL[state],
    blockedBy: cap.blockedBy,
    allowedBy,
    narrative,
    escalationGuard: guard,
    contextString,
    requiresHumanReview: state === "approval_required",
    hasEscalationConstraint: cap.blockedBy.length > 0,
  };
}
