// Phase-83A: Investment Depth Rules
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Purpose:
//   Single authoritative registry of 10 canonical investment depth rules.
//   All quality-checking modules (shallowAnswerRejection, knowledgeUseEnforcement,
//   qualityHarness) can reference these rules by ID rather than each embedding
//   their own fragmented checks.
//
//   Each rule defines:
//   - What it checks (description)
//   - How to check it (check function against GenesisReply)
//   - How critical it is (severity: "critical" | "major" | "minor")
//   - How to repair if violated (repair hint)
//
// Rules are deliberately separated from the checking engines so they can be
// updated in one place and propagated everywhere.

import type { GenesisReply } from "@/lib/genesis.functions";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DepthRuleId =
  | "transmission_chain"        // R1: explicit causal X→Y→Z chain
  | "second_order_effects"      // R2: contagion beyond direct impact
  | "allocator_logic"           // R3: institutional deployment stance
  | "policy_reaction_function"  // R4: CB reaction function format
  | "regime_conflict"           // R5: when signals diverge, which wins
  | "sector_differentiation"    // R6: named sectors with causal linkage
  | "valuation_vs_earnings"     // R7: PE expansion ≠ EPS growth
  | "thesis_invalidation"       // R8: specific falsifiable trigger
  | "missing_evidence"          // R9: explicit acknowledgement of data gaps
  | "capital_preservation"      // R10: downside control framework

export type RuleSeverity = "critical" | "major" | "minor";

export interface DepthRule {
  id: DepthRuleId;
  name: string;
  severity: RuleSeverity;
  description: string;
  check: (reply: GenesisReply) => RuleCheckResult;
  repairHint: (isSaudi: boolean, lang: "ar" | "en") => string;
}

export interface RuleCheckResult {
  passed: boolean;
  score: number;    // 0-100
  evidence: string; // what was found (if passed) or what's missing (if failed)
}

export interface DepthRulesAudit {
  totalRules: number;
  passedRules: number;
  criticalFailed: DepthRuleId[];
  majorFailed: DepthRuleId[];
  minorFailed: DepthRuleId[];
  overallScore: number;   // weighted 0-100
  passesMinimum: boolean; // all critical rules passed
  results: Record<DepthRuleId, RuleCheckResult>;
}

// ─── Rule implementations ─────────────────────────────────────────────────────

