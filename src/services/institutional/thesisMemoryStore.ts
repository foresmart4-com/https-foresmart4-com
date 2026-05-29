// Phase-84A: Thesis Memory Store
// Pure deterministic functions — no AI calls, no network.
// Process-level in-memory singleton (module-scope Map).
//
// Persistence: survives within server process lifetime (hours between deploys).
// No Supabase schema modifications — safe local/project-level store.
// No PII, no secrets, no broker execution, no personal financial advice storage.
//
// Purpose: Store thesis snapshots for each question-type category so that
// subsequent questions of the same type can receive "Prior thesis:" context
// that the existing system prompt rule 16 (THESIS EVOLUTION) already handles.
// Also feeds the outcomeLearningEngine for confirmation/contradiction analysis.

import type { GenesisReply } from "@/lib/genesis.functions";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThesisQuestionCategory =
  | "saudi_allocator"       // conservative allocator, Saudi market
  | "saudi_sectors"         // Saudi sector winners/losers
  | "us_market"             // US equity market outlook
  | "oil_macro"             // oil + macro linkage
  | "rate_cycle"            // rate cycle / Fed policy impact
  | "sector_rotation"       // sector rotation / regime
  | "valuation_earnings"    // PE expansion vs EPS growth
  | "global_macro"          // global macro outlook
  | "unknown";

export interface ThesisSnapshot {
  id: string;
  category: ThesisQuestionCategory;
  question: string;           // original question (truncated to 200 chars)
  timestamp: number;          // Date.now()
  thesis?: string;
  macroChain?: string;
  baseCase?: string;
  bullCase?: string;
  bearCase?: string;
  sectorLens?: string;
  thesisChanger?: string;
  invalidation?: string;
  missingEvidence?: string;
  committeeStance?: string;
  confidence?: number;
  isSaudi: boolean;
  lang: "ar" | "en";
  stale: boolean;
}

// ─── Store constants ──────────────────────────────────────────────────────────

const MAX_SNAPSHOTS_PER_CATEGORY = 3;  // keep 3 most recent per category
const STALE_REGIME_MS = 45 * 60 * 1000; // 45 min: regime-sensitive data
const STALE_SECTOR_MS = 60 * 60 * 1000; // 60 min: sector analysis

// ─── Category detection ───────────────────────────────────────────────────────

const CATEGORY_PATTERNS: Record<ThesisQuestionCategory, RegExp> = {
  saudi_allocator:   /saudi|tasi|aramco|سعودي|تاسي|أرامكو|ksa/i,
  saudi_sectors:     /saudi.{0,20}sector|قطاع.{0,20}سعود|تاسي.{0,20}قطاع/i,
  us_market:         /\b(us|s&p|nasdaq|dow|american)\b.{0,20}(market|stock|equity)/i,
  oil_macro:         /oil.{0,20}(macro|market|fed)|نفط.{0,20}(كلي|سوق)/i,
  rate_cycle:        /rate\s+(cycle|cut|hike|policy)|دورة\s+الأسعار/i,
  sector_rotation:   /sector\s+rotation|دوران\s+القطاعات/i,
  valuation_earnings:/valuation.{0,20}earning|PE.{0,20}EPS|مضاعف.{0,20}ربح/i,
  global_macro:      /global\s+macro|الكلي\s+العالمي/i,
  unknown:           /.*/,
};

export function detectThesisCategory(question: string): ThesisQuestionCategory {
  const q = question.toLowerCase();
  for (const [cat, pattern] of Object.entries(CATEGORY_PATTERNS) as [ThesisQuestionCategory, RegExp][]) {
    if (cat !== "unknown" && pattern.test(q)) return cat;
  }
  return "unknown";
}

// ─── Process-level in-memory store ───────────────────────────────────────────

const _thesisStore = new Map<ThesisQuestionCategory, ThesisSnapshot[]>();
let _snapshotCounter = 0;

// ─── Staleness ────────────────────────────────────────────────────────────────

