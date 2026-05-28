/** Genesis conversation history — localStorage ring buffer (max 50 entries). */
const KEY = "foresmart.genesis.history.v1";
const DIGEST_KEY = "foresmart.genesis.digest.v1";
const MAX = 100;
const DECAY_HALF_LIFE_DAYS = 3; // weight halves every 3 days

export interface GenesisHistoryEntry {
  ts: number;
  question: string;
  headline: string;
  confidence: number;
  engineUsed: "ai" | "heuristic";
  actionType: string | null;
}

export interface WeeklyDigest {
  weekStart: string;   // ISO date of Monday e.g. "2026-05-18"
  count: number;
  avgConf: number;
  aiRatio: number;
  topAction: string | null;
}

function read(): GenesisHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as GenesisHistoryEntry[]; } catch { return []; }
}

function persist(entries: GenesisHistoryEntry[]) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX))); } catch {}
}

function readDigests(): WeeklyDigest[] {
  if (typeof localStorage === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(DIGEST_KEY) ?? "[]") as WeeklyDigest[]; } catch { return []; }
}

function persistDigests(digests: WeeklyDigest[]) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(DIGEST_KEY, JSON.stringify(digests.slice(-12))); } catch {}
}

/** Exponential age-decay weight. Half-life = DECAY_HALF_LIFE_DAYS. */
function ageWeight(ts: number): number {
  const ageDays = (Date.now() - ts) / 86400000;
  return Math.exp((-ageDays * Math.LN2) / DECAY_HALF_LIFE_DAYS);
}

/** ISO date string of the Monday starting the entry's week. */
function weekStartDate(ts: number): string {
  const d = new Date(ts);
  const day = d.getDay() || 7; // 1=Mon … 7=Sun
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export const genesisMemory = {
  list(): GenesisHistoryEntry[] { return read(); },

  append(entry: GenesisHistoryEntry): void {
    const entries = read();
    entries.push(entry);
    persist(entries);
  },

  clear(): void { persist([]); },

  /** Clears both the ring buffer and the weekly digest store. */
  clearAll(): void {
    persist([]);
    if (typeof localStorage !== "undefined") {
      try { localStorage.removeItem(DIGEST_KEY); } catch {}
    }
  },

  // ─── Raw summary (unweighted) ─────────────────────────────────────────────

  summary(): { total: number; avgConfidence: number; aiRatio: number } {
    const entries = read();
    if (!entries.length) return { total: 0, avgConfidence: 0, aiRatio: 0 };
    const avg = entries.reduce((s, e) => s + e.confidence, 0) / entries.length;
    const aiCount = entries.filter((e) => e.engineUsed === "ai").length;
    return {
      total: entries.length,
      avgConfidence: Math.round(avg),
      aiRatio: Math.round((aiCount / entries.length) * 100),
    };
  },

  // ─── Memory weighting — age-decay weighted summary ────────────────────────

  /** Age-weighted summary — recent entries contribute more (half-life 3 days). */
  weightedSummary(): { total: number; avgConfidence: number; aiRatio: number } {
    const entries = read();
    if (!entries.length) return { total: 0, avgConfidence: 0, aiRatio: 0 };
    let wSum = 0, wConf = 0, wAi = 0;
    for (const e of entries) {
      const w = ageWeight(e.ts);
      wSum += w;
      wConf += e.confidence * w;
      if (e.engineUsed === "ai") wAi += w;
    }
    return {
      total: entries.length,
      avgConfidence: wSum > 0 ? Math.round(wConf / wSum) : 0,
      aiRatio: wSum > 0 ? Math.round((wAi / wSum) * 100) : 0,
    };
  },

  // ─── Context aging — recent exchanges annotated with age label ────────────

  /** Last `n` entries formatted with age labels for AI context injection. */
  agedContext(n: number): string {
    const entries = read().slice(-n);
    if (!entries.length) return "";
    const now = Date.now();
    const parts = entries.map((e) => {
      const ageDays = (now - e.ts) / 86400000;
      const age = ageDays < 1 ? "today" : ageDays < 2 ? "yesterday" : `${Math.floor(ageDays)}d ago`;
      return `[${age}][${e.engineUsed.toUpperCase()}] "${e.question.slice(0, 45)}" → "${e.headline.slice(0, 45)}" (${e.confidence}%)`;
    });
    return `Aged context (${entries.length}): ` + parts.join(" | ");
  },

  // ─── Weekly digest compression ────────────────────────────────────────────

  /**
   * Groups entries older than `cutoffDays` into per-week digest records,
   * persists the digests, and removes the compressed entries from the ring buffer.
   */
  compressOldEntries(cutoffDays = 7): void {
    const cutoff = Date.now() - cutoffDays * 86400000;
    const all = read();
    const old = all.filter((e) => e.ts < cutoff);
    const fresh = all.filter((e) => e.ts >= cutoff);
    if (!old.length) return;

    const byWeek = new Map<string, GenesisHistoryEntry[]>();
    for (const e of old) {
      const wk = weekStartDate(e.ts);
      if (!byWeek.has(wk)) byWeek.set(wk, []);
      byWeek.get(wk)!.push(e);
    }

    const existing = readDigests();
    const seen = new Set(existing.map((d) => d.weekStart));

    for (const [wk, weekEntries] of byWeek.entries()) {
      if (seen.has(wk)) continue;
      const avgConf = Math.round(weekEntries.reduce((s, e) => s + e.confidence, 0) / weekEntries.length);
      const aiCount = weekEntries.filter((e) => e.engineUsed === "ai").length;
      const actionMap = new Map<string, number>();
      for (const e of weekEntries) {
        if (e.actionType) actionMap.set(e.actionType, (actionMap.get(e.actionType) ?? 0) + 1);
      }
      const topAction = actionMap.size > 0
        ? [...actionMap.entries()].sort((a, b) => b[1] - a[1])[0]![0]
        : null;
      existing.push({ weekStart: wk, count: weekEntries.length, avgConf, aiRatio: Math.round((aiCount / weekEntries.length) * 100), topAction });
    }

    persistDigests(existing);
    persist(fresh);
  },

  /** Compact weekly digest string for AI context injection (last 4 weeks). */
  weeklyDigestContext(): string {
    const digests = readDigests().slice(-4);
    if (!digests.length) return "";
    return "Weekly digest: " + digests
      .map((d) => `w/${d.weekStart}: ${d.count}x, ${d.avgConf}% conf${d.topAction ? `, top:${d.topAction}` : ""}`)
      .join(" | ");
  },

  /** Number of weekly digest records persisted. */
  weeklyDigestCount(): number {
    return readDigests().length;
  },
};
