// Trading Journal — manual and auto entries, persisted locally
import { useSyncExternalStore } from "react";

export type JournalEntry = {
  id: string;
  asset: string;
  type: "ai_decision" | "simulation" | "manual";
  side: "buy" | "sell" | "hold" | "stop_loss" | "take_profit";
  entry?: number;
  exit?: number;
  pnlPct?: number;
  reasonIn?: string;
  reasonOut?: string;
  notes?: string;
  createdAt: number;
};

const KEY = "foresmart_journal_v1";

function seed(): JournalEntry[] {
  const now = Date.now();
  return [
    { id: "j1", asset: "BTC", type: "ai_decision", side: "buy", entry: 62800, exit: 64800, pnlPct: 3.18, reasonIn: "كسر مقاومة + زخم إيجابي", reasonOut: "وصول للهدف الأول", createdAt: now - 86400000 * 3 },
    { id: "j2", asset: "2222.SR", type: "manual", side: "buy", entry: 26.10, exit: 28.40, pnlPct: 8.81, reasonIn: "تجميع طويل المدى", reasonOut: "إعادة توازن المحفظة", createdAt: now - 86400000 * 7 },
    { id: "j3", asset: "TSLA", type: "simulation", side: "sell", entry: 268, exit: 248, pnlPct: -7.46, reasonIn: "اختبار قرار AI", reasonOut: "وقف خسارة", notes: "محاكاة Paper فقط", createdAt: now - 86400000 * 5 },
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
  entries = [entry, ...entries].slice(0, 500);
  emit();
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
  const header = "id,asset,type,side,entry,exit,pnlPct,reasonIn,reasonOut,notes,createdAt";
  const esc = (v: any) => v == null ? "" : `"${String(v).replace(/"/g, '""')}"`;
  const body = rows.map((r) => [
    r.id, r.asset, r.type, r.side, r.entry ?? "", r.exit ?? "", r.pnlPct ?? "",
    r.reasonIn ?? "", r.reasonOut ?? "", r.notes ?? "", new Date(r.createdAt).toISOString(),
  ].map(esc).join(",")).join("\n");
  return `${header}\n${body}`;
}
