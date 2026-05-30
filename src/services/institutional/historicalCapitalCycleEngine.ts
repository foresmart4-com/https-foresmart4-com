// LCCR-4: Historical Capital Cycle Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Root cause addressed: Genesis uses history to label regimes rather than to
// inform allocation decisions. Investment committees use history through the
// CAPITAL CYCLE lens: what did allocators DO in similar cycles, and what was
// the cost of being early, late, or correctly positioned?
//
// Distinct from existing modules:
//   historicalAnalogyEngine.ts (83A) — multi-cycle analog matching (regime → episode)
//   regimeHistoryEngine.ts (89C)     — regime norms and historical cycle duration
//   crisisHistoryLibrary.ts (89C)    — crisis archetype detection and transmission
//
// This module applies the CAPITAL CYCLE FRAMEWORK (Howard Marks, Jeremy Grantham):
//   — Capital cycle phase: expansion / peak / contraction / trough
//   — Historical episode where the cycle matched current conditions
//   — What institutional allocators did in that episode
//   — What happened to those who were early, late, or correctly positioned
//   — What is DIFFERENT now (mandatory structural differentiation)
//   — Analog confidence (high/moderate/low/negligible)
//
// Educational/advisory only. History is context, not prediction. All analogies
// are conditional. FORBIDDEN: "history proves", "will repeat", "guaranteed".

import type { Lang } from "@/lib/ai/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CapitalCyclePhase =
  | "early_expansion"    // credit loosening; earnings recovering; allocators deploying
  | "mid_expansion"      // peak earnings momentum; consensus bullish; flows abundant
  | "late_expansion"     // stretched valuations; leverage elevated; complacency risk
  | "distribution"       // smart money distributing; retail entering; divergence forming
  | "early_contraction"  // credit tightening; earnings misses; flows reversing
  | "deep_contraction"   // stress peaks; forced selling; liquidity premia spike
  | "transition";        // regime unclear; signals mixed; cycle phase contested

export type AnalogConfidence =
  | "high"       // multiple dimensions align with the current episode
  | "moderate"   // key dimensions align; some structural differences
  | "low"        // partial alignment only; treat as illustrative, not predictive
  | "negligible";// conditions diverge significantly; analog should not anchor reasoning

export interface CapitalCycleEpisode {
  id:          string;          // e.g. "2009_early_cycle"
  era:         string;          // e.g. "2009-2010"
  label:       string;          // e.g. "Post-GFC early expansion"
  phase:       CapitalCyclePhase;
  whatAllocatorsDid:  string;   // ≤120 chars
  earlyOutcome:       string;   // ≤100 chars: what happened to early movers
  lateOutcome:        string;   // ≤100 chars: what happened to late movers
  correctOutcome:     string;   // ≤100 chars: what the correctly-positioned allocator earned
}

export interface CapitalCycleResult {
  currentPhase:       CapitalCyclePhase;
  dominantEpisode:    CapitalCycleEpisode | null;
  analogConfidence:   AnalogConfidence;
  whatDiffersNow:     string;     // ≤130 chars: mandatory structural differentiation
  allocationLesson:   string;     // ≤130 chars: what allocators should take from this episode
  capitalCycleContext: string;    // injectable ≤380 chars
}

interface CycleInput {
  regime:            string;
  macroBias:         "bullish" | "bearish" | "neutral";
  creditStress:      "low" | "moderate" | "high" | "extreme";
  consensusStrength: "strong" | "moderate" | "weak" | "conflicted";
  regimeConf:        number;       // 0-100
  isSaudi:           boolean;
  oilPrice:          number | null;
  question:          string;
  lang:              Lang;
}

// ─── Episode library ─────────────────────────────────────────────────────────
// Historical episodes framed through the capital cycle lens.
// Each episode captures what allocators did and the outcome split.

