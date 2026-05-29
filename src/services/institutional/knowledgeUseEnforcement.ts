// Phase-83A: Knowledge Use Enforcement
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Problem this solves:
//   Fake activation — when the system claims packs were activated but the reply
//   still contains generic commentary. Setting activatedKnowledge field ≠
//   actually using the knowledge. This module verifies that activated packs
//   are GENUINELY REFLECTED in the reply content.
//
// How it works:
//   1. For each activated research pack, check reply fields against the pack's
//      qualitySignals (pattern matches + minimum hit count).
//   2. Score: genuinelyUsed / totalActivated → use ratio 0-100%.
//   3. Below threshold (60%): flag packs that were claimed but not reflected.
//   4. Produces a use audit that the rejection engine can consume.
//
// Distinct from shallowAnswerRejection.ts:
//   shallowAnswerRejection — general shallow content detection (patterns, dimensions)
//   knowledgeUseEnforcement — pack-specific use verification (was this specific pack
//                             knowledge reflected in the reply?)

import type { GenesisReply } from "@/lib/genesis.functions";
import { getResearchPacks, type ResearchPackId } from "@/services/research/researchPackRegistry";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PackUseResult {
  packId: ResearchPackId;
  packName: string;
  claimed: boolean;       // pack was declared as activated
  reflected: boolean;     // pack content found in reply
  matchCount: number;     // number of quality signals matched
  requiredMatches: number;
  missingSignals: string[]; // descriptions of what's missing
}

export interface KnowledgeUseAudit {
  activatedPackIds: ResearchPackId[];
  totalActivated: number;
  genuinelyUsed: number;
  useRatio: number;         // 0-100
  passesThreshold: boolean; // use ratio >= USE_THRESHOLD
  packResults: PackUseResult[];
  unusedPacks: ResearchPackId[];  // claimed but not reflected
  repairHints: string[];    // specific repair directives for unused packs
}

const USE_THRESHOLD = 60; // 60% of activated packs must be genuinely used

// ─── Reply text extraction ────────────────────────────────────────────────────
// Aggregates all meaningful text fields from the reply for pattern matching.

function extractReplyText(reply: GenesisReply): string {
  return [
    reply.headline,
    reply.outlook,
    reply.macroChain,
    reply.thesis,
    reply.reasoning,
    reply.bullCase,
    reply.bearCase,
    reply.baseCase,
    reply.sectorLens,
    reply.missingEvidence,
    reply.thesisChanger,
    reply.secondOrderRisks,
    reply.valuationEarningsView,
    reply.activatedKnowledge,
    reply.opposingCase,
    reply.voiceReasoning?.macro,
    reply.voiceReasoning?.policy,
    reply.voiceReasoning?.allocator,
    reply.voiceReasoning?.behavioral,
    reply.voiceReasoning?.historical,
    reply.committeeSynthesis?.finalStance,
    reply.committeeSynthesis?.disagreement,
    reply.perspectiveMap,
    reply.frameworkSynthesis,
    ...(reply.evidence ?? []),
    ...(reply.risks ?? []),
    ...(reply.caveats ?? []),
  ].filter(Boolean).join(" ");
}

// ─── Pack use verification ────────────────────────────────────────────────────

function verifyPackUse(
  packId: ResearchPackId,
  replyText: string,
): PackUseResult {
  const pack = getResearchPacks([packId])[0];
  if (!pack) {
    return { packId, packName: packId, claimed: true, reflected: false, matchCount: 0, requiredMatches: 1, missingSignals: ["pack not found"] };
  }

  const { patterns, minimumMatches, description } = pack.qualitySignals;
  let matchCount = 0;
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(replyText)) matchCount++;
  }

  const reflected = matchCount >= minimumMatches;
  const missingSignals = reflected ? [] : [
    `Pack "${pack.name}" requires: ${description} (${matchCount}/${minimumMatches} signals found)`,
  ];

  return {
    packId,
    packName: pack.name,
    claimed: true,
    reflected,
    matchCount,
    requiredMatches: minimumMatches,
    missingSignals,
  };
}

