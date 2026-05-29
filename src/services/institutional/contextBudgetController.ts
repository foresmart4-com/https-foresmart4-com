// Phase-83B Risk Closure: Context Budget Controller
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Problem: Research pack injection can add 1500-2000 chars per investment question.
// When combined with depth engine (800 chars), Saudi depth (900 chars), and all
// other context blocks, the total prompt can exceed context window budget, causing
// the model to truncate or ignore earlier, higher-priority context blocks.
//
// Solution: Rank research packs by relevance, enforce a hard character budget,
// preserve mandatory Saudi packs, and log what was trimmed.
//
// Budget philosophy:
//   - Total research pack budget: 1600 chars (fits 4-5 compact pack blocks)
//   - Mandatory Saudi packs always included if isSaudi (SaudiMacro, OilFiscal, Allocator)
//   - Remaining budget filled by relevance-ranked non-mandatory packs
//   - Pairs with high content overlap → lower-ranked dropped (deduplication)

import type { ResearchPackId } from "@/services/research/researchPackRegistry";
import { getResearchPack } from "@/services/research/researchPackRegistry";

// ─── Budget constants ─────────────────────────────────────────────────────────

const CONTEXT_BUDGET_CHARS = 1600;

// Mandatory packs for Saudi questions — never trimmed if activated
const MANDATORY_SAUDI_PACKS: ResearchPackId[] = [
  "SaudiMacroPack",
  "OilFiscalPack",
  "InstitutionalAllocatorPack",
];

// Known overlapping pairs — if both are selected, prefer the higher-ranked one
// and drop the lower (they share significant content overlap)
const OVERLAP_PAIRS: Array<[ResearchPackId, ResearchPackId]> = [
  ["SaudiMacroPack", "OilFiscalPack"],       // both cover Saudi fiscal; Macro supersedes
  ["FedPolicyPack", "CreditCyclePack"],       // both cover rates/spreads; Fed is more focused
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContextBudgetResult {
  selected: ResearchPackId[];       // packs to inject
  trimmed: ResearchPackId[];        // packs dropped to fit budget
  mandatoryIncluded: ResearchPackId[]; // mandatory packs that were preserved
  budgetUsed: number;               // approximate chars used
  budgetAvailable: number;          // CONTEXT_BUDGET_CHARS
  allocationNote: string;           // log-safe allocation summary
}

// ─── Relevance scoring ────────────────────────────────────────────────────────

const PACK_KEYWORDS: Record<ResearchPackId, string[]> = {
  SaudiMacroPack:            ["saudi", "tasi", "aramco", "أرامكو", "تاسي", "سعود"],
  OilFiscalPack:             ["oil", "fiscal", "breakeven", "نفط", "نقطة التعادل", "ميزانية"],
  FedPolicyPack:             ["fed", "rate", "federal", "الفيدرالي", "فائدة", "دولار"],
  CreditCyclePack:           ["credit", "spread", "nim", "ائتمان", "مصرف", "بنك"],
  InstitutionalAllocatorPack:["allocat", "portfolio", "horizon", "مخصص", "محفظة", "أفق"],
  HistoricalAnalogPack:      ["history", "analog", "cycle", "تاريخ", "أنالوغ", "دورة"],
  SectorRotationPack:        ["sector", "rotation", "sabic", "قطاع", "دوران", "سابك"],
  RiskManagementPack:        ["risk", "drawdown", "tail", "مخاطر", "التراجع", "ذيل"],
};

function scorePackRelevance(
  packId: ResearchPackId,
  question: string,
  ctx: string,
  isSaudi: boolean,
): number {
  const text = `${question} ${ctx}`.toLowerCase();
  const keywords = PACK_KEYWORDS[packId] ?? [];
  let score = keywords.filter(k => text.includes(k)).length;

  // Bonus for Saudi mandatory packs in Saudi questions
  if (isSaudi && MANDATORY_SAUDI_PACKS.includes(packId)) score += 5;

  // Bonus for allocator pack in allocator questions
  if (/conservat|allocat|محافظ|مخصص|أفق/i.test(text) && packId === "InstitutionalAllocatorPack") score += 3;

  return score;
}

// ─── Overlap deduplication ────────────────────────────────────────────────────

function applyOverlapDeduplication(
  rankedPacks: ResearchPackId[],
): ResearchPackId[] {
  const toRemove = new Set<ResearchPackId>();

  for (const [higher, lower] of OVERLAP_PAIRS) {
    // If both are in the ranked list, keep the one ranked earlier (higher)
    const higherIdx = rankedPacks.indexOf(higher);
    const lowerIdx = rankedPacks.indexOf(lower);
    if (higherIdx !== -1 && lowerIdx !== -1 && higherIdx < lowerIdx) {
      // Both present and higher-priority pack comes first — remove lower
      toRemove.add(lower);
    }
  }

  return rankedPacks.filter(id => !toRemove.has(id));
}

// ─── Pack char estimator ──────────────────────────────────────────────────────

function estimatePackChars(packId: ResearchPackId, lang: "ar" | "en"): number {
  try {
    const pack = getResearchPack(packId);
    const block = pack.contextBlock(lang);
    return block.length + 10; // +10 for label prefix
  } catch {
    return 350; // fallback estimate
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Allocates a context budget across the provided research pack IDs.
 * Mandatory Saudi packs are always included; remaining packs are ranked by
 * relevance and added until the budget is exhausted.
 * Pure O(1) for typical pack counts (≤8). No AI calls, no network.
 */
export function allocateContextBudget(
  packIds: ResearchPackId[],
  question: string,
  ctx: string,
  isSaudi: boolean,
  lang: "ar" | "en" = "en",
): ContextBudgetResult {
  if (packIds.length === 0) {
    return {
      selected: [], trimmed: [], mandatoryIncluded: [],
      budgetUsed: 0, budgetAvailable: CONTEXT_BUDGET_CHARS,
      allocationNote: "no research packs activated",
    };
  }

  // Separate mandatory from optional
  const mandatory = packIds.filter(id => isSaudi && MANDATORY_SAUDI_PACKS.includes(id));
  const optional = packIds.filter(id => !mandatory.includes(id));

  // Score and rank optional packs by relevance
  const scoredOptional = optional
    .map(id => ({ id, score: scorePackRelevance(id, question, ctx, isSaudi) }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.id);

  // Start with mandatory packs (always included)
  const selected: ResearchPackId[] = [...mandatory];
  let budgetUsed = mandatory.reduce((sum, id) => sum + estimatePackChars(id, lang), 0);

  // Fill remaining budget with optional packs (after overlap deduplication)
  const dedupedOptional = applyOverlapDeduplication(scoredOptional);
  const trimmed: ResearchPackId[] = [];

  for (const id of dedupedOptional) {
    const chars = estimatePackChars(id, lang);
    if (budgetUsed + chars <= CONTEXT_BUDGET_CHARS) {
      selected.push(id);
      budgetUsed += chars;
    } else {
      trimmed.push(id);
    }
  }

  // Build a log-safe allocation note (no sensitive data, no market data)
  const allocationNote = trimmed.length === 0
    ? `all ${selected.length} packs fit within budget (${budgetUsed}/${CONTEXT_BUDGET_CHARS} chars)`
    : `${selected.length} packs selected (${budgetUsed}/${CONTEXT_BUDGET_CHARS} chars); trimmed ${trimmed.length}: [${trimmed.join(",")}]`;

  return {
    selected,
    trimmed,
    mandatoryIncluded: mandatory,
    budgetUsed,
    budgetAvailable: CONTEXT_BUDGET_CHARS,
    allocationNote,
  };
}