const EPISODES: CapitalCycleEpisode[] = [
  {
    id:  "2009_early_cycle",
    era: "2009-2010",
    label: "Post-GFC early expansion",
    phase: "early_expansion",
    whatAllocatorsDid:  "Sovereign wealth and endowments deployed into beaten-down equities and credit while retail remained fearful.",
    earlyOutcome:  "Positioned Q1 2009 earned 100%+ in 18 months; the entry was uncomfortable but asymmetrically rewarding.",
    lateOutcome:   "Late movers (entering Q4 2009) still earned 30-40% but missed the steepest recovery slope.",
    correctOutcome:"Patient entry at peak stress with a 12-24M horizon captured the full recovery premium.",
  },
  {
    id:  "2011_distribution",
    era: "2011",
    label: "Euro-debt distribution phase",
    phase: "distribution",
    whatAllocatorsDid:  "Institutional allocators reduced European credit exposure; retail bought the dip repeatedly. Divergence was visible 6 months early.",
    earlyOutcome:  "Reduced early: avoided 25-30% credit drawdown in periphery.",
    lateOutcome:   "Stayed long through distribution: full drawdown exposure with forced redemption risk.",
    correctOutcome:"Core/satellite split: protected core while satellite waited for the actual trough entry.",
  },
  {
    id:  "2015_em_contraction",
    era: "2015-2016",
    label: "EM/commodity contraction",
    phase: "early_contraction",
    whatAllocatorsDid:  "Institutional allocators reduced EM commodity exposure as dollar strengthened; cash and developed-market defensives were bid.",
    earlyOutcome:  "Early exit from EM commodities avoided 40% peak-to-trough drawdown in materials.",
    lateOutcome:   "Staying long into Q1 2016 required tolerance for 50%+ drawdowns in commodity names.",
    correctOutcome:"Wait-and-watch through mid-2016 then re-entry at cleared technical levels earned the 2016-2018 EM rally.",
  },
  {
    id:  "2018_late_expansion",
    era: "2018",
    label: "Late-cycle expansion with credit fragility",
    phase: "late_expansion",
    whatAllocatorsDid:  "Quality managers reduced leverage and extended duration hedges; consensus remained bullish until Q4.",
    earlyOutcome:  "Reduced beta by Q3 2018 avoided the Q4 25% SPX drawdown.",
    lateOutcome:   "Stayed fully cyclical through Q4: full drawdown exposure with no quality buffer.",
    correctOutcome:"Barbell: defensive anchor + optionality into 2019 caught the recovery.",
  },
  {
    id:  "2020_trough",
    era: "March 2020",
    label: "COVID deep contraction / trough",
    phase: "deep_contraction",
    whatAllocatorsDid:  "Sovereign funds and large institutions bought duration and quality credit at the trough; retail panicked into cash.",
    earlyOutcome:  "Bought March 2020 trough: 50-80% gains in equities within 12 months.",
    lateOutcome:   "Waited until Q4 2020 for certainty: still earned 20-30% but at stretched valuations.",
    correctOutcome:"Systematic trough deployment in tranches from March to May 2020 earned the bulk of the recovery.",
  },
  {
    id:  "2022_tightening_cycle",
    era: "2022-2023",
    label: "Monetary tightening — distribution to contraction",
    phase: "distribution",
    whatAllocatorsDid:  "Duration was reduced, high-growth valuations were cut, and cash yields became competitive for the first time in 15 years.",
    earlyOutcome:  "Early exit from growth at 2021 peak avoided 60-80% drawdowns in unprofitable tech.",
    lateOutcome:   "Held growth into Q1 2022: full rate-compression drawdown experienced.",
    correctOutcome:"Barbell (short duration + quality cash-generative equities) outperformed by 15-20% over 2022.",
  },
  {
    id:  "2016_saudi_rebalance",
    era: "2016",
    label: "Saudi Vision 2030 — capital reorientation",
    phase: "transition",
    whatAllocatorsDid:  "GCC sovereign allocators began rotating from oil-linked assets to diversified Vision 2030 sectors and global equities.",
    earlyOutcome:  "Early Vision 2030 positioning benefited from the 2017-2019 Vision 2030 premium in Tadawul.",
    lateOutcome:   "Stayed oil-linked into Vision 2030 transformation: underperformed domestic and EM allocation benchmarks.",
    correctOutcome:"Diversified early: petrochemicals + tourism + SABIC-adjacent positions captured the structural shift.",
  },
];

