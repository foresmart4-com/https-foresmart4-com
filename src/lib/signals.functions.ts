import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getMarketData, calcRSI, calcSMA } from "./market-data";

export interface TradeSignal {
  id?: string;
  symbol: string;
  asset_name: string;
  category: string | null;
  action: "buy" | "sell" | "hold" | "watch";
  horizon: "short" | "medium" | "long";
  confidence: number;
  technical_score: number;
  sentiment_score: number;
  entry_price: number;
  stop_loss: number;
  targets: number[];
  rationale: string;
  indicators: Record<string, number | null>;
  generated_at?: string;
  expires_at?: string;
}

// === Technical analysis helpers ===
function calcEMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
  return ema;
}

function calcMACD(prices: number[]): { macd: number | null; signal: number | null; hist: number | null } {
  if (prices.length < 26) return { macd: null, signal: null, hist: null };
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);
  if (ema12 === null || ema26 === null) return { macd: null, signal: null, hist: null };
  const macd = ema12 - ema26;
  // approximate signal as EMA9 of last MACD values; rough but useful
  const macdSeries: number[] = [];
  for (let i = 26; i <= prices.length; i++) {
    const a = calcEMA(prices.slice(0, i), 12);
    const b = calcEMA(prices.slice(0, i), 26);
    if (a !== null && b !== null) macdSeries.push(a - b);
  }
  const signal = calcEMA(macdSeries, Math.min(9, macdSeries.length)) ?? macd;
  return { macd, signal, hist: macd - signal };
}

function calcBollinger(prices: number[], period = 20, mult = 2): { upper: number; lower: number; mid: number } | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((s, p) => s + (p - mid) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return { upper: mid + mult * sd, lower: mid - mult * sd, mid };
}

interface Scored {
  score: number; // -100..100 (negative = bearish, positive = bullish)
  reasons: string[];
  indicators: Record<string, number | null>;
}

function technicalScore(prices: number[]): Scored {
  const reasons: string[] = [];
  let score = 0;
  let count = 0;
  const last = prices[prices.length - 1];

  const rsi = calcRSI(prices, 14);
  if (rsi !== null) {
    if (rsi < 30) { score += 60; reasons.push(`RSI ${rsi.toFixed(0)} (تشبع بيع)`); }
    else if (rsi > 70) { score -= 60; reasons.push(`RSI ${rsi.toFixed(0)} (تشبع شراء)`); }
    else if (rsi < 45) { score += 20; reasons.push(`RSI ${rsi.toFixed(0)} (ضعف نسبي)`); }
    else if (rsi > 55) { score -= 20; reasons.push(`RSI ${rsi.toFixed(0)} (قوة نسبية)`); }
    count++;
  }

  const sma20 = calcSMA(prices, 20);
  const sma50 = calcSMA(prices, 50);
  if (sma20 !== null) {
    const pct = ((last - sma20) / sma20) * 100;
    if (pct > 2) { score += 25; reasons.push(`فوق MA20 (+${pct.toFixed(1)}%)`); }
    else if (pct < -2) { score -= 25; reasons.push(`تحت MA20 (${pct.toFixed(1)}%)`); }
    count++;
  }
  if (sma20 !== null && sma50 !== null) {
    if (sma20 > sma50) { score += 30; reasons.push("MA20 يقطع MA50 صاعداً"); }
    else { score -= 30; reasons.push("MA20 تحت MA50"); }
    count++;
  }

  const macd = calcMACD(prices);
  if (macd.macd !== null && macd.signal !== null) {
    if (macd.macd > macd.signal) { score += 20; reasons.push("MACD صاعد"); }
    else { score -= 20; reasons.push("MACD هابط"); }
    count++;
  }

  const bb = calcBollinger(prices);
  if (bb) {
    if (last < bb.lower) { score += 30; reasons.push("اختراق نطاق بولينجر السفلي"); }
    else if (last > bb.upper) { score -= 30; reasons.push("اختراق نطاق بولينجر العلوي"); }
    count++;
  }

  // Momentum (last 7 vs prior 7)
  if (prices.length >= 14) {
    const recent = prices.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const prior = prices.slice(-14, -7).reduce((a, b) => a + b, 0) / 7;
    const mom = ((recent - prior) / prior) * 100;
    if (mom > 1) { score += 15; reasons.push(`زخم +${mom.toFixed(1)}%`); }
    else if (mom < -1) { score -= 15; reasons.push(`زخم ${mom.toFixed(1)}%`); }
    count++;
  }

  // Normalize
  const normalized = count > 0 ? Math.max(-100, Math.min(100, score / count * 1.2)) : 0;
  return {
    score: normalized,
    reasons,
    indicators: {
      rsi: rsi,
      sma20,
      sma50,
      macd: macd.macd,
      macd_signal: macd.signal,
      bb_upper: bb?.upper ?? null,
      bb_lower: bb?.lower ?? null,
    },
  };
}

