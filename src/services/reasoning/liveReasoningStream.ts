// Live AI Reasoning Stream — derives institutional observations from the live
// quote feed without making any extra AI calls. Used by the dashboard to
// surface a continuously updating "what the brain is noticing" panel.
import type { MarketQuote } from "@/services/market/marketData";

export type ReasoningSeverity = "info" | "watch" | "alert" | "critical";
export type ReasoningCategory =
  | "regime" | "momentum" | "breakout" | "exhaustion"
  | "divergence" | "liquidity" | "macro" | "conviction";

export interface ReasoningEvent {
  id: string;
  ts: number;
  category: ReasoningCategory;
  severity: ReasoningSeverity;
  symbol?: string;
  /** Native-language headline (already localized — never translated downstream). */
  headlineEn: string;
  headlineAr: string;
  /** Optional metric (change%, conviction%, etc.) displayed verbatim. */
  metric?: string;
}

// ---- deterministic per-quote derivations ------------------------------------

function momentumDirection(q: MarketQuote): "up" | "down" | "flat" {
  if (q.momentum > 35 && q.changePct >= 0) return "up";
  if (q.momentum < -35 && q.changePct < 0) return "down";
  return "flat";
}

function classifyConviction(q: MarketQuote): number {
  const align = q.changePct >= 0 ? q.momentum : -q.momentum;
  const norm = (align + 100) / 200;
  const volPenalty = Math.min(q.volatility, 80) / 200;
  return Math.max(0, Math.min(1, norm - volPenalty));
}