// ─── Phase derivation ─────────────────────────────────────────────────────────

function derivePhase(i: CycleInput): CapitalCyclePhase {
  if (i.creditStress === "extreme") return "deep_contraction";
  if (i.creditStress === "high" && i.macroBias === "bearish") return "early_contraction";
  if (i.creditStress === "high") return "distribution";
  if (i.consensusStrength === "conflicted" || /transition|mixed/.test(i.regime)) return "transition";
  if (i.macroBias === "bearish" && i.creditStress === "moderate") return "distribution";
  if (i.macroBias === "neutral" && i.regimeConf < 50) return "transition";
  if (i.macroBias === "bullish" && i.creditStress === "low" && i.consensusStrength === "strong") {
    return i.regimeConf > 70 ? "mid_expansion" : "early_expansion";
  }
  if (i.macroBias === "bullish" && i.creditStress === "moderate") return "late_expansion";
  if (i.macroBias === "bullish") return "mid_expansion";
  return "transition";
}

// ─── Episode matching ─────────────────────────────────────────────────────────

function matchEpisode(phase: CapitalCyclePhase, isSaudi: boolean): CapitalCycleEpisode | null {
  if (isSaudi && (phase === "transition" || phase === "mid_expansion")) {
    const saudi = EPISODES.find(e => e.id === "2016_saudi_rebalance");
    if (saudi) return saudi;
  }
  const byPhase = EPISODES.filter(e => e.phase === phase);
  if (byPhase.length === 0) return null;
  return byPhase[byPhase.length - 1];  // most recent matching episode
}

// ─── Analog confidence ────────────────────────────────────────────────────────

function deriveAnalogConfidence(
  phase: CapitalCyclePhase,
  regimeConf: number,
  consensusStrength: string,
): AnalogConfidence {
  if (phase === "transition") return "low";
  if (consensusStrength === "conflicted") return "low";
  if (regimeConf < 40) return "low";
  if (regimeConf >= 70 && consensusStrength === "strong") return "high";
  if (regimeConf >= 55) return "moderate";
  return "low";
}

// ─── What differs now ─────────────────────────────────────────────────────────

function buildWhatDiffers(i: CycleInput, episode: CapitalCycleEpisode | null): string {
  if (!episode) return "No close analog — current conditions do not map cleanly to historical capital cycles.";
  const oilNote = i.isSaudi && i.oilPrice !== null
    ? ` Oil at $${i.oilPrice} is a GCC-specific variable not present in that episode.`
    : "";
  if (episode.id === "2009_early_cycle") {
    return `Today's credit stress started with inflation/rate dynamics, not a banking seizure — the recovery slope may be shallower.${oilNote}`;
  }
  if (episode.id === "2022_tightening_cycle") {
    return `AI-driven tech rerating adds a structural layer absent in prior tightening cycles — duration risk and growth premium coexist differently.${oilNote}`;
  }
  if (episode.id === "2020_trough") {
    return `Current conditions lack the government fiscal velocity of 2020 — the policy backstop is smaller and slower.${oilNote}`;
  }
  if (episode.id === "2016_saudi_rebalance") {
    return `Vision 2030 is now in execution phase (not announcement) — the transformation premium is partially priced versus 2016 announcement premium.`;
  }
  return `Structural differences (monetary policy toolkit, AI disruption, geopolitical fragmentation) mean the analog is illustrative, not prescriptive.${oilNote}`;
}

// ─── Allocation lesson ────────────────────────────────────────────────────────

