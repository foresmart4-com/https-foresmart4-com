// Smart Watchlist store — client-side localStorage
import { useSyncExternalStore } from "react";

export type WatchlistAsset = {
  symbol: string;
  name?: string;
  category: "saudi" | "us" | "crypto" | "commodities" | "fx" | "other";
  price: number;
  change24h: number;
  currency?: string;
  addedAt: number;
};

export type WatchAlert = {
  id: string;
  symbol: string;
  kind: "buy_high_conf" | "stop_loss" | "big_move" | "high_risk";
  message: string;
  createdAt: number;
};

type State = { items: WatchlistAsset[]; alerts: WatchAlert[] };
const KEY = "foresmart_watchlist_v1";

function load(): State {
  if (typeof window === "undefined") return { items: [], alerts: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { items: defaultSeed(), alerts: [] };
    const p = JSON.parse(raw);
    return { items: p.items ?? [], alerts: p.alerts ?? [] };
  } catch { return { items: [], alerts: [] }; }
}

function defaultSeed(): WatchlistAsset[] {
  const now = Date.now();
  return [
    { symbol: "BTC", name: "Bitcoin", category: "crypto", price: 64800, change24h: -0.74, currency: "USD", addedAt: now },
    { symbol: "2222.SR", name: "أرامكو السعودية", category: "saudi", price: 28.40, change24h: 1.42, currency: "SAR", addedAt: now },
    { symbol: "XAU", name: "الذهب", category: "commodities", price: 2418, change24h: 0.94, currency: "USD", addedAt: now },
  ];
}

let state: State = load();
const listeners = new Set<() => void>();
function emit() {
  if (typeof window !== "undefined") {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }
  listeners.forEach((l) => l());
}

export function addToWatchlist(a: Omit<WatchlistAsset, "addedAt">) {
  if (state.items.some((x) => x.symbol === a.symbol)) return false;
  state = { ...state, items: [{ ...a, addedAt: Date.now() }, ...state.items].slice(0, 60) };
  emit();
  return true;
}
export function removeFromWatchlist(symbol: string) {
  state = { ...state, items: state.items.filter((x) => x.symbol !== symbol) };
  emit();
}
export function updateWatchlistPrice(symbol: string, price: number, change24h: number) {
  state = {
    ...state,
    items: state.items.map((x) => (x.symbol === symbol ? { ...x, price, change24h } : x)),
  };
  emit();
}
export function pushAlert(a: Omit<WatchAlert, "id" | "createdAt">) {
  const entry: WatchAlert = { ...a, id: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: Date.now() };
  state = { ...state, alerts: [entry, ...state.alerts].slice(0, 100) };
  emit();
  return entry;
}
export function clearAlerts() { state = { ...state, alerts: [] }; emit(); }

export function useWatchlist() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
    () => state,
  );
}