const RULES: DepthRule[] = [

  {
    id: "transmission_chain",
    name: "Transmission Chain",
    severity: "critical",
    description: "Reply must contain at least one explicit causal chain using → notation, connecting a macro variable to an investment implication through 2+ links.",
    check: (reply) => {
      const text = [reply.macroChain, reply.outlook, reply.bullCase, reply.bearCase].filter(Boolean).join(" ");
      const arrowCount = (text.match(/→/g) ?? []).length;
      const chainText = text.match(/[^.]{5,}→[^.]{5,}/g) ?? [];
      const passed = arrowCount >= 2 && chainText.length >= 1;
      return {
        passed,
        score: passed ? 100 : arrowCount === 1 ? 50 : 0,
        evidence: passed
          ? `${arrowCount} arrow chain(s) found`
          : `Only ${arrowCount} → arrow(s); macroChain: ${reply.macroChain ? "present but flat" : "absent"}`,
      };
    },
    repairHint: (isSaudi, lang) => lang === "ar"
      ? (isSaudi
          ? "أضف سلسلة: سعر النفط → الميزانية السعودية → الإنفاق الحكومي → نمو GDP غير النفطي → تاسي."
          : "أضف سلسلة ماكرو: [الأسعار/DXY/النفط] → [تأثير فئة الأصول] → [دلالة الاستثمار].")
      : (isSaudi
          ? "Add chain: oil price → Saudi budget → government spending → non-oil GDP → TASI."
          : "Add macro chain: [rates/DXY/oil] → [asset class effect] → [investment implication]."),
  },

  {
    id: "second_order_effects",
    name: "Second-Order Effects",
    severity: "critical",
    description: "Reply must address contagion or downstream effects beyond the direct macro impact, using arrow notation or explicit 'second-order' language.",
    check: (reply) => {
      const hasField = !!reply.secondOrderRisks;
      const text = [reply.secondOrderRisks, reply.bearCase, reply.macroChain].filter(Boolean).join(" ");
      const hasLanguage = /second.order|contagion|downstream|التأثير\s+الثانوي|تداعيات\s+غير\s+مباشرة|يُولّد\s+بدوره/i.test(text);
      const passed = hasField || hasLanguage;
      return {
        passed,
        score: passed ? (hasField ? 100 : 70) : 0,
        evidence: passed
          ? `secondOrderRisks: ${hasField ? "present" : "absent but language found"}`
          : "No secondOrderRisks field and no second-order language in any field",
      };
    },
    repairHint: (isSaudi, lang) => lang === "ar"
      ? (isSaudi
          ? "secondOrderRisks: انخفاض النفط → تقلص الإنفاق الحكومي → تباطؤ الإقراض المصرفي → انضغاط العقار → تراجع ثروة الأسرة."
          : "secondOrderRisks: [الحدث الأولي] → [تأثير مباشر] يُولّد → [تأثير ثانوي] → [أثر إضافي بعيداً عن القطاع الأولي].")
      : (isSaudi
          ? "secondOrderRisks: oil decline → government spending contraction → bank lending slowdown → real estate compression → household wealth effect."
          : "secondOrderRisks: [primary event] → [direct effect] generates → [second-order effect] → [downstream beyond primary sector]."),
  },

  {
    id: "allocator_logic",
    name: "Allocator Logic",
    severity: "critical",
    description: "Reply must contain explicit institutional allocator stance: scale-in / wait / avoid with a specific reason, OR clear selective-over-broad recommendation.",
    check: (reply) => {
      const text = [
        reply.committeeStance, reply.committeeSynthesis?.finalStance,
        reply.voiceReasoning?.allocator, reply.selectionFramework,
      ].filter(Boolean).join(" ");
      const hasStance = !!reply.committeeStance;
      const hasAllocatorVoice = !!reply.voiceReasoning?.allocator;
      const hasDeploymentLanguage = /scale.{0,5}in|tranche|deploy|wait|avoid|تدريجي|دفعات|انتظار|تجنب/i.test(text);
      const passed = hasStance || hasAllocatorVoice || hasDeploymentLanguage;
      return {
        passed,
        score: passed ? (hasStance && hasAllocatorVoice ? 100 : hasStance || hasAllocatorVoice ? 70 : 50) : 0,
        evidence: passed
          ? `committeeStance: ${reply.committeeStance ?? "absent"}, allocatorVoice: ${hasAllocatorVoice ? "present" : "absent"}`
          : "No committeeStance, no allocator voice reasoning, no deployment language",
      };
    },
    repairHint: (_isSaudi, lang) => lang === "ar"
      ? "اضبط committeeStance و/أو أضف voiceReasoning.allocator بصياغة تشمل: دخول تدريجي / انتظار / تجنب مع السبب المحدد وشرط التأكيد."
      : "Set committeeStance and/or add voiceReasoning.allocator with: scale-in / wait / avoid, specific reason, and confirmation condition.",
  },

  {
    id: "policy_reaction_function",
    name: "Policy Reaction Function",
    severity: "major",
    description: "Reply must contain a policy reaction function: 'if [data X], then [CB does Y], therefore [asset Z]' — not just stating CB policy direction.",
    check: (reply) => {
      const text = [reply.voiceReasoning?.policy, reply.macroChain, reply.outlook].filter(Boolean).join(" ");
      const hasReactionFunction =
        /if.{0,40}(fed|rate|inflation|cb)|reaction\s+function|دالة\s+رد\s+الفعل/i.test(text) ||
        /SAMA.{0,30}follow|SAMA.{0,30}mirror|SAMA.{0,30}shadow/i.test(text) ||
        /إذا.{0,40}(الفيدرالي|الأسعار|التضخم).{0,40}(SAMA|يرفع|يخفض)/i.test(text);
      const passed = hasReactionFunction;
      return {
        passed,
        score: passed ? 100 : 30,
        evidence: passed ? "Policy reaction function language found" : "CB mentioned but no reaction function format (if X then CB does Y then asset Z)",
      };
    },
    repairHint: (isSaudi, lang) => lang === "ar"
      ? (isSaudi
          ? "أضف في voiceReasoning.policy: 'إذا تراجع التضخم الأمريكي → الفيدرالي يُخفّض → SAMA تتبع (ربط SAR) → تكاليف الاقتراض السعودية تنخفض → دعم إعادة التسعير.'"
          : "أضف صياغة دالة رد الفعل: 'إذا X في البيانات → [البنك المركزي] يفعل Y → وبالتالي Z للأصول.'")
      : (isSaudi
          ? "Add to voiceReasoning.policy: 'If US inflation falls → Fed cuts → SAMA follows (SAR peg) → Saudi borrowing costs decline → re-pricing support.'"
          : "Add reaction function: 'If data X → [central bank] does Y → therefore asset Z reprices.'"),
  },

  {
    id: "regime_conflict",
    name: "Regime Conflict Resolution",
    severity: "major",
    description: "When signals conflict (bullish macro + bearish technical, or weak consensus), reply must explicitly name the conflict and state which signal wins and why.",
    check: (reply) => {
      const isConflicted = reply.consensusStrength === "conflicted" || reply.consensusStrength === "weak";
      if (!isConflicted) return { passed: true, score: 100, evidence: "No regime conflict to resolve" };
      const hasConflictResolution =
        !!reply.disagreementNote ||
        !!reply.arbitrationReason ||
        /conflict|contrad|disagree|تعارض|تضارب|يتناقض/i.test([reply.outlook, reply.macroChain].filter(Boolean).join(" "));
      return {
        passed: hasConflictResolution,
        score: hasConflictResolution ? 100 : 0,
        evidence: hasConflictResolution ? "Conflict resolution language found" : "Conflicted consensus but no disagreementNote or arbitrationReason",
      };
    },
    repairHint: (_isSaudi, lang) => lang === "ar"
      ? "عند تعارض الإشارات: أضف disagreementNote تصف ما يتعارض (A صاعد / B هابط) وlanguage تُرجّح أيهما يفوز — مع السبب المحدد."
      : "When signals conflict: add disagreementNote describing what conflicts (A bullish / B bearish) and state which wins — with specific reason.",
  },

  {
    id: "sector_differentiation",
    name: "Sector Differentiation",
    severity: "major",
    description: "Reply must name at least 2 specific sectors with different expected outcomes in the current regime (winner vs loser), with causal linkage.",
    check: (reply) => {
      const text = [reply.sectorLens, reply.outlook].filter(Boolean).join(" ");
      const namedSectors = (text.match(/\b(bank|energy|tech|petrochem|telecom|health|consumer|reit|utility|aramco|sabic|بنك|طاقة|بتروكيماوي|اتصال|صحة|مستهلك|عقار|مرافق|أرامكو|سابك)\b/gi) ?? []);
      const uniqueSectors = new Set(namedSectors.map(s => s.toLowerCase())).size;
      const hasCausal = /→|leads?\s+to|يؤدي|because|لأن/.test(text);
      const passed = uniqueSectors >= 2 && hasCausal;
      return {
        passed,
        score: passed ? 100 : uniqueSectors >= 2 ? 60 : uniqueSectors === 1 ? 30 : 0,
        evidence: passed
          ? `${uniqueSectors} named sectors with causal linkage`
          : `Only ${uniqueSectors} named sector(s); causal linkage: ${hasCausal ? "yes" : "no"}`,
      };
    },
    repairHint: (isSaudi, lang) => lang === "ar"
      ? (isSaudi
          ? "أضف في sectorLens: 'أرامكو (دفاعي — عائد توزيعات يدعم التقييم) مقابل سابك (تعرض صيني — يتأخر).' مع رمز → للربط السببي."
          : "اذكر قطاعين على الأقل بنتائج مختلفة: '[القطاع أ] يتفوق لأن [آلية]؛ [القطاع ب] يتأخر لأن [آلية].'")
      : (isSaudi
          ? "Add to sectorLens: 'Aramco (defensive — dividend yield supports valuation) vs SABIC (China-exposed — lags).' Use → for causal linkage."
          : "Name at least 2 sectors with different outcomes: '[Sector A] outperforms because [mechanism]; [Sector B] lags because [mechanism].'"),
  },

  {
    id: "valuation_vs_earnings",
    name: "Valuation vs Earnings Distinction",
    severity: "major",
    description: "Reply must distinguish whether expected returns are driven by PE multiple expansion (fragile, policy-driven) or EPS earnings growth (durable, fundamental-driven).",
    check: (reply) => {
      const hasField = !!reply.valuationEarningsView;
      const text = [reply.valuationEarningsView, reply.macroChain, reply.thesis].filter(Boolean).join(" ");
      const hasLanguage =
        /(pe\s+expansion|multiple\s+expansion|p\/e|توسع\s+المضاعف)/i.test(text) ||
        /(eps|earnings\s+growth|نمو\s+الأرباح)/i.test(text);
      const passed = hasField || hasLanguage;
      return {
        passed,
        score: passed ? (hasField ? 100 : 60) : 0,
        evidence: passed
          ? `valuationEarningsView: ${hasField ? "present" : "absent but language found"}`
          : "No distinction between PE expansion and EPS growth in reply",
      };
    },
    repairHint: (_isSaudi, lang) => lang === "ar"
      ? "أضف valuationEarningsView: 'الصعود المتوقع مدفوع بـ[توسع PE / نمو EPS]. توسع PE هش (يعتمد على [السياسة/RM الأسواق])؛ نمو EPS مستدام (يتطلب [نفط/أرباح مؤكدة]). الأطروحة الحالية تعتمد على المكوّن [الأكثر/الأقل] هشاشةً.'"
      : "Add valuationEarningsView: 'Expected upside driven by [PE expansion / EPS growth]. PE expansion is fragile (depends on [policy/sentiment]); EPS growth is durable (requires [oil/confirmed earnings]). Current thesis relies on the [more/less] fragile component.'",
  },

  {
    id: "thesis_invalidation",
    name: "Thesis Invalidation",
    severity: "major",
    description: "Reply must contain a specific, observable, measurable event that would break the thesis — not a vague 'if conditions change' statement.",
    check: (reply) => {
      const hasField = !!reply.invalidation || !!reply.thesisChanger;
      const text = [reply.invalidation, reply.thesisChanger].filter(Boolean).join(" ");
      const isSpecific = /\$\d+|%\d+|\d+\s*(bbl|bps|pts?|%)|below|above|drops|rises|falls|exceeds/i.test(text) ||
        /\$\d+|نقطة\s+التعادل|\d+\s*(ب|\/ب)/i.test(text);
      const passed = hasField && (isSpecific || text.length > 40);
      return {
        passed,
        score: passed ? (isSpecific ? 100 : 70) : 0,
        evidence: passed
          ? `Invalidation found: ${text.slice(0, 80)}`
          : `invalidation: ${reply.invalidation ? "present but may be vague" : "absent"}, thesisChanger: ${reply.thesisChanger ? "present" : "absent"}`,
      };
    },
    repairHint: (isSaudi, lang) => lang === "ar"
      ? (isSaudi
          ? "أضف thesisChanger بحد قابل للقياس: 'الرأي يتحول إذا تراجع النفط دون $70/ب لأكثر من 4 أسابيع، أو إذا أعلن الفيدرالي رفعاً إضافياً.'"
          : "أضف invalidation/thesisChanger: '[حدث محدد] + [عتبة قابلة للقياس] يُلغي الأطروحة.'")
      : (isSaudi
          ? "Add thesisChanger with measurable threshold: 'View flips if oil falls below $70/bbl for 4+ weeks, or Fed signals additional hike.'"
          : "Add invalidation/thesisChanger: '[specific event] + [measurable threshold] invalidates the thesis.'"),
  },

  {
    id: "missing_evidence",
    name: "Missing Evidence",
    severity: "major",
    description: "Reply must explicitly name what data or evidence is missing that would most change the conclusion — not generic 'more data needed' statements.",
    check: (reply) => {
      const hasField = !!reply.missingEvidence;
      const isSpecific = hasField && (
        /aramco|oil\s+price|earnings|gdp|pmi|credit|nim|saudi|أرامكو|أرباح|بيانات\s+محددة/i.test(reply.missingEvidence ?? "") ||
        reply.missingEvidence!.length > 60
      );
      const passed = hasField;
      return {
        passed,
        score: passed ? (isSpecific ? 100 : 60) : 0,
        evidence: passed
          ? `missingEvidence: ${isSpecific ? "specific" : "present but may be generic"}`
          : "missingEvidence field absent",
      };
    },
    repairHint: (isSaudi, lang) => lang === "ar"
      ? (isSaudi
          ? "missingEvidence: 'الأدلة المفقودة: أسعار النفط الحالية مقارنةً بنقطة التعادل، أحدث أرباح أرامكو، تدفقات المستثمرين الأجانب لتاسي، اتجاه نمو الائتمان المصرفي.'"
          : "missingEvidence: 'الأدلة المفقودة: [بيانات محددة] التي ستُغيّر الاستنتاج إلى [اتجاه محدد].'")
      : (isSaudi
          ? "missingEvidence: 'Missing: current oil vs Saudi fiscal breakeven, recent Aramco earnings, TASI foreign flow data, bank credit growth direction.'"
          : "missingEvidence: '[specific data] that would shift conclusion to [specific direction].'"),
  },

  {
    id: "capital_preservation",
    name: "Capital Preservation Logic",
    severity: "minor",
    description: "Reply should contain at least one explicit downside control: max drawdown awareness, concentration risk caveat, or capital preservation framing.",
    check: (reply) => {
      const text = [
        reply.caveats?.join(" "),
        reply.bearCase,
        reply.committeeSynthesis?.finalStance,
        reply.voiceReasoning?.allocator,
      ].filter(Boolean).join(" ");
      const hasCapPres =
        /capital\s+preserv|drawdown|concentration\s+risk|downside\s+protect|tail\s+risk|حفظ\s+رأس\s+المال|التراجع|مخاطر\s+التركيز/i.test(text);
      const hasCaveats = (reply.caveats?.length ?? 0) > 0;
      const passed = hasCapPres || hasCaveats;
      return {
        passed,
        score: passed ? 100 : 50,
        evidence: passed
          ? `Capital preservation language found: ${hasCapPres ? "yes" : "no"}; caveats: ${hasCaveats ? reply.caveats!.length : 0}`
          : "No capital preservation framing or caveats in reply",
      };
    },
    repairHint: (_isSaudi, lang) => lang === "ar"
      ? "أضف caveat أو اذكر صراحةً في الموقف النهائي: تحديد حجم المركز يعكس الحد الأقصى للتراجع المقبول — [نسبة مئوية] — وفق قيود التفويض."
      : "Add caveat or state in final stance: position sizing reflects max acceptable drawdown — [percentage] — per mandate constraints.",
  },
];