// Cheap pseudo-RSI from a 24-point history.
function pseudoRsi(history: number[]): number {
  if (!history || history.length < 3) return 50;
  let gain = 0, loss = 0;
  for (let i = 1; i < history.length; i++) {
    const d = history[i] - history[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  if (gain + loss === 0) return 50;
  const rs = gain / Math.max(loss, 1e-9);
  return 100 - 100 / (1 + rs);
}

// ---- main builder -----------------------------------------------------------

/** Build a fresh reasoning batch from the current quote snapshot. */
export function buildReasoningEvents(quotes: MarketQuote[]): ReasoningEvent[] {
  const now = Date.now();
  const out: ReasoningEvent[] = [];

  if (!quotes.length) return out;

  // Per-symbol observations
  for (const q of quotes) {
    const dir = momentumDirection(q);
    const rsi = pseudoRsi(q.history);
    const conv = classifyConviction(q);

    // Strong momentum
    if (dir !== "flat" && Math.abs(q.changePct) >= 1.5) {
      out.push({
        id: `mom-${q.key}-${now}`,
        ts: now,
        category: "momentum",
        severity: Math.abs(q.changePct) >= 3 ? "alert" : "watch",
        symbol: q.key,
        headlineEn: dir === "up"
          ? `${q.key} extending upside — momentum confirms move`
          : `${q.key} extending downside — momentum confirms move`,
        headlineAr: dir === "up"
          ? `${q.key} يوسّع المكاسب — الزخم يؤكد الحركة`
          : `${q.key} يوسّع الخسائر — الزخم يؤكد الحركة`,
        metric: `${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%`,
      });
    }

    // Exhaustion / overextension
    if (rsi >= 78) {
      out.push({
        id: `exh-up-${q.key}-${now}`,
        ts: now,
        category: "exhaustion",
        severity: "watch",
        symbol: q.key,
        headlineEn: `${q.key} approaching overbought — elevated mean-reversion risk`,
        headlineAr: `${q.key} يقترب من منطقة التشبع الشرائي — احتمال مرتفع للارتداد`,
        metric: `RSI ${rsi.toFixed(0)}`,
      });
    } else if (rsi <= 22) {
      out.push({
        id: `exh-dn-${q.key}-${now}`,
        ts: now,
        category: "exhaustion",
        severity: "watch",
        symbol: q.key,
        headlineEn: `${q.key} approaching oversold — bounce probability elevated`,
        headlineAr: `${q.key} يقترب من منطقة التشبع البيعي — احتمال مرتفع للارتداد التصاعدي`,
        metric: `RSI ${rsi.toFixed(0)}`,
      });
    }

    // Bullish/bearish divergence: price up but momentum down (or vice-versa)
    if (q.changePct >= 0.5 && q.momentum < -20) {
      out.push({
        id: `div-bear-${q.key}-${now}`,
        ts: now,
        category: "divergence",
        severity: "alert",
        symbol: q.key,
        headlineEn: `${q.key} bearish divergence — price rising while momentum fades`,
        headlineAr: `${q.key} تباين هبوطي — السعر يصعد بينما الزخم يتراجع`,
        metric: `Δmom ${q.momentum.toFixed(0)}`,
      });
    } else if (q.changePct <= -0.5 && q.momentum > 20) {
      out.push({
        id: `div-bull-${q.key}-${now}`,
        ts: now,
        category: "divergence",
        severity: "alert",
        symbol: q.key,
        headlineEn: `${q.key} bullish divergence — price falling while momentum builds`,
        headlineAr: `${q.key} تباين صاعد — السعر يهبط بينما الزخم يتحسّن`,
        metric: `Δmom +${q.momentum.toFixed(0)}`,
      });
    }

    // Breakout vs recent history
    const hi = Math.max(...q.history);
    const lo = Math.min(...q.history);
    if (q.price >= hi * 0.999 && q.changePct > 0.3) {
      out.push({
        id: `brk-up-${q.key}-${now}`,
        ts: now,
        category: "breakout",
        severity: "alert",
        symbol: q.key,
        headlineEn: `${q.key} breaking above 24-bar range high`,
        headlineAr: `${q.key} يخترق أعلى مدى آخر 24 شمعة`,
        metric: `${q.price >= 1000 ? q.price.toFixed(0) : q.price.toFixed(2)}`,
      });
    } else if (q.price <= lo * 1.001 && q.changePct < -0.3) {
      out.push({
        id: `brk-dn-${q.key}-${now}`,
        ts: now,
        category: "breakout",
        severity: "alert",
        symbol: q.key,
        headlineEn: `${q.key} breaking below 24-bar range low`,
        headlineAr: `${q.key} يكسر أدنى مدى آخر 24 شمعة`,
        metric: `${q.price >= 1000 ? q.price.toFixed(0) : q.price.toFixed(2)}`,
      });
    }

    // High-conviction setups
    if (conv >= 0.75 && Math.abs(q.changePct) >= 0.6) {
      out.push({
        id: `conv-${q.key}-${now}`,
        ts: now,
        category: "conviction",
        severity: "info",
        symbol: q.key,
        headlineEn: `${q.key} high-conviction ${q.changePct >= 0 ? "long" : "short"} setup forming`,
        headlineAr: `${q.key} إعداد ${q.changePct >= 0 ? "شراء" : "بيع مكشوف"} عالي القناعة قيد التكوّن`,
        metric: `conv ${Math.round(conv * 100)}%`,
      });
    }

    // Liquidity / vol stress
    if (q.volatility >= 55) {
      out.push({
        id: `liq-${q.key}-${now}`,
        ts: now,
        category: "liquidity",
        severity: q.volatility >= 75 ? "critical" : "watch",
        symbol: q.key,
        headlineEn: `${q.key} volatility regime expanded — tighten position sizing`,
        headlineAr: `${q.key} اتساع نظام التقلب — يُنصح بتشديد حجم المركز`,
        metric: `vol ${q.volatility.toFixed(0)}`,
      });
    }
  }

  // Cross-asset / macro observations
  const ups = quotes.filter((q) => q.changePct >= 0).length;
  const breadth = ups - (quotes.length - ups);
  if (Math.abs(breadth) >= Math.max(3, quotes.length - 1)) {
    out.push({
      id: `regime-${now}`,
      ts: now,
      category: "regime",
      severity: "info",
      headlineEn: breadth > 0
        ? `Broad risk-on tape — most tracked assets advancing in sync`
        : `Broad risk-off tape — most tracked assets declining in sync`,
      headlineAr: breadth > 0
        ? `إقبال واسع على المخاطرة — معظم الأصول المتتبَّعة ترتفع بتزامن`
        : `تجنّب واسع للمخاطرة — معظم الأصول المتتبَّعة تتراجع بتزامن`,
      metric: `breadth ${breadth > 0 ? "+" : ""}${breadth}`,
    });
  }

  // Macro: USD vs Gold inverse signal
  const dxy = quotes.find((q) => q.key === "DXY");
  const xau = quotes.find((q) => q.key === "XAU");
  if (dxy && xau && Math.abs(dxy.changePct) >= 0.3 && Math.abs(xau.changePct) >= 0.4) {
    const inverse = dxy.changePct * xau.changePct < 0;
    if (inverse) {
      out.push({
        id: `macro-dxy-xau-${now}`,
        ts: now,
        category: "macro",
        severity: "info",
        headlineEn: `DXY vs Gold inverse correlation holding — classic risk hedge active`,
        headlineAr: `الارتباط العكسي بين مؤشر الدولار والذهب قائم — تحوّط كلاسيكي للمخاطر`,
        metric: `DXY ${dxy.changePct.toFixed(2)}% / XAU ${xau.changePct.toFixed(2)}%`,
      });
    }
  }

  return out;
}

/** Merge new events into a buffer, dedup by symbol+category in a small window. */
export function mergeReasoningBuffer(
  prev: ReasoningEvent[],
  next: ReasoningEvent[],
  maxItems = 80,
  dedupWindowMs = 45_000,
): ReasoningEvent[] {
  const seen = new Map<string, number>();
  for (const p of prev) {
    seen.set(`${p.symbol ?? "*"}|${p.category}|${p.headlineEn}`, p.ts);
  }
  const fresh = next.filter((e) => {
    const k = `${e.symbol ?? "*"}|${e.category}|${e.headlineEn}`;
    const last = seen.get(k);
    if (last && e.ts - last < dedupWindowMs) return false;
    seen.set(k, e.ts);
    return true;
  });
  return [...fresh, ...prev].slice(0, maxItems);
}
