// Auto Trading Simulation — ForeSmart
// Paper-trading only. Generates simulated orders from AI decisions.
// No real broker connection. All orders status: "simulated".
// Future integration: replace `createOrder` with broker API call.

import { useSyncExternalStore } from "react";
import type { TradingDecision } from "./marketIntelligence";

export type AutoTradeStatus = "simulated" | "pending_review" | "rejected";

export type AutoTradeOrder = {
  id: string;
  asset: string;
  category: string;
  action: TradingDecision["action"];
  price: number;
  amount: number;        // in currency units (e.g. SAR)
  quantity: number;      // amount / price
  confidence: number;
  reason: string;
  createdAt: number;
  status: AutoTradeStatus;
};

export type AutoTradingSettings = {
  enabled: boolean;
  allowedAssets: string[];        // empty = all
  maxAmountPerTrade: number;      // SAR per order
  dailyLossLimit: number;         // SAR; stop trading if exceeded
  minConfidence: number;          // 0..100
  mode: "auto_execute" | "require_approval";
  allowMockSimulation: boolean;   // allow BUY orders on mock data
  riskRules: {
    maxLossPerTradePct: number;
    maxPositionPct: number;
    haltOnDailyLossPct: number;
  };
};

export type DecisionLogEntry = {
  id: string;
  asset: string;
  action: TradingDecision["action"];
  confidence: number;
  riskLevel: TradingDecision["riskLevel"];
  source: "live" | "mock";
  createdAt: number;
  orderCreated: boolean;
  rejectReason?: string;
};

const STORAGE_KEY = "foresmart_autotrade_v2";

const DEFAULTS: AutoTradingSettings = {
  enabled: false,
  allowedAssets: [],
  maxAmountPerTrade: 500,
  dailyLossLimit: 1000,
  minConfidence: 70,
  mode: "require_approval",
  allowMockSimulation: false,
  riskRules: {
    maxLossPerTradePct: 2,
    maxPositionPct: 10,
    haltOnDailyLossPct: 5,
  },
};

type State = {
  settings: AutoTradingSettings;
  orders: AutoTradeOrder[];
  dailyLoss: number;
  haltedAt: number | null;
};

function load(): State {
  if (typeof window === "undefined") {
    return { settings: DEFAULTS, orders: [], dailyLoss: 0, haltedAt: null };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { settings: DEFAULTS, orders: [], dailyLoss: 0, haltedAt: null };
    const parsed = JSON.parse(raw);
    return {
      settings: { ...DEFAULTS, ...parsed.settings, riskRules: { ...DEFAULTS.riskRules, ...(parsed.settings?.riskRules ?? {}) } },
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      dailyLoss: parsed.dailyLoss ?? 0,
      haltedAt: parsed.haltedAt ?? null,
    };
  } catch {
    return { settings: DEFAULTS, orders: [], dailyLoss: 0, haltedAt: null };
  }
}

let state: State = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}
function emit() { persist(); listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }

export function getAutoTradingState(): State { return state; }

export function updateSettings(patch: Partial<AutoTradingSettings>) {
  state = { ...state, settings: { ...state.settings, ...patch, riskRules: { ...state.settings.riskRules, ...(patch.riskRules ?? {}) } } };
  emit();
}

export function setEnabled(enabled: boolean) {
  state = { ...state, settings: { ...state.settings, enabled }, haltedAt: enabled ? null : state.haltedAt };
  emit();
}

export function emergencyStop() {
  state = { ...state, settings: { ...state.settings, enabled: false }, haltedAt: Date.now() };
  emit();
}

export function clearLog() {
  state = { ...state, orders: [] };
  emit();
}

export type CreateOrderResult =
  | { ok: true; order: AutoTradeOrder }
  | { ok: false; reason: string };

export function tryCreateOrderFromDecision(
  decision: TradingDecision,
  dataIsMock = true,
): CreateOrderResult {
  const s = state.settings;
  if (!s.enabled) return { ok: false, reason: "auto_trading_disabled" };
  if (decision.action === "HOLD") return { ok: false, reason: "hold_no_order" };
  if (decision.riskLevel === "HIGH" && decision.confidence < 85) {
    return { ok: false, reason: "risk_too_high" };
  }
  if (decision.confidence < s.minConfidence) {
    return { ok: false, reason: "below_min_confidence" };
  }
  if (s.allowedAssets.length > 0 && !s.allowedAssets.includes(decision.asset)) {
    return { ok: false, reason: "asset_not_allowed" };
  }
  if (state.dailyLoss >= s.dailyLossLimit) {
    return { ok: false, reason: "daily_loss_limit_reached" };
  }

  const amount = Math.min(s.maxAmountPerTrade, s.maxAmountPerTrade * (decision.suggestedPositionSize / 10));
  const order: AutoTradeOrder = {
    id: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    asset: decision.asset,
    category: decision.category,
    action: decision.action,
    price: decision.indicators ? Number((decision.suggestedStopLoss + decision.suggestedTakeProfit) / 2) : 0,
    amount: Number(amount.toFixed(2)),
    quantity: 0,
    confidence: decision.confidence,
    reason: decision.reasonSummary + (dataIsMock ? " (بيانات تجريبية)" : ""),
    createdAt: Date.now(),
    status: s.mode === "auto_execute" ? "simulated" : "pending_review",
  };
  order.quantity = order.price > 0 ? Number((order.amount / order.price).toFixed(6)) : 0;
  state = { ...state, orders: [order, ...state.orders].slice(0, 200) };
  emit();
  return { ok: true, order };
}

export function setOrderStatus(id: string, status: AutoTradeStatus) {
  state = { ...state, orders: state.orders.map((o) => (o.id === id ? { ...o, status } : o)) };
  emit();
}

// React hook
export function useAutoTrading() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
