/** Genesis thesis memory — localStorage ring buffer (max 50 entries).
 * Stores investment theses produced by Genesis AI for context continuity
 * and thesis tracking. Client-side only — never sent to server as PII.
 */
const KEY = "foresmart.genesis.theses.v1";
const MAX = 50;

export interface ThesisEntry {
  id: string;
  ts: number;
  asset: string;               // ticker or topic keyword e.g. "BTC", "MARKET"
  direction: "bullish" | "bearish" | "neutral";
  thesis: string;              // one-sentence investment thesis
  confidence: number;          // 0-100 at the time of generation
  uncertainty: string | null;  // uncertainty note if low confidence
  invalidation: string | null; // condition that would invalidate the thesis
  catalyst: string | null;     // primary near-term catalyst to watch
  regimeAtSave?: string;       // market regime label when thesis was generated
  outcome?: "correct" | "incorrect" | "mixed" | "pending"; // user-resolved outcome
  resolvedAt?: number;         // timestamp when outcome was recorded
}

export interface ThesisOutcomeStats {
  total: number;
  resolved: number;
  accuracy: number;            // 0-100: % of resolved theses that were "correct"
  breakdown: Partial<Record<NonNullable<ThesisEntry["outcome"]>, number>>;
}

function read(): ThesisEntry[] {
  if (typeof localStorage === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as ThesisEntry[]; } catch { return []; }
}

function persist(entries: ThesisEntry[]) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX))); } catch {}
}

