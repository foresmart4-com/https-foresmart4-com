/**
 * Research Engine — Phase 8
 * Detects institutional research intent and comparison type from the user question.
 * Pure function — no network calls, no side effects, no fake data.
 *
 * Returns:
 *  - isResearch: whether the question warrants a full research report
 *  - type: asset | comparison | sector | thesis | market
 *  - primaryTopic: the main subject (ticker, pair label, or "market")
 *  - comparisonPair: [A, B] when the question compares two assets/sectors
 *  - compactHint: ≤180-char context string injected into the AI system prompt
 */
import type { WatchlistAsset } from "@/lib/watchlistStore";
import type { ThesisEntry } from "@/services/learning/thesisMemory";

export type ResearchType = "asset" | "comparison" | "sector" | "thesis" | "market";

export interface ResearchIntent {
  isResearch: boolean;
  type: ResearchType;
  primaryTopic: string;
  comparisonPair: [string, string] | null;
  compactHint: string;
}

const RESEARCH_KW_EN = [
  "analyze", "analyse", "analysis", "research", "deep dive", "deep-dive",
  "study", "investigate", "report", "breakdown", "in-depth", "fundamental",
  "detailed analysis", "deep analysis", "institutional", "full report",
];
const RESEARCH_KW_AR = [
  "حلل", "تحليل", "بحث", "دراسة", "تقرير", "تفصيلي",
  "مفصل", "معمق", "أساسي", "تقرير كامل",
];
const COMPARISON_KW = [
  " vs ", " versus ", " compared to ", " against ",
  " مقابل ", " مقارنة بين ",
];
const SECTOR_KW = ["sector", "industry", "segment", "tech stocks", "energy stocks", "قطاع", "صناعة"];
const THESIS_KW = ["thesis", "my view", "my position", "conviction", "أطروحة", "موقفي", "قناعة"];

const COMMON_TICKERS = [
  "BTC", "ETH", "GOLD", "XAU", "SPX", "SPY", "QQQ",
  "AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "META",
  "OIL", "WTI", "BRENT", "USD", "EUR", "GBP", "JPY",
  "ARAMCO", "2222", "SABIC", "STC",
];

function extractTicker(q: string, watchlistItems: WatchlistAsset[]): string {
  const upper = q.toUpperCase();
  for (const item of watchlistItems) {
    if (upper.includes(item.symbol)) return item.symbol;
  }
  for (const t of COMMON_TICKERS) {
    if (upper.includes(t)) return t;
  }
  return "";
}

function extractComparisonPair(q: string, watchlistItems: WatchlistAsset[]): [string, string] | null {
  for (const kw of COMPARISON_KW) {
    const lower = q.toLowerCase();
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx === -1) continue;
    const leftWords = q.slice(0, idx).trim().split(/\s+/);
    const rightWords = q.slice(idx + kw.length).trim().split(/\s+/);
    const left = (leftWords[leftWords.length - 1] ?? "")
      .replace(/[^A-Za-z0-9؀-ۿ]/g, "")
      .toUpperCase()
      .slice(0, 12);
    const right = (rightWords[0] ?? "")
      .replace(/[^A-Za-z0-9؀-ۿ]/g, "")
      .toUpperCase()
      .slice(0, 12);
    // Reject common English stopwords that cannot be asset identifiers
    const STOPWORDS = new Set(["THE", "A", "AN", "OF", "TO", "AND", "OR", "IN", "AT", "FOR", "BY", "ON", "AS", "IT", "IS", "MY"]);
    if (left && right && left !== right && !STOPWORDS.has(left) && !STOPWORDS.has(right)) {
      // Normalize well-known aliases
      const norm = (s: string) => {
        if (s === "XAU") return "GOLD";
        if (s === "SP500") return "SPX";
        return s;
      };
      return [norm(left), norm(right)];
    }
  }
  // Try watchlist-aware extraction: "Compare BTC and ETH"
  const watchSymbols = watchlistItems.map((w) => w.symbol.toUpperCase());
  const allSymbols = [...new Set([...watchSymbols, ...COMMON_TICKERS])];
  const upper = q.toUpperCase();
  const found = allSymbols.filter((s) => upper.includes(s));
  if (found.length >= 2) {
    const positions = found.map((s) => ({ s, idx: upper.indexOf(s) })).sort((a, b) => a.idx - b.idx);
    return [positions[0].s, positions[1].s];
  }
  return null;
}

export function detectResearchIntent(
  question: string,
  watchlistItems: WatchlistAsset[],
  _theses: ThesisEntry[],
): ResearchIntent {
  const q = question.toLowerCase();

  const hasResearchKw =
    RESEARCH_KW_EN.some((kw) => q.includes(kw)) ||
    RESEARCH_KW_AR.some((kw) => q.includes(kw));

  const hasComparisonKw = COMPARISON_KW.some((kw) => q.includes(kw.toLowerCase()));
  const comparisonPair = hasComparisonKw ? extractComparisonPair(question, watchlistItems) : null;

  const isSector = SECTOR_KW.some((kw) => q.includes(kw));
  const isThesis = THESIS_KW.some((kw) => q.includes(kw));

  const isResearch = hasResearchKw || (hasComparisonKw && comparisonPair !== null);

  let type: ResearchType = "market";
  if (comparisonPair) type = "comparison";
  else if (isSector) type = "sector";
  else if (isThesis) type = "thesis";
  else {
    const ticker = extractTicker(question, watchlistItems);
    if (ticker) type = "asset";
  }

  const primaryTopic = comparisonPair
    ? `${comparisonPair[0]} vs ${comparisonPair[1]}`
    : extractTicker(question, watchlistItems) || "market";

  const compactHint = isResearch
    ? `Research mode (${type}): produce full institutional research report. Populate executiveSummary (2-3 sentences), keyDrivers (3-5 items), watchItems (2-4 items). Set researchType="${type}".${comparisonPair ? ` Comparison ${comparisonPair[0]} vs ${comparisonPair[1]}: populate comparisonTable (3-5 metric rows, a="${comparisonPair[0]}", b="${comparisonPair[1]}").` : ""}`
    : "";

  return { isResearch, type, primaryTopic, comparisonPair, compactHint };
}