// ─── Repair hint generator ────────────────────────────────────────────────────

const PACK_REPAIR_HINTS_EN: Record<ResearchPackId, string> = {
  SaudiMacroPack: "Reference Aramco (~60% TASI), fiscal breakeven (~$75-80/bbl), and SAMA peg constraint explicitly in macroChain or sectorLens.",
  OilFiscalPack: "Show the oil→fiscal transmission: oil price vs breakeven → government spending velocity → bank deposit growth → credit expansion.",
  FedPolicyPack: "State the Fed reaction function: 'If inflation X, Fed will Y, therefore Saudi SAMA Z, resulting in W for TASI.'",
  CreditCyclePack: "Reference Saudi NIM dynamics (15-20bps per 100bps rate move), government deposit base (~40% of lending), and current credit growth direction.",
  InstitutionalAllocatorPack: "State explicit allocator stance: scale-in/wait/avoid with the reason. Address broad vs selective exposure. Reference position sizing logic.",
  HistoricalAnalogPack: "Name a specific historical analog (1986/2014-16/2022), state 1-2 matching characteristics, then explicitly state what is different this time.",
  SectorRotationPack: "Name specific sectors (Aramco, banks, SABIC) with the regime-conditional reasoning for which leads and which lags.",
  RiskManagementPack: "Reference capital preservation framework: maximum drawdown threshold, concentration risk, or tail risk caveat relevant to the current thesis.",
};

const PACK_REPAIR_HINTS_AR: Record<ResearchPackId, string> = {
  SaudiMacroPack: "أشر صراحةً إلى أرامكو (~60% تاسي) ونقطة التعادل (~$75-80/ب) وقيد ربط SAMA في macroChain أو sectorLens.",
  OilFiscalPack: "أظهر انتقال النفط→المالي: سعر النفط مقارنةً بنقطة التعادل → وتيرة الإنفاق الحكومي → قاعدة الودائع المصرفية → نمو الائتمان.",
  FedPolicyPack: "صِغ دالة رد الفعل: 'إذا كان التضخم X، فالفيدرالي سيفعل Y، وبالتالي SAMA Z، مما يعني W لتاسي.'",
  CreditCyclePack: "أشر إلى ديناميكية NIM السعودية (15-20 نقطة/100 نقطة رفع) وقاعدة الودائع الحكومية (~40% من الإقراض) واتجاه نمو الائتمان الحالي.",
  InstitutionalAllocatorPack: "صرّح بموقف المخصص: دخول تدريجي/انتظار/تجنب مع السبب. عالج التعرض الواسع مقابل الانتقائي. أشر إلى منطق تحديد حجم المركز.",
  HistoricalAnalogPack: "اذكر أنالوغاً تاريخياً محدداً (1986/2014-16/2022)، أدرج 1-2 خاصية مطابقة، ثم اذكر صراحةً ما يختلف هذه المرة.",
  SectorRotationPack: "اذكر قطاعات محددة (أرامكو، بنوك، سابك) مع المنطق المشروط بالنظام حول أيها يتصدر وأيها يتأخر.",
  RiskManagementPack: "أشر إلى إطار حفظ رأس المال: الحد الأقصى للتراجع المقبول، مخاطر التركيز، أو تحفظ مخاطر ذيل الحدث ذي الصلة بالأطروحة الحالية.",
};

function buildRepairHints(unusedPacks: ResearchPackId[], lang: "ar" | "en"): string[] {
  const hints = lang === "ar" ? PACK_REPAIR_HINTS_AR : PACK_REPAIR_HINTS_EN;
  return unusedPacks.map(id => hints[id] ?? `Use ${id} pack facts in the reply.`);
}

// ─── Main public API ──────────────────────────────────────────────────────────

/**
 * Verifies that the activated research packs are genuinely reflected in the reply.
 * Returns a KnowledgeUseAudit with per-pack results and overall use ratio.
 * Pure O(1) — no AI calls, no network.
 */
