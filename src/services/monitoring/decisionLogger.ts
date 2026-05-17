// AI Decision Logger — explainable AI: stores reasoning context per decision.
export interface DecisionContext {
  sentiment?: string;
  volatility?: number;
  momentum?: number;
  regime?: string;
  riskState?: string;
  focusAsset?: string;
}
export interface DecisionEntry {
  id: string;
  ts: number;
  asset?: string;
  action: string;          // open, close, reduce, skip, pause, tighten-stop
  confidence: number;      // 0-100
  reasoning: string;
  context: DecisionContext;
  factors: { label: string; weight: number; tone: "+" | "-" | "=" }[];
}

const KEY = "fs.aiDecisions.v1";
const MAX = 150;
let LOG: DecisionEntry[] = load();

function load(): DecisionEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
function save() {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(LOG.slice(0, MAX))); } catch { /* quota */ }
}

export function logDecision(d: Omit<DecisionEntry, "id" | "ts">): DecisionEntry {
  const e: DecisionEntry = { id: `DEC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ts: Date.now(), ...d };
  LOG.unshift(e);
  if (LOG.length > MAX) LOG.length = MAX;
  save();
  return e;
}

export function getDecisionLog(limit = 30): DecisionEntry[] { return LOG.slice(0, limit); }

export function summarizeReasoning(asset?: string): { bullish: number; bearish: number; neutral: number; avgConf: number } {
  const slice = asset ? LOG.filter((d) => d.asset === asset) : LOG;
  let bull = 0, bear = 0, neu = 0, sum = 0;
  slice.forEach((d) => {
    if (d.action === "open") bull++;
    else if (d.action === "close" || d.action === "reduce") bear++;
    else neu++;
    sum += d.confidence;
  });
  return { bullish: bull, bearish: bear, neutral: neu, avgConf: slice.length ? Math.round(sum / slice.length) : 0 };
}
