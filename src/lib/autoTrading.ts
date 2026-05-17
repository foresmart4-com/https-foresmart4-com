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

export type TradingMode = "conservative" | "balanced" | "aggressive";

export type AutoTradingSettings = {
  enabled: boolean;
  allowedAssets: string[];        // empty = all
  maxAmountPerTrade: number;      // SAR per order
  dailyLossLimit: number;         // SAR; stop trading if exceeded
  minConfidence: number;          // 0..100
  mode: "auto_execute" | "require_approval";
  tradingMode: TradingMode;
  allowMockSimulation: boolean;
  riskRules: {
    maxLossPerTradePct: number;
    maxPositionPct: number;
    haltOnDailyLossPct: number;
  };
};

export const TRADING_MODE_PRESETS: Record<TradingMode, { minConfidence: number; maxRisk: "LOW" | "MEDIUM" | "HIGH"; maxPositionPct: number }> = {
  conservative: { minConfidence: 85, maxRisk: "LOW",    maxPositionPct: 5 },
  balanced:     { minConfidence: 75, maxRisk: "MEDIUM", maxPositionPct: 10 },
  aggressive:   { minConfidence: 65, maxRisk: "MEDIUM", maxPositionPct: 15 },
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

const STORAGE_KEY = "foresmart_autotrade_v3";

const DEFAULTS: AutoTradingSettings = {
  enabled: false,
  allowedAssets: [],
  maxAmountPerTrade: 500,
  dailyLossLimit: 1000,
  minConfidence: 75,
  mode: "require_approval",
  tradingMode: "balanced",
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
  decisionLog: DecisionLogEntry[];
  dailyLoss: number;
  haltedAt: number | null;
};

function load(): State {
  const empty: State = { settings: DEFAULTS, orders: [], decisionLog: [], dailyLoss: 0, haltedAt: null };
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return {
      settings: { ...DEFAULTS, ...parsed.settings, riskRules: { ...DEFAULTS.riskRules, ...(parsed.settings?.riskRules ?? {}) } },
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      decisionLog: Array.isArray(parsed.decisionLog) ? parsed.decisionLog : [],
      dailyLoss: parsed.dailyLoss ?? 0,
      haltedAt: parsed.haltedAt ?? null,
    };
  } catch {
    return empty;
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

export function clearDecisionLog() {
  state = { ...state, decisionLog: [] };
  emit();
}

export type CreateOrderResult =
  | { ok: true; order: AutoTradeOrder }
  | { ok: false; reason: string };

export const REJECT_REASONS_AR: Record<string, string> = {
  auto_trading_disabled: "التداول الآلي معطل",
  hold_no_order: "القرار: انتظار — لا أمر",
  risk_too_high: "المخاطر عالية والثقة غير كافية",
  below_min_confidence: "الثقة أقل من الحد المطلوب",
  asset_not_allowed: "الأصل غير مسموح",
  daily_loss_limit_reached: "تم بلوغ حد الخسارة اليومي",
  mock_data_buy_blocked: "BUY ممنوع على بيانات تجريبية (فعّل السماح بالمحاكاة)",
};

function logDecision(
  decision: TradingDecision,
  dataSource: "live" | "mock",
  orderCreated: boolean,
  rejectReason?: string,
) {
  const entry: DecisionLogEntry = {
    id: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    asset: decision.asset,
    action: decision.action,
    confidence: decision.confidence,
    riskLevel: decision.riskLevel,
    source: dataSource,
    createdAt: Date.now(),
    orderCreated,
    rejectReason,
  };
  state = { ...state, decisionLog: [entry, ...state.decisionLog].slice(0, 300) };
  emit();
}

export function tryCreateOrderFromDecision(
  decision: TradingDecision,
  dataIsMock = true,
): CreateOrderResult {
  const s = state.settings;
  const source: "live" | "mock" = dataIsMock ? "mock" : "live";

  // STOP_LOSS has highest priority — always create (paper).
  if (decision.action === "STOP_LOSS") {
    const order = buildOrder(decision, dataIsMock, s.mode);
    state = { ...state, orders: [order, ...state.orders].slice(0, 200) };
    emit();
    logDecision(decision, source, true);
    return { ok: true, order };
  }

  const reject = (reason: string): CreateOrderResult => {
    logDecision(decision, source, false, reason);
    return { ok: false, reason };
  };

  if (!s.enabled) return reject("auto_trading_disabled");
  if (decision.action === "HOLD") return reject("hold_no_order");
  if (decision.riskLevel === "HIGH") return reject("risk_too_high");
  if (decision.confidence < s.minConfidence) return reject("below_min_confidence");
  if (dataIsMock && decision.action === "BUY" && !s.allowMockSimulation) {
    return reject("mock_data_buy_blocked");
  }
  if (s.allowedAssets.length > 0 && !s.allowedAssets.includes(decision.asset)) {
    return reject("asset_not_allowed");
  }
  if (state.dailyLoss >= s.dailyLossLimit) return reject("daily_loss_limit_reached");

  const order = buildOrder(decision, dataIsMock, s.mode);
  state = { ...state, orders: [order, ...state.orders].slice(0, 200) };
  emit();
  logDecision(decision, source, true);
  return { ok: true, order };
}

function buildOrder(decision: TradingDecision, dataIsMock: boolean, mode: AutoTradingSettings["mode"]): AutoTradeOrder {
  const amount = Math.min(500, 500 * (decision.suggestedPositionSize / 10));
  const price = Number(((decision.suggestedStopLoss + decision.suggestedTakeProfit) / 2).toFixed(4));
  return {
    id: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    asset: decision.asset,
    category: decision.category,
    action: decision.action,
    price,
    amount: Number(amount.toFixed(2)),
    quantity: price > 0 ? Number((amount / price).toFixed(6)) : 0,
    confidence: decision.confidence,
    reason: decision.reasonSummary + (dataIsMock ? " (بيانات تجريبية)" : ""),
    createdAt: Date.now(),
    status: mode === "auto_execute" ? "simulated" : "pending_review",
  };
}

export function setOrderStatus(id: string, status: AutoTradeStatus) {
  state = { ...state, orders: state.orders.map((o) => (o.id === id ? { ...o, status } : o)) };
  emit();
}

// React hook
export function useAutoTrading() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