async function aiSentimentBatch(
  apiKey: string,
  assets: { symbol: string; name: string; changePct: number }[],
): Promise<Record<string, { sentiment: number; note: string }>> {
  const list = assets.map((a) => `${a.symbol} (${a.name}, 24h: ${a.changePct.toFixed(2)}%)`).join("\n");
  const prompt = `أنت محلل أسواق كمي. قيّم معنويات السوق الحالية لكل أصل في القائمة بناءً على:
- الاقتصاد الكلي: سياسة الفيدرالي وساما، التضخم، DXY، أسعار النفط، نمو الناتج المحلي.
- الجيوسياسة: التوترات الإقليمية، العقوبات، قرارات أوبك+.
- زخم الأسعار: يعكس التغير الـ24 ساعة الموضح في القائمة.
- معنويات الأموال الكبرى: تدفقات ETF، مراكز COT، نسب الشراء/البيع.

لكل أصل أعطِ:
- symbol: رمز الأصل كما هو في القائمة (لا تغيّره).
- sentiment: عدد صحيح من -100 (بيع ذعر) إلى +100 (شراء قوي)، حيث 0 = محايد تماماً. كن صريحاً — تجنب الحياد الزائف والتجمّع حول الصفر.
- note: المحفز الرئيسي الذي يدفع المعنويات الآن (جملة عربية مختصرة واضحة).

الأصول:
${list}

أعد JSON فقط بهذه الصيغة الصارمة (بدون markdown أو نص إضافي):
{ "RESULTS": [ { "symbol": "...", "sentiment": <عدد صحيح -100..100>, "note": "..." } ] }`;

  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "أنت محلل أسواق مالية. أعد JSON صحيحاً فقط بدون markdown." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) return {};
    const d = await r.json();
    const raw: string = d.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    const arr: { symbol: string; sentiment: number; note: string }[] = parsed.RESULTS ?? parsed.results ?? [];
    const map: Record<string, { sentiment: number; note: string }> = {};
    for (const it of arr) {
      if (it?.symbol) map[it.symbol] = { sentiment: Number(it.sentiment) || 0, note: String(it.note ?? "") };
    }
    return map;
  } catch (e) {
    console.error("AI sentiment failed", e);
    return {};
  }
}

function buildSignal(
  asset: { symbol: string; name: string; category: string; price: number; changePct: number; history: { t: number; p: number }[] },
  tech: Scored,
  sentiment: { sentiment: number; note: string } | undefined,
): TradeSignal {
  const senScore = sentiment?.sentiment ?? 0;
  // Weighted fusion: 65% technical, 35% sentiment
  const fused = tech.score * 0.65 + senScore * 0.35;

  let action: TradeSignal["action"] = "hold";
  if (fused > 35) action = "buy";
  else if (fused < -35) action = "sell";
  else if (Math.abs(fused) > 15) action = "watch";

  // Horizon by indicator strength
  const horizon: TradeSignal["horizon"] =
    Math.abs(tech.score) > 60 ? "short" : Math.abs(fused) > 25 ? "medium" : "long";

  // ATR-like volatility from history
  const prices = asset.history.map((h) => h.p);
  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const range = high - low;
  const atr = range / Math.max(prices.length, 1) * 4;

  const entry = asset.price;
  const stop = action === "buy" ? entry - atr : action === "sell" ? entry + atr : entry - atr * 0.5;
  const t1 = action === "buy" ? entry + atr * 1.5 : action === "sell" ? entry - atr * 1.5 : entry + atr;
  const t2 = action === "buy" ? entry + atr * 3 : action === "sell" ? entry - atr * 3 : entry + atr * 2;

  const reasons = [...tech.reasons];
  if (sentiment?.note) reasons.push(`المعنويات: ${sentiment.note}`);

  return {
    symbol: asset.symbol,
    asset_name: asset.name,
    category: asset.category,
    action,
    horizon,
    confidence: Math.round(Math.min(100, Math.abs(fused) + 20)),
    technical_score: Math.round(tech.score),
    sentiment_score: Math.round(senScore),
    entry_price: Number(entry.toFixed(4)),
    stop_loss: Number(stop.toFixed(4)),
    targets: [Number(t1.toFixed(4)), Number(t2.toFixed(4))],
    rationale: reasons.slice(0, 5).join(" • "),
    indicators: tech.indicators,
  };
}

export const generateSignals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const apiKey = process.env.LOVABLE_API_KEY;
    const market = await getMarketData();
    // Use only assets with enough history
    const candidates = market.assets.filter((a) => a.history.length >= 14).slice(0, 18);

    let sentimentMap: Record<string, { sentiment: number; note: string }> = {};
    let usedAI = false;
    if (apiKey) {
      sentimentMap = await aiSentimentBatch(
        apiKey,
        candidates.map((a) => ({ symbol: a.symbol, name: a.name, changePct: a.changePct })),
      );
      usedAI = Object.keys(sentimentMap).length > 0;
    }

    const signals = candidates.map((a) => {
      const prices = a.history.map((h) => h.p);
      const tech = technicalScore(prices);
      return buildSignal(a, tech, sentimentMap[a.symbol]);
    });

    // sort: highest |score|, buy/sell first
    signals.sort((a, b) => b.confidence - a.confidence);

    return { signals, generatedAt: Date.now(), engine: (usedAI ? "ai" : "heuristic") as "ai" | "heuristic" };
  });