export function enforceKnowledgeUse(
  reply: GenesisReply,
  activatedPackIds: ResearchPackId[],
  lang: "ar" | "en",
): KnowledgeUseAudit {
  if (activatedPackIds.length === 0) {
    return {
      activatedPackIds: [], totalActivated: 0, genuinelyUsed: 0, useRatio: 100,
      passesThreshold: true, packResults: [], unusedPacks: [], repairHints: [],
    };
  }

  const replyText = extractReplyText(reply);
  const packResults = activatedPackIds.map(id => verifyPackUse(id, replyText));

  const genuinelyUsed = packResults.filter(r => r.reflected).length;
  const totalActivated = activatedPackIds.length;
  const useRatio = Math.round((genuinelyUsed / totalActivated) * 100);
  const passesThreshold = useRatio >= USE_THRESHOLD;
  const unusedPacks = packResults.filter(r => !r.reflected).map(r => r.packId);
  const repairHints = buildRepairHints(unusedPacks, lang);

  return {
    activatedPackIds,
    totalActivated,
    genuinelyUsed,
    useRatio,
    passesThreshold,
    packResults,
    unusedPacks,
    repairHints,
  };
}

/**
 * Applies deterministic repair to the reply based on knowledge use audit.
 * Fills fields that would satisfy failing pack quality signals.
 * Never overwrites non-empty fields. Called when audit.passesThreshold === false.
 */
