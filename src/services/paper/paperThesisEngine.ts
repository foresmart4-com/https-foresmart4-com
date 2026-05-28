/**
 * Paper Thesis Engine — Phase 29
 * Pure function — no network calls, no AI calls, no new localStorage writes.
 * Simulates thesis lifecycle states by layering paper framing onto existing
 * Phase-23 outcome assessments and Phase-22 regime data.
 *
 * Uses thesisMemory (existing bounded storage, max 50 entries) as the
 * underlying paper memory — no separate store needed.
 *
 * Design rules:
 * - Simulation only: no real order placement, no broker integration
 * - No fake P&L: states are directional, never claim returns or profits
 * - Conservative: paper_unclear is the default when evidence is insufficient
 * - Additive: extends Phase-23 outcome labels with lifecycle framing
 * - Bounded: operates on existing bounded thesisMemory (max 50 entries)
 */

import type { ThesisEntry } from "@/services/learning/thesisMemory";
import type { OutcomeAssessment } from "@/services/learning/outcomeEngine";

// ─── Types ───────────────────────────────────────────────────────────────────

export type PaperThesisState =
  | "paper_active"        // recent thesis, insufficient data to classify
  | "paper_strengthening" // current signals confirm thesis direction
  | "paper_weakened"      // regime conflict or directional challenge
  | "paper_invalidated"   // strong directional contradiction
  | "paper_closed"        // user-resolved (correct/incorrect/mixed)
  | "paper_unclear";      // older thesis, regime data uncertain

export interface PaperThesisEntry {
  id: string;
  asset: string;
  direction: "bullish" | "bearish" | "neutral";
  thesis: string;
  confidence: number;
  regimeAtSave: string | undefined;
  invalidation: string | null;
  paperState: PaperThesisState;
  stateNote: string;   // 1-sentence advisory description
  ageDays: number;
}

export interface PaperSynthesis {
  papers: PaperThesisEntry[];
  activePapers: PaperThesisEntry[];   // paper_active + strengthening + weakened + invalidated
  strengthening: number;
  weakened: number;
  invalidated: number;
  active: number;
  evolutionSummary: string;           // compact ≤160 chars for AI context injection
  hasMeaningfulEvolution: boolean;
}

// ─── State derivation ─────────────────────────────────────────────────────────

const RECENT_THRESHOLD_HOURS = 4;
const REGIME_CHANGE_MIN_HOURS = 6; // wait 6h before flagging regime change

function derivePaperEntry(
  thesis: ThesisEntry,
  assessment: OutcomeAssessment | undefined,
  currentRegime: string,
  ar: boolean,
): PaperThesisEntry {
  const now = Date.now();
  const ageDays = (now - thesis.ts) / 86400000;

  const base: Omit<PaperThesisEntry, "paperState" | "stateNote"> = {
    id: thesis.id,
    asset: thesis.asset,
    direction: thesis.direction,
    thesis: thesis.thesis,
    confidence: thesis.confidence,
    regimeAtSave: thesis.regimeAtSave,
    invalidation: thesis.invalidation ?? null,
    ageDays,
  };

  // User-resolved outcomes take precedence over all auto-assessments
  if (thesis.outcome === "correct" || thesis.outcome === "incorrect" || thesis.outcome === "mixed") {
    const closedNote = thesis.outcome === "correct"
      ? (ar ? "تأكيد المستخدم: صحيح" : "User-confirmed: correct — paper thesis closed")
      : thesis.outcome === "incorrect"
        ? (ar ? "تأكيد المستخدم: خطأ" : "User-confirmed: incorrect — paper thesis closed")
        : (ar ? "نتيجة مختلطة وتم إغلاقه" : "Mixed outcome — paper thesis closed");
    return { ...base, paperState: "paper_closed", stateNote: closedNote };
  }

  // Map from Phase-23 auto-outcome assessment
  if (assessment) {
    switch (assessment.label) {
      case "thesis_confirmed":
        return {
          ...base,
          paperState: "paper_strengthening",
          stateNote: ar
            ? `أطروحة ورقية تتعزز — ${assessment.note}`
            : `Paper thesis strengthening — ${assessment.note}`,
        };
      case "thesis_weakened":
        return {
          ...base,
          paperState: "paper_weakened",
          stateNote: ar
            ? `أطروحة ورقية تضعف — ${assessment.note}`
            : `Paper thesis weakening — ${assessment.note}`,
        };
      case "thesis_invalidated":
        return {
          ...base,
          paperState: "paper_invalidated",
          stateNote: ar
            ? `أطروحة ورقية ملغاة — ${assessment.note}`
            : `Paper thesis invalidated — ${assessment.note}`,
        };
      case "outcome_unclear": {
        // Check for regime change since thesis was saved
        const regimeChanged =
          thesis.regimeAtSave &&
          currentRegime &&
          thesis.regimeAtSave.toLowerCase() !== currentRegime.replace(/_/g, " ").toLowerCase() &&
          ageDays * 24 >= REGIME_CHANGE_MIN_HOURS;

        if (ageDays * 24 < RECENT_THRESHOLD_HOURS) {
          return {
            ...base,
            paperState: "paper_active",
            stateNote: ar ? "أطروحة ورقية نشطة — لا يوجد تقييم بعد" : "Paper thesis active — assessment pending",
          };
        }
        if (regimeChanged) {
          return {
            ...base,
            paperState: "paper_weakened",
            stateNote: ar
              ? `نظام السوق تحوّل منذ إنشاء الأطروحة (${thesis.regimeAtSave} → ${currentRegime})`
              : `Market regime shifted since thesis creation (${thesis.regimeAtSave} → ${currentRegime})`,
          };
        }
        return {
          ...base,
          paperState: "paper_unclear",
          stateNote: ar ? "نتيجة غير محددة — أدلة غير كافية" : "Outcome unclear — insufficient evidence",
        };
      }
    }
  }

  // No assessment available — classify by age
  if (ageDays * 24 < RECENT_THRESHOLD_HOURS) {
    return { ...base, paperState: "paper_active", stateNote: ar ? "أطروحة ورقية نشطة" : "Paper thesis active" };
  }
  return { ...base, paperState: "paper_unclear", stateNote: ar ? "لا يوجد تقييم متاح" : "No assessment available" };
}