export const thesisMemory = {
  save(entry: ThesisEntry): void {
    const entries = read();
    // Deduplicate: if same asset updated within 30 min, replace rather than append.
    const idx = entries.findIndex((e) => e.asset === entry.asset && entry.ts - e.ts < 30 * 60_000);
    if (idx >= 0) { entries[idx] = entry; persist(entries); return; }
    entries.push(entry);
    persist(entries);
  },

  getRecent(n: number): ThesisEntry[] {
    return read().slice(-n);
  },

  all(): ThesisEntry[] {
    return read();
  },

  clear(): void { persist([]); },

  /** Mark a thesis outcome. Idempotent — re-resolving updates the record. */
  resolveThesis(id: string, outcome: NonNullable<ThesisEntry["outcome"]>): void {
    const entries = read();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx < 0) return;
    entries[idx] = { ...entries[idx], outcome, resolvedAt: Date.now() };
    persist(entries);
  },

  /** Aggregate outcome accuracy across all resolved theses. */
  outcomeStats(): ThesisOutcomeStats {
    const entries = read();
    const resolved = entries.filter((e) => e.outcome && e.outcome !== "pending");
    const correct = resolved.filter((e) => e.outcome === "correct").length;
    const breakdown: ThesisOutcomeStats["breakdown"] = {};
    for (const e of resolved) {
      if (e.outcome) breakdown[e.outcome] = (breakdown[e.outcome] ?? 0) + 1;
    }
    return {
      total: entries.length,
      resolved: resolved.length,
      accuracy: resolved.length > 0 ? Math.round((correct / resolved.length) * 100) : 0,
      breakdown,
    };
  },

  /**
   * Age-weighted compact context for AI injection.
   * Sorts by recency (2-day half-life) so fresh theses rank first.
   * Includes age labels so the AI can judge how stale a prior view is.
   * Optional assetHint boosts same-asset entries to the top.
   */
  compressedContext(n: number, assetHint?: string): string {
    const all = read();
    if (!all.length) return "";
    const now = Date.now();
    // Score: recency weight × asset-match boost
    const scored = all.map((t) => {
      const ageDays = (now - t.ts) / 86400000;
      const recency = Math.exp((-ageDays * Math.LN2) / 2); // half-life 2 days
      const assetBoost = assetHint && t.asset.toUpperCase() === assetHint.toUpperCase() ? 2 : 1;
      return { ...t, _score: recency * assetBoost };
    });
    const top = [...scored].sort((a, b) => b._score - a._score).slice(0, n);
    if (!top.length) return "";
    const parts = top.map((t) => {
      const ageDays = (now - t.ts) / 86400000;
      const age = ageDays < 0.5 ? "today" : ageDays < 1.5 ? "yesterday" : `${Math.round(ageDays)}d ago`;
      const outcomeStr = t.outcome ? ` [${t.outcome}]` : "";
      return `${t.asset} ${t.direction} ${t.confidence}%${outcomeStr} (${age}): "${t.thesis.slice(0, 50)}"`;
    });
    return `Prior theses (${top.length}): ` + parts.join(" | ");
  },

  /**
   * Rich thesis evolution context for AI injection.
   * Classifies the continuity relationship and provides explicit evolution rules.
   * When assetHint is provided, prioritises same-asset prior theses.
   * Includes calibration note when ≥3 theses have been resolved.
   */
  buildEvolutionContext(n: number, assetHint?: string): string {
    const all = read();
    if (!all.length) return "";
    const now = Date.now();
    const parts: string[] = [];

    // Find the most relevant prior thesis: same asset first, then most recent
    const assetKey = assetHint?.toUpperCase();
    const sameAsset = assetKey ? all.filter(t => t.asset.toUpperCase() === assetKey).sort((a, b) => b.ts - a.ts) : [];
    const primary = sameAsset[0] ?? [...all].sort((a, b) => b.ts - a.ts)[0];

    if (primary) {
      const ageDays = (now - primary.ts) / 86400000;
      const age = ageDays < 0.5 ? "today" : ageDays < 1.5 ? "yesterday" : `${Math.round(ageDays)}d ago`;
      const outcomeNote = primary.outcome && primary.outcome !== "pending" ? ` [resolved: ${primary.outcome}]` : "";
      const assetMatch = assetKey && primary.asset.toUpperCase() === assetKey;

      parts.push(
        `Prior thesis${assetMatch ? ` for ${primary.asset}` : ""} (${age}, ${primary.direction} at ${primary.confidence}%${outcomeNote}): ` +
        `"${primary.thesis.slice(0, 80)}"` +
        (primary.invalidation ? `\nPrior invalidation trigger: "${primary.invalidation.slice(0, 80)}"` : ""),
      );

      parts.push(
        `THESIS EVOLUTION RULE: ` +
        `If your new thesis CONFIRMS this direction: state the specific new evidence that validates continuation — do not restate the prior view verbatim. ` +
        `If your thesis REVISES or CONTRADICTS it: set viewChange to name exactly what macro or technical development justifies the change. ` +
        `If the prior invalidation trigger above appears active or closer in current data: surface it as a caveat, not as a certainty.`,
      );
    }

    // Calibration note from resolved outcome history
    const stats = this.outcomeStats();
    if (stats.resolved >= 3) {
      const adj =
        stats.accuracy < 30 ? "reduce confidence anchor by up to 8 pts — prior accuracy significantly below chance" :
        stats.accuracy < 46 ? "reduce confidence anchor by 4 pts — prior accuracy below chance" :
        stats.accuracy > 70 ? "confidence anchor may be up to 5 pts higher — prior accuracy above average" :
        stats.accuracy > 54 ? "confidence anchor may be up to 3 pts higher — prior accuracy above chance" :
        "no confidence adjustment — prior accuracy near chance level";
      parts.push(`Calibration memory: ${stats.accuracy}% accuracy (${stats.resolved} resolved theses) — ${adj}.`);
    }

    // Other recent theses for different assets (background context)
    const others = all
      .filter(t => !assetKey || t.asset.toUpperCase() !== assetKey)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, Math.max(0, n - 1));
    if (others.length > 0) {
      const otherStr = others.map(t => {
        const ageDays = (now - t.ts) / 86400000;
        const age = ageDays < 0.5 ? "today" : ageDays < 1.5 ? "yesterday" : `${Math.round(ageDays)}d ago`;
        return `${t.asset} ${t.direction} ${t.confidence}% (${age})`;
      }).join(", ");
      parts.push(`Recent views on other assets: ${otherStr}`);
    }

    return parts.join("\n");
  },
};