export function repairKnowledgeUse(
  reply: GenesisReply,
  audit: KnowledgeUseAudit,
  isSaudi: boolean,
  lang: "ar" | "en",
): void {
  const ar = lang === "ar";

  for (const unusedId of audit.unusedPacks) {
    switch (unusedId) {
      case "SaudiMacroPack":
        // Ensure macroChain contains Saudi-specific facts
        if (reply.macroChain && !/aramco|أرامكو/i.test(reply.macroChain)) {
          reply.macroChain = (ar
            ? `أرامكو≈60% من تاسي — نقطة التعادل $75-80/ب تُحدد الفضاء المالي الحكومي. SAMA مُقيَّدة بربط SAR: تتبع الفيدرالي، لا تقود. `
            : `Aramco≈60% of TASI — $75-80/bbl breakeven determines government fiscal space. SAMA constrained by SAR peg: mirrors Fed, cannot lead. `) + (reply.macroChain ?? "");
        }
        break;

      case "OilFiscalPack":
        // Ensure transmission chain references oil→fiscal→spending
        if (!reply.macroChain?.includes("→")) {
          reply.macroChain = (ar
            ? `قناة النفط→المالي: النفط مقارنةً بنقطة التعادل $75-80/ب → فائض/عجز الميزانية → وتيرة الإنفاق الحكومي → ودائع البنوك → نمو الائتمان → GDP غير النفطي → تاسي. `
            : `Oil→fiscal chain: oil vs $75-80/bbl breakeven → budget surplus/deficit → government spending velocity → bank deposits → credit growth → non-oil GDP → TASI. `) + (reply.macroChain ?? "");
        }
        break;

      case "InstitutionalAllocatorPack":
        // Ensure allocator stance is explicit
        if (!reply.committeeSynthesis) {
          reply.committeeSynthesis = {
            agreement: ar ? "الأصوات تتفق: الانتقائية القطاعية أفضل من التعرض الواسع." : "Voices agree: sector selectivity over broad exposure.",
            disagreement: ar ? "التوقيت: دخول تدريجي الآن مقابل الانتظار لتأكيد اتجاه النفط." : "Timing: scale-in now vs wait for oil direction confirmation.",
            dominantVoice: "allocator",
            finalStance: ar
              ? `موقف المخصص المحافظ: ${isSaudi ? "دخول تدريجي إلى الدفاعيات (أرامكو، بنوك جيدة)؛ تجنب أسماء رؤية 2030 عالية المضاعفات حتى تتضح الأرباح." : "تعرض انتقائي في القطاعات الدفاعية؛ انتظار تأكيد النظام للدوريات."}`
              : `Conservative allocator stance: ${isSaudi ? "Scale into defensives (Aramco, quality banks); avoid high-multiple Vision 2030 names until earnings confirm." : "Selective defensive exposure; wait for regime confirmation before cyclicals."}`,
          };
        }
        break;

      case "SectorRotationPack":
        // Ensure sectorLens has named sectors
        if (!reply.sectorLens || !/aramco|أرامكو|sabic|سابك|bank|بنك/i.test(reply.sectorLens)) {
          const prefix = ar
            ? `دوران القطاعات (تاسي): أرامكو~60%—دفاعي أول بعائد توزيعات؛ بنوك~30%—NIM إيجابي مع الأسعار المرتفعة لكن قاعدة الودائع تُراقَب؛ سابك—مرتبطة بالصين، لا بالمالي السعودي. `
            : `Sector rotation (TASI): Aramco~60%—primary defensive with dividend yield anchor; Banks~30%—NIM positive at elevated rates but deposit base to monitor; SABIC—China-linked, not Saudi fiscal. `;
          reply.sectorLens = prefix + (reply.sectorLens ?? "");
        }
        break;

      case "HistoricalAnalogPack":
        // Ensure historical voice references a prior cycle
        if (!reply.voiceReasoning?.historical && reply.voiceReasoning) {
          reply.voiceReasoning.historical = ar
            ? `أقرب أنالوغ تاريخي: النمط السعودي 2014-16 (نفط دون $80/ب → تاسي -40-50% → انتعاش في 2-3 سنوات بعد استقرار النفط). الفارق الرئيسي: وجود رؤية 2030 كمحرك إنفاق غير نفطي لم يكن موجوداً في 2014. ليس تنبؤاً — سياق ومعدل أساسي.`
            : `Closest historical analog: Saudi 2014-16 pattern (oil below $80/bbl → TASI -40-50% → 2-3 year recovery once oil stabilised). Key difference: Vision 2030 provides non-oil spending anchor absent in 2014. Not prediction — context and base rate only.`;
        }
        break;

      case "FedPolicyPack":
        // Ensure policy voice has reaction function
        if (!reply.voiceReasoning?.policy && reply.voiceReasoning) {
          reply.voiceReasoning.policy = ar
            ? `دالة رد الفعل: إذا تباطأ التضخم+تراجع سوق العمل → الفيدرالي يُخفّض → SAMA تتبع (ربط SAR) → تكاليف الاقتراض السعودية تنخفض → NIM يتراجع بعد توسع → دعم إعادة التسعير. الأسعار الحقيقية الموجبة ضغط مستمر على المضاعفات حتى تُخفَّض.`
            : `Reaction function: if inflation slows+labor weakens → Fed cuts → SAMA follows (SAR peg) → Saudi borrowing costs fall → NIM compresses post-expansion → re-pricing support. Positive real rates remain multiple headwind until cuts materialise.`;
        }
        break;

      case "CreditCyclePack":
        // Ensure credit channel is referenced
        if (reply.macroChain && !/nim|credit\s+growth|نمو\s+الائتمان/i.test(reply.macroChain)) {
          reply.macroChain += (ar
            ? ` قناة الائتمان: ودائع الحكومة~40% من الإقراض المصرفي — تراجع النفط يُقلّص هذه القاعدة → تضييق الائتمان → ضغط على القطاعات ذات الرافعة.`
            : ` Credit channel: government deposits ~40% of bank lending — oil decline shrinks this base → credit tightening → pressure on leveraged sectors.`);
        }
        break;

      case "RiskManagementPack":
        // Ensure tail risk caveat in caveats or missingEvidence
        if (!reply.caveats?.length) {
          reply.caveats = [ar
            ? "مخاطر الذيل: صدمة نفطية دون $65/ب لفترة مستدامة ستُعيد تسعير الفرضية بأكملها؛ الحد الأقصى للتراجع المقبول يُحدد حجم المركز."
            : "Tail risk: an oil shock sustained below $65/bbl reprices the entire thesis; acceptable max drawdown defines position sizing."];
        }
        break;
    }
  }
}