// ─── Evolution summary ────────────────────────────────────────────────────────

function buildEvolutionSummary(
  papers: PaperThesisEntry[],
  strengthening: number,
  weakened: number,
  invalidated: number,
  active: number,
  ar: boolean,
): string {
  const total = papers.length;
  if (!total) return "";

  const parts: string[] = [];
  if (active > 0) parts.push(ar ? `${active} نشطة` : `${active} active`);
  if (strengthening > 0) parts.push(ar ? `${strengthening} تتعزز` : `${strengthening} strengthening`);
  if (weakened > 0) parts.push(ar ? `${weakened} تضعف` : `${weakened} weakening`);
  if (invalidated > 0) parts.push(ar ? `${invalidated} ملغاة` : `${invalidated} invalidated`);

  // Most notable paper state note
  const notable =
    papers.find((p) => p.paperState === "paper_invalidated") ??
    papers.find((p) => p.paperState === "paper_weakened") ??
    papers.find((p) => p.paperState === "paper_strengthening");

  let result = ar
    ? `أطروحات ورقية (${total}): ${parts.join("، ")}`
    : `Paper theses (${total}): ${parts.join(", ")}`;

  if (notable) {
    result += `. ${notable.asset}: ${notable.stateNote.slice(0, 60)}`;
  }

  return result.slice(0, 180);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Derives paper thesis states for all recent theses.
 * Pure function — deterministic, no I/O, no new storage.
 * Operates on existing bounded thesisMemory as the paper memory backing.
 */
export function computePaperSynthesis(
  theses: ThesisEntry[],
  assessments: OutcomeAssessment[],
  currentRegime: string,
  ar: boolean,
): PaperSynthesis {
  if (!theses.length) {
    return {
      papers: [],
      activePapers: [],
      strengthening: 0, weakened: 0, invalidated: 0, active: 0,
      evolutionSummary: "",
      hasMeaningfulEvolution: false,
    };
  }

  // Build a fast lookup by thesis ID
  const assessmentMap = new Map<string, OutcomeAssessment>();
  for (const a of assessments) assessmentMap.set(a.thesisId, a);

  // Derive paper entry for each thesis
  const papers = theses
    .slice(-10) // only consider last 10 to keep it bounded
    .map((t) => derivePaperEntry(t, assessmentMap.get(t.id), currentRegime, ar));

  const activePapers = papers.filter((p) =>
    p.paperState === "paper_active" ||
    p.paperState === "paper_strengthening" ||
    p.paperState === "paper_weakened" ||
    p.paperState === "paper_invalidated",
  );

  const strengthening = papers.filter((p) => p.paperState === "paper_strengthening").length;
  const weakened      = papers.filter((p) => p.paperState === "paper_weakened").length;
  const invalidated   = papers.filter((p) => p.paperState === "paper_invalidated").length;
  const active        = papers.filter((p) => p.paperState === "paper_active").length;

  const hasMeaningfulEvolution = strengthening > 0 || weakened > 0 || invalidated > 0;
  const evolutionSummary = buildEvolutionSummary(papers, strengthening, weakened, invalidated, active, ar);

  return { papers, activePapers, strengthening, weakened, invalidated, active, evolutionSummary, hasMeaningfulEvolution };
}