function buildAllocationLesson(phase: CapitalCyclePhase): string {
  switch (phase) {
    case "early_expansion":
      return "Early-cycle entry is uncomfortable but historically earns the largest premium; patient deployers outperform.";
    case "mid_expansion":
      return "Mid-cycle rewards selectivity over breadth — consensus long positions compress alpha; quality factor dominates.";
    case "late_expansion":
      return "Late-cycle demands defensive anchors and reduced leverage — the exit before crowding is more valuable than the final 10% of gains.";
    case "distribution":
      return "Distribution-phase lesson: institutions exit ahead of retail; the last 20% of a bull market is the most crowded and dangerous.";
    case "early_contraction":
      return "Early contraction: reduce beta quickly — the market underestimates how fast credit tightening transmits to earnings.";
    case "deep_contraction":
      return "Deep contraction creates trough opportunities — systematic deployment in tranches at forced-sell prices earns the recovery premium.";
    case "transition":
      return "Transition phases reward patience and optionality — committing capital before regime confirmation is historically costly.";
  }
}

// ─── Phase labels ─────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<CapitalCyclePhase, string> = {
  early_expansion:  "early expansion — credit loosening; allocators deploying selectively",
  mid_expansion:    "mid expansion — peak momentum; flows abundant; selectivity needed",
  late_expansion:   "late expansion — stretched valuations; reduce beta; build optionality",
  distribution:     "distribution — smart money exits; crowding risk; patient positioning",
  early_contraction:"early contraction — credit tightening; earnings risk; reduce beta",
  deep_contraction: "deep contraction — stress peak; forced selling; trough approaching",
  transition:       "transition — regime unclear; cycle phase contested; preserve optionality",
};

const CONFIDENCE_LABELS: Record<AnalogConfidence, string> = {
  high:       "high analog confidence",
  moderate:   "moderate analog confidence",
  low:        "low analog confidence — treat as illustrative only",
  negligible: "negligible analog confidence — do not anchor reasoning on this episode",
};

// ─── Main export ──────────────────────────────────────────────────────────────

export function buildCapitalCycleAnalysis(input: CycleInput): CapitalCycleResult {
  const phase      = derivePhase(input);
  const episode    = matchEpisode(phase, input.isSaudi);
  const confidence = deriveAnalogConfidence(phase, input.regimeConf, input.consensusStrength);
  const whatDiffers    = buildWhatDiffers(input, episode);
  const allocationLesson = buildAllocationLesson(phase);

  const isAr = input.lang === "ar";

  const episodeLine = episode
    ? `Historical episode: ${episode.era} — ${episode.label}. ${episode.whatAllocatorsDid.slice(0, 80)}`
    : "No dominant historical episode matches current capital cycle conditions.";

  const capitalCycleContext = isAr
    ? [
        `دورة رأس المال التاريخية [${PHASE_LABELS[phase]}]:`,
        episode ? `الحلقة: ${episode.era} — ماذا فعل المخصصون: ${episode.whatAllocatorsDid.slice(0, 80)}` : "لا توجد حلقة مطابقة.",
        `ما يختلف الآن: ${whatDiffers.slice(0, 100)}`,
        `الدرس: ${allocationLesson.slice(0, 100)}`,
        `الثقة في القياس التاريخي: ${CONFIDENCE_LABELS[confidence]}`,
        `التاريخ سياق لا تنبؤ — كل القياسات مشروطة.`,
      ].join(" | ").slice(0, 380)
    : [
        `Capital cycle analysis [${PHASE_LABELS[phase]}]:`,
        `${episodeLine.slice(0, 100)}`,
        `What differs now: ${whatDiffers.slice(0, 100)}`,
        `Lesson: ${allocationLesson.slice(0, 100)}`,
        `Confidence: ${CONFIDENCE_LABELS[confidence]}. History is context not prediction — all analogies conditional.`,
      ].join(" | ").slice(0, 380);

  return {
    currentPhase:        phase,
    dominantEpisode:     episode,
    analogConfidence:    confidence,
    whatDiffersNow:      whatDiffers,
    allocationLesson,
    capitalCycleContext,
  };
}