function isStale(snapshot: ThesisSnapshot): boolean {
  if (snapshot.stale) return true;
  const age = Date.now() - snapshot.timestamp;
  const limit = snapshot.isSaudi ? STALE_REGIME_MS : STALE_SECTOR_MS;
  return age > limit;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Saves a thesis snapshot derived from a GenesisReply.
 * Caps per-category store at MAX_SNAPSHOTS_PER_CATEGORY.
 */
export function saveThesisSnapshot(
  reply: GenesisReply,
  question: string,
  isSaudi: boolean,
  lang: "ar" | "en",
): ThesisSnapshot {
  const category = detectThesisCategory(question);
  const snapshot: ThesisSnapshot = {
    id: `thesis_${++_snapshotCounter}_${Date.now()}`,
    category,
    question: question.slice(0, 200),
    timestamp: Date.now(),
    thesis: reply.thesis,
    macroChain: reply.macroChain,
    baseCase: reply.baseCase,
    bullCase: reply.bullCase,
    bearCase: reply.bearCase,
    sectorLens: reply.sectorLens,
    thesisChanger: reply.thesisChanger,
    invalidation: reply.invalidation,
    missingEvidence: reply.missingEvidence,
    committeeStance: reply.committeeStance,
    confidence: reply.confidence,
    isSaudi,
    lang,
    stale: false,
  };

  const existing = _thesisStore.get(category) ?? [];
  // Add new snapshot and keep only MAX most recent
  const updated = [snapshot, ...existing.slice(0, MAX_SNAPSHOTS_PER_CATEGORY - 1)];
  _thesisStore.set(category, updated);

  return snapshot;
}

/**
 * Retrieves the most recent non-stale thesis snapshot for a question category.
 * Returns null if no relevant non-stale snapshot exists.
 */
export function retrievePriorThesis(
  question: string,
  isSaudi: boolean,
): ThesisSnapshot | null {
  const category = detectThesisCategory(question);
  const snapshots = _thesisStore.get(category) ?? [];
  const fresh = snapshots.filter(s => !isStale(s));
  if (fresh.length === 0) return null;
  // Prefer Saudi-matching snapshots for Saudi questions
  if (isSaudi) {
    const saudiMatch = fresh.find(s => s.isSaudi);
    return saudiMatch ?? fresh[0];
  }
  return fresh[0];
}

/**
 * Builds a compact "Prior thesis:" context block for injection into the prompt.
 * The existing system prompt rule 16 (THESIS EVOLUTION) already handles this format.
 */
export function buildPriorThesisContext(snapshot: ThesisSnapshot, lang: "ar" | "en"): string {
  const ar = lang === "ar";
  const ageMinutes = Math.round((Date.now() - snapshot.timestamp) / 60000);
  const ageLine = ar
    ? `أطروحة سابقة (منذ ~${ageMinutes} دقيقة):`
    : `Prior thesis (~${ageMinutes}m ago):`;

  const parts = [ageLine];
  if (snapshot.thesis) parts.push(ar ? `الأطروحة: ${snapshot.thesis}` : `Thesis: ${snapshot.thesis}`);
  if (snapshot.baseCase) parts.push(ar ? `الحالة الأساسية: ${snapshot.baseCase}` : `Base case: ${snapshot.baseCase}`);
  if (snapshot.committeeStance) parts.push(ar ? `موقف اللجنة: ${snapshot.committeeStance}` : `Committee stance: ${snapshot.committeeStance}`);
  if (snapshot.thesisChanger) parts.push(ar ? `محفز التغيير: ${snapshot.thesisChanger}` : `Thesis changer: ${snapshot.thesisChanger}`);

  const rule = ar
    ? "قاعدة: إذا أكّدت الأطروحة الحالية الاتجاه السابق، اذكر الأدلة الجديدة المحددة. إذا تغيّرت، اذكر العامل الدقيق الذي يُبرر المراجعة. لا تُعد الأطروحة السابقة حرفياً."
    : "Rule: if current thesis confirms prior direction, state the specific new evidence. If revised, name the precise factor warranting the change. Do NOT copy prior thesis verbatim.";

  parts.push(rule);
  return parts.join("\n");
}

/**
 * Marks all snapshots for a category as stale (e.g., after a regime shift signal).
 */
export function markCategoryStale(category: ThesisQuestionCategory): void {
  const snapshots = _thesisStore.get(category) ?? [];
  snapshots.forEach(s => { s.stale = true; });
}

/** Returns a stats summary for logging (no sensitive data). */
export function getThesisStoreStats(): string {
  let total = 0;
  const cats: string[] = [];
  for (const [cat, snaps] of _thesisStore.entries()) {
    const fresh = snaps.filter(s => !isStale(s)).length;
    if (fresh > 0) { cats.push(`${cat}:${fresh}`); total += fresh; }
  }
  return `total=${total} categories=[${cats.join(",")}]`;
}