// ─── Rule ID index ────────────────────────────────────────────────────────────

const RULES_BY_ID = new Map(RULES.map(r => [r.id, r]));

// ─── Weighted scoring ────────────────────────────────────────────────────────

const RULE_WEIGHTS: Record<RuleSeverity, number> = {
  critical: 3,
  major: 2,
  minor: 1,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Runs all 10 depth rules against a Genesis reply and returns a full audit.
 * Pure O(1) — no AI calls, no network.
 */
export function auditInvestmentDepth(reply: GenesisReply): DepthRulesAudit {
  const results = {} as Record<DepthRuleId, RuleCheckResult>;
  const criticalFailed: DepthRuleId[] = [];
  const majorFailed: DepthRuleId[] = [];
  const minorFailed: DepthRuleId[] = [];

  let weightedSum = 0;
  let totalWeight = 0;

  for (const rule of RULES) {
    const result = rule.check(reply);
    results[rule.id] = result;
    const w = RULE_WEIGHTS[rule.severity];
    weightedSum += result.score * w;
    totalWeight += 100 * w;

    if (!result.passed) {
      if (rule.severity === "critical") criticalFailed.push(rule.id);
      else if (rule.severity === "major") majorFailed.push(rule.id);
      else minorFailed.push(rule.id);
    }
  }

  const overallScore = Math.round((weightedSum / totalWeight) * 100);
  const passesMinimum = criticalFailed.length === 0;
  const passedRules = RULES.filter(r => results[r.id].passed).length;

  return {
    totalRules: RULES.length,
    passedRules,
    criticalFailed,
    majorFailed,
    minorFailed,
    overallScore,
    passesMinimum,
    results,
  };
}

/**
 * Returns repair hints for failed rules, ordered by severity.
 * Used to guide deterministic repair after a failed audit.
 */
export function buildDepthRepairHints(
  audit: DepthRulesAudit,
  isSaudi: boolean,
  lang: "ar" | "en",
): string[] {
  const hints: string[] = [];

  // Critical first
  for (const id of audit.criticalFailed) {
    const rule = RULES_BY_ID.get(id);
    if (rule) hints.push(`[CRITICAL] ${rule.name}: ${rule.repairHint(isSaudi, lang)}`);
  }
  // Then major
  for (const id of audit.majorFailed) {
    const rule = RULES_BY_ID.get(id);
    if (rule) hints.push(`[MAJOR] ${rule.name}: ${rule.repairHint(isSaudi, lang)}`);
  }
  // Minor only if no critical/major failures or first 2
  if (audit.criticalFailed.length === 0 && audit.majorFailed.length <= 1) {
    for (const id of audit.minorFailed.slice(0, 2)) {
      const rule = RULES_BY_ID.get(id);
      if (rule) hints.push(`[MINOR] ${rule.name}: ${rule.repairHint(isSaudi, lang)}`);
    }
  }

  return hints.slice(0, 5);
}

/**
 * Returns the authoritative list of all rule IDs and their severities.
 * Exported for use by other checking modules.
 */
export function getRulesSummary(): Array<{ id: DepthRuleId; name: string; severity: RuleSeverity }> {
  return RULES.map(r => ({ id: r.id, name: r.name, severity: r.severity }));
}
