// Trading Journal — unified event log for the whole app.
// Backward-compatible: legacy entries continue to work.
import { useSyncExternalStore } from "react";

export type JournalSource =
  | "ai" | "auto_trading" | "watchlist" | "portfolio"
  | "deposit" | "withdrawal" | "backtest" | "system" | "admin";

export type JournalStatus =
  | "simulation" | "manual_review" | "ai" | "portfolio" | "admin"
  | "completed" | "rejected" | "review" | "info";

export type JournalEntry = {
  id: string;
  asset: string;            // "" for non-asset events (system/admin)
  type: "ai_decision" | "simulation" | "manual" | "deposit" | "withdrawal" | "system" | "admin" | "backtest";
  side: "buy" | "sell" | "hold" | "stop_loss" | "take_profit" | "info";
  entry?: number;
  exit?: number;
  amount?: number;
  pnlPct?: number;
  confidence?: number;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
  reasonIn?: string;
  reasonOut?: string;
  notes?: string;
  source?: JournalSource;
  status?: JournalStatus;
  eventKind?: string;       // free-form: "emergency_stop" | "mode_change" | etc.
  refId?: string;           // e.g. DEP-2026-0001
  createdAt: number;
};

const KEY = "foresmart_journal_v2";

function seed(): JournalEntry[] {
  const now = Date.now();
  return [
    { id: "j1", asset: "BTC", type: "ai_decision", side: "buy", entry: 62800, exit: 64800, pnlPct: 3.18, reasonIn: "كسر مقاومة + زخم إيجابي", reasonOut: "وصول للهدف الأول", createdAt: now - 86400000 * 3, source: "ai", status: "ai", confidence: 78, riskLevel: "MEDIUM" },
    { id: "j2", asset: "2222.SR", type: "manual", side: "buy", entry: 26.10, exit: 28.40, pnlPct: 8.81, reasonIn: "تجميع طويل المدى", reasonOut: "إعادة توازن المحفظة", createdAt: now - 86400000 * 7, source: "portfolio", status: "portfolio" },
    { id: "j3", asset: "TSLA", type: "simulation", side: "sell", entry: 268, exit: 248, pnlPct: -7.46, reasonIn: "اختبار قرار AI", reasonOut: "وقف خسارة", notes: "محاكاة Paper فقط", createdAt: now - 86400000 * 5, source: "auto_trading", status: "simulation", confidence: 72, riskLevel: "MEDIUM" },
  ];
}

function load(): JournalEntry[] {
  if (typeof window === "undefined") return seed();
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : seed(); }
  catch { return seed(); }
}

let entries: JournalEntry[] = load();
const listeners = new Set<() => void>();
function emit() {
  if (typeof window !== "undefined") { try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch {} }
  listeners.forEach((l) => l());
}

export function addJournalEntry(e: Omit<JournalEntry, "id" | "createdAt"> & { id?: string; createdAt?: number }) {
  const entry: JournalEntry = {
    ...e,
    id: e.id ?? `j_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: e.createdAt ?? Date.now(),
  };
  entries = [entry, ...entries].slice(0, 1000);
  emit();
  return entry;
}

/** Lightweight helper for system/event logging across the app. */
export function logEvent(opts: {
  source: JournalSource;
  eventKind: string;
  asset?: string;
  status?: JournalStatus;
  notes?: string;
  amount?: number;
  refId?: string;
  confidence?: number;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
  side?: JournalEntry["side"];
}) {
  return addJournalEntry({
    asset: opts.asset ?? "",
    type: opts.source === "deposit" ? "deposit"
      : opts.source === "withdrawal" ? "withdrawal"
      : opts.source === "admin" ? "admin"
      : opts.source === "auto_trading" ? "simulation"
      : opts.source === "ai" || opts.source === "watchlist" ? "ai_decision"
      : opts.source === "backtest" ? "backtest"
      : "system",
    side: opts.side ?? "info",
    status: opts.status ?? "info",
    source: opts.source,
    eventKind: opts.eventKind,
    notes: opts.notes,
    amount: opts.amount,
    refId: opts.refId,
    confidence: opts.confidence,
    riskLevel: opts.riskLevel,
  });
}

export function deleteJournalEntry(id: string) {
  entries = entries.filter((e) => e.id !== id);
  emit();
}
export function clearJournal() { entries = []; emit(); }

export function useJournal() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => entries,
    () => entries,
  );
}

export function journalToCSV(rows: JournalEntry[]): string {
  const header = "id,date,source,type,eventKind,status,asset,side,entry,exit,amount,pnlPct,confidence,riskLevel,refId,reasonIn,reasonOut,notes";
  const esc = (v: any) => v == null ? "" : `"${String(v).replace(/"/g, '""')}"`;
  const body = rows.map((r) => [
    r.id, new Date(r.createdAt).toISOString(), r.source ?? "", r.type, r.eventKind ?? "",
    r.status ?? "", r.asset, r.side, r.entry ?? "", r.exit ?? "", r.amount ?? "",
    r.pnlPct ?? "", r.confidence ?? "", r.riskLevel ?? "", r.refId ?? "",
    r.reasonIn ?? "", r.reasonOut ?? "", r.notes ?? "",
  ].map(esc).join(",")).join("\n");
  return `${header}\n${body}`;
}
