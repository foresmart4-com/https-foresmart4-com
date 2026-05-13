import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AssetVerdict {
  action: "buy" | "sell" | "hold" | "watch";
  confidence: "low" | "medium" | "high";
  horizon: "short" | "medium" | "long";
  entry?: string;
  stopLoss?: string;
  targets?: string[];
  positionSizePct?: string;
  rationale: string;
  drivers: string[];
  risks: string[];
  arabicSummary: string;
  uncertaintyLevel?: "low" | "medium" | "high";
  marketFears?: string[];
}

const AssetInput = z.object({
  symbol: z.string().min(1).max(40),
  name: z.string().max(120).optional(),
  category: z.string().max(40),
  price: z.number(),
  changePct: z.number(),
  high24h: z.number().optional(),
  low24h: z.number().optional(),
  language: z.enum(["ar", "en"]).default("ar"),
});

const verdictTool = {
  type: "function" as const,
  function: {
    name: "asset_verdict",
    description: "Return a structured trading verdict for the requested asset.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["buy", "sell", "hold", "watch"] },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        horizon: { type: "string", enum: ["short", "medium", "long"] },
        entry: { type: "string" },
        stopLoss: { type: "string" },
        targets: { type: "array", items: { type: "string" } },
        positionSizePct: { type: "string", description: "Suggested % of total capital, e.g. '5%'" },
        rationale: { type: "string" },
        drivers: { type: "array", items: { type: "string" } },
        risks: { type: "array", items: { type: "string" } },
        arabicSummary: { type: "string", description: "One-paragraph Arabic summary, even when language is English." },
        uncertaintyLevel: { type: "string", enum: ["low", "medium", "high"], description: "Overall market uncertainty level right now." },
        marketFears: { type: "array", items: { type: "string" }, description: "2-3 current market fears / sources of uncertainty." },
      },
      required: ["action", "confidence", "horizon", "rationale", "drivers", "risks", "arabicSummary"],
      additionalProperties: false,
    },
  },
};

export const analyzeAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AssetInput.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { verdict: null as AssetVerdict | null, error: "ai_not_configured" };

    const sys = data.language === "ar"
      ? `أنت محلل أسواق محترف شامل. أعطِ توصية شراء/بيع/احتفاظ/مراقبة لأصل واحد بناءً على جميع المتغيرات الممكنة:
- الاقتصاد الكلي: أسعار الفائدة (الفيدرالي، ساما، البنوك المركزية)، التضخم، قوة الدولار DXY، السندات، السيولة العالمية.
- الجيوسياسة: الحروب، العقوبات، اتفاقيات أوبك+، التوترات في الخليج وبحر الصين والشرق الأوسط، الانتخابات.
- العوامل القطاعية والشركة: الأرباح، التوجيهات، الاندماجات، أخبار المنتجات، سلاسل الإمداد.
- الموسمية والدورات: نهاية/بداية السنة المالية، موسم الحج والعمرة، رمضان، الصيف، عطلات الأعياد، دورة الأرباح ربع السنوية، دورة Halving للبيتكوين، دورة الذهب الموسمية (الطلب الهندي/الصيني، موسم الزفاف).
- المناخ والطبيعة: موجات الحر والبرد (تؤثر على الطاقة والغاز والقمح)، الأعاصير والفيضانات (النفط والتأمين والزراعة)، الجفاف (السلع الزراعية)، ظاهرة النينيو/النينيا.
- النشاط الشمسي ودورة الشمس: التوهجات الشمسية والعواصف المغناطيسية (تأثيرها على الأقمار والاتصالات وشبكات الكهرباء وبالتالي شركات التكنولوجيا والطاقة).
- الفنّي: الاتجاه، المتوسطات (50/200)، RSI، الدعم/المقاومة، الحجم، فجوات السعر.
- معنويات السوق: مؤشر الخوف والطمع، تدفقات ETF، نسب الرافعة، تموضع المضاربين (COT).
- مخاوف السوق وعدم اليقين: مؤشر التقلب VIX و MOVE، فروقات ائتمان السندات، مخاوف الركود، أزمات بنكية أو سيولة، عدم وضوح سياسة الفيدرالي، مخاطر تخلف الديون السيادية، الحرب التجارية والتعريفات، عدم اليقين السياسي/الانتخابي، تقلبات العملات، صدمات غير متوقعة (Black Swans).
- الفنّي: الاتجاه، المتوسطات (50/200)، RSI، الدعم/المقاومة، الحجم، فجوات السعر.
اذكر دائماً مستوى عدم اليقين العام في السوق (منخفض/متوسط/مرتفع) في الحقل uncertaintyLevel، وأبرز 2-3 من المخاوف الحالية في marketFears. كن صريحاً: إذا كان عدم اليقين مرتفعاً جداً قلّل حجم الصفقة المقترح أو أوصِ بالمراقبة. اذكر في drivers أهم 4-6 عوامل فعّالة الآن، وفي risks 3-5 مخاطر. اكتب كل النصوص بالعربية الفصحى. استخدم دائماً الأداة asset_verdict.`
      : `You are a comprehensive markets analyst. Give a buy/sell/hold/watch verdict for ONE asset using ALL relevant variables:
- Macro, Geopolitics, Sector/company, Seasonality & cycles, Climate, Solar activity (as before).
- Market fears & uncertainty: VIX, MOVE index, credit spreads, recession fears, bank/liquidity crises, Fed policy ambiguity, sovereign default risk, trade wars & tariffs, political/election uncertainty, FX volatility, black-swan shocks.
- Sentiment: fear & greed, ETF flows, leverage, COT positioning.
- Technicals: trend, MAs, RSI, S/R, volume.
Always set uncertaintyLevel (low/medium/high) and list 2-3 current marketFears. If uncertainty is high, reduce position size or recommend watch. arabicSummary must always be in Arabic. Always call asset_verdict.`;

    const user = `Asset: ${data.name ?? data.symbol} (${data.symbol})
Category: ${data.category}
Current price: ${data.price}
24h change: ${data.changePct.toFixed(2)}%
24h high: ${data.high24h ?? "n/a"}
24h low: ${data.low24h ?? "n/a"}
Date: ${new Date().toISOString().slice(0, 10)}

Provide a verdict tailored to a small/retail trader. Entry / stop / targets should be concrete price levels in the asset's quote currency.`;

    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: user },
          ],
          tools: [verdictTool],
          tool_choice: { type: "function", function: { name: "asset_verdict" } },
        }),
      });
      if (r.status === 429) return { verdict: null, error: "rate_limited" };
      if (r.status === 402) return { verdict: null, error: "payment_required" };
      if (!r.ok) {
        console.error("analyzeAsset error", r.status, await r.text());
        return { verdict: null, error: "ai_error" };
      }
      const d = await r.json();
      const call = d.choices?.[0]?.message?.tool_calls?.[0];
      if (!call?.function?.arguments) return { verdict: null, error: "no_tool_call" };
      const verdict = JSON.parse(call.function.arguments) as AssetVerdict;
      return { verdict, error: null as string | null };
    } catch (e) {
      console.error(e);
      return { verdict: null, error: "network_error" };
    }
  });

// ===== Micro capital plan (50 - 5000 SAR) =====

export interface MicroPlanStep {
  week: string;
  goal: string;
  action: string;
  expectedReturn: string;
  risk: "low" | "medium" | "high";
}

export interface MicroAllocation {
  bucket: string;
  pct: string;
  examples: string[];
  why: string;
}

export interface MicroCapitalPlan {
  headline: string;
  monthlyTargetPct: string;
  yearlyTargetPct: string;
  allocations: MicroAllocation[];
  weeklySteps: MicroPlanStep[];
  rules: string[];
  warnings: string[];
  exitConditions: string[];
}

const PlanInput = z.object({
  capitalSar: z.number().min(50).max(50000),
  riskAppetite: z.enum(["conservative", "balanced", "aggressive"]),
  monthsHorizon: z.number().min(1).max(36),
  language: z.enum(["ar", "en"]).default("ar"),
  focus: z.array(z.enum(["crypto", "stocks", "metals", "fx", "savings"])).default(["crypto", "stocks", "metals"]),
});

const planTool = {
  type: "function" as const,
  function: {
    name: "micro_plan",
    description: "Return a structured micro-capital growth plan in SAR.",
    parameters: {
      type: "object",
      properties: {
        headline: { type: "string" },
        monthlyTargetPct: { type: "string" },
        yearlyTargetPct: { type: "string" },
        allocations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              bucket: { type: "string" },
              pct: { type: "string" },
              examples: { type: "array", items: { type: "string" } },
              why: { type: "string" },
            },
            required: ["bucket", "pct", "examples", "why"],
          },
        },
        weeklySteps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              week: { type: "string" },
              goal: { type: "string" },
              action: { type: "string" },
              expectedReturn: { type: "string" },
              risk: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: ["week", "goal", "action", "expectedReturn", "risk"],
          },
        },
        rules: { type: "array", items: { type: "string" } },
        warnings: { type: "array", items: { type: "string" } },
        exitConditions: { type: "array", items: { type: "string" } },
      },
      required: ["headline", "monthlyTargetPct", "yearlyTargetPct", "allocations", "weeklySteps", "rules", "warnings", "exitConditions"],
      additionalProperties: false,
    },
  },
};

async function callPlanModel(apiKey: string, model: string, messages: any[]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22000);
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify({
      model,
      messages,
      tools: [planTool],
      tool_choice: { type: "function", function: { name: "micro_plan" } },
    }),
  }).finally(() => clearTimeout(timeout));
  return r;
}

function buildDeterministicMicroPlan(data: z.infer<typeof PlanInput>): MicroCapitalPlan {
  const isAr = data.language === "ar";
  const metals = data.focus.includes("metals") ? (data.riskAppetite === "aggressive" ? 10 : 15) : 0;
  const crypto = data.focus.includes("crypto") ? (data.riskAppetite === "conservative" ? 5 : data.riskAppetite === "balanced" ? 10 : 15) : 0;
  const core = 100 - metals - crypto;
  const safe = Math.round(core * (data.riskAppetite === "conservative" ? 0.5 : data.riskAppetite === "balanced" ? 0.35 : 0.25));
  const etfs = Math.round(core * (data.riskAppetite === "conservative" ? 0.35 : data.riskAppetite === "balanced" ? 0.4 : 0.35));
  const growth = 100 - metals - crypto - safe - etfs;
  const cash = data.capitalSar;
  const sar = (pct: number) => Math.round((cash * pct) / 100);

  return {
    headline: isAr
      ? `خطة نمو عملية لرأس مال ${cash} ريال خلال ${data.monthsHorizon} أشهر مع ضبط المخاطر`
      : `Practical ${cash} SAR growth plan for ${data.monthsHorizon} months with strict risk control`,
    monthlyTargetPct: data.riskAppetite === "conservative" ? "1–3%" : data.riskAppetite === "balanced" ? "3–6%" : isAr ? "5–10% مع تذبذب عالٍ" : "5–10% with high volatility",
    yearlyTargetPct: data.riskAppetite === "conservative" ? "12–25%" : data.riskAppetite === "balanced" ? "25–55%" : isAr ? "50%+ غير مضمون وعالي المخاطر" : "50%+ not guaranteed, high risk",
    allocations: [
      { bucket: isAr ? "سيولة وأدوات منخفضة المخاطر" : "Cash and low-risk sleeve", pct: `${safe}%`, examples: [`${sar(safe)} SAR نقداً`, "صندوق مرابحة/صكوك قصير الأجل", "SGOV"], why: isAr ? "يحمي رأس المال ويمنحك قدرة شراء عند الهبوط." : "Protects capital and gives buying power during pullbacks." },
      { bucket: isAr ? "مؤشرات عالمية منخفضة التكلفة" : "Low-cost global ETFs", pct: `${etfs}%`, examples: [`${sar(etfs)} SAR VWRA/VT`, "Wahed", "S&P 500 ETF"], why: isAr ? "قاعدة متنوعة تقلل خطأ اختيار سهم واحد." : "Diversified core that reduces single-name risk." },
      { bucket: isAr ? "أسهم قيادية ونمو معقول" : "Quality stocks and GARP", pct: `${growth}%`, examples: [`${sar(growth)} SAR تداول/قياديات`, "Apple/Microsoft عبر وسيط منظم", "أسهم توزيعات"], why: isAr ? "تعرض للنمو مع اشتراط جودة الأرباح وهامش أمان." : "Growth exposure with earnings quality and margin of safety." },
      { bucket: isAr ? "ذهب وتحوط" : "Gold and hedges", pct: `${metals}%`, examples: [`${sar(metals)} SAR ذهب`, "GLD/IAU", "ذهب فعلي"], why: isAr ? "يخفف أثر التضخم والتوترات الجيوسياسية." : "Offsets inflation and geopolitical shocks." },
      ...(crypto > 0 ? [{ bucket: isAr ? "رهان ابتكاري محدود" : "Limited innovation bet", pct: `${crypto}%`, examples: [`${sar(crypto)} SAR BTC/ETH`, "Rain/Binance مرخص حسب بلدك"], why: isAr ? "مخصص صغير لعائد مرتفع محتمل دون تهديد الخطة." : "Small upside sleeve without threatening the plan." }] : []),
    ],
    weeklySteps: [
      { week: isAr ? "الأسبوع 1" : "Week 1", goal: isAr ? "تثبيت قاعدة الأمان" : "Build the safety base", action: isAr ? `احتفظ بـ ${sar(safe)} ريال كسيولة، واشترِ تدريجياً بـ ${Math.max(50, sar(etfs) / 2).toFixed(0)} ريال من ETF عالمي.` : `Keep ${sar(safe)} SAR liquid and start with about ${Math.max(50, sar(etfs) / 2).toFixed(0)} SAR in a global ETF.`, expectedReturn: "0–2%", risk: "low" },
      { week: isAr ? "الأسبوع 2" : "Week 2", goal: isAr ? "إضافة النمو المنضبط" : "Add controlled growth", action: isAr ? `وزّع ${sar(growth)} ريال على سهم/صندوق عالي الجودة، ولا تدخل دفعة واحدة إذا كان السوق مرتفعاً.` : `Allocate ${sar(growth)} SAR to quality stocks/funds, without entering all at once if markets are extended.`, expectedReturn: "1–4%", risk: "medium" },
      { week: isAr ? "الأسبوع 3" : "Week 3", goal: isAr ? "تحوط ضد الصدمات" : "Add shock protection", action: isAr ? `اشترِ ذهباً أو صندوق ذهب بقيمة تقارب ${sar(metals)} ريال، واتركه للتحوط لا للمضاربة اليومية.` : `Buy about ${sar(metals)} SAR of gold or a gold ETF as a hedge, not as a day trade.`, expectedReturn: "0–3%", risk: "low" },
      { week: isAr ? "الأسبوع 4" : "Week 4", goal: isAr ? "رهان صغير محسوب" : "Small calculated bet", action: isAr ? crypto > 0 ? `إن رغبت، خصص ${sar(crypto)} ريال فقط لـ BTC/ETH، ولا تستخدم رافعة.` : "لا تضف كريبتو حالياً؛ ركّز على المؤشرات والسيولة." : crypto > 0 ? `If desired, allocate only ${sar(crypto)} SAR to BTC/ETH; no leverage.` : "Skip crypto for now; focus on ETFs and liquidity.", expectedReturn: crypto > 0 ? "-10% إلى +15%" : "1–3%", risk: crypto > 0 ? "high" : "medium" },
      { week: isAr ? "شهرياً" : "Monthly", goal: isAr ? "إعادة موازنة" : "Rebalance", action: isAr ? "أعد النسب للأهداف الأصلية، وخفّض أي أصل زاد كثيراً بعد صعود سريع." : "Rebalance to target weights and trim assets that rallied too quickly.", expectedReturn: "حسب السوق", risk: "medium" },
    ],
    rules: isAr
      ? ["لا تخاطر بأكثر من 2% من رأس المال في صفقة واحدة.", "ادخل على دفعات أسبوعية لا دفعة واحدة.", "احتفظ بسيولة 10–20% دائماً.", "راجع الخطة شهرياً لا يومياً.", "استخدم وقف خسارة للأصول المتذبذبة فقط."]
      : ["Risk no more than 2% of capital per trade.", "Enter weekly in tranches, not all at once.", "Keep 10–20% liquidity at all times.", "Review monthly, not hourly.", "Use stop-losses for volatile assets only."],
    warnings: isAr
      ? ["العوائد ليست مضمونة وقد تخسر جزءاً من رأس المال.", "تجنب الرافعة والقروض تماماً.", "لا تلاحق الشموع الخضراء بعد صعود قوي.", "الكريبتو مناسب كنسبة صغيرة فقط."]
      : ["Returns are not guaranteed and capital can decline.", "Avoid leverage and borrowing completely.", "Do not chase strong green candles.", "Crypto belongs in a small sleeve only."],
    exitConditions: isAr
      ? ["اخرج من أي أصل إذا كسر سبب الاستثمار الأساسي.", "خفّض المخاطر إذا خسرت الخطة 8–12% من القمة.", "خذ جزءاً من الربح عند تحقق هدف شهرين مبكراً.", "أوقف الشراء مؤقتاً عند أخبار نظامية/سيولة خطيرة."]
      : ["Exit any asset when the original thesis breaks.", "Reduce risk if the plan drops 8–12% from peak.", "Take partial profit if two-month targets arrive early.", "Pause buying during severe regulatory or liquidity shocks."],
  };
}

export const microCapitalPlan = createServerFn({ method: "POST" })
  .inputValidator((d) => PlanInput.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { plan: null as MicroCapitalPlan | null, error: "ai_not_configured", detail: "LOVABLE_API_KEY missing" };

    const today = new Date().toISOString().slice(0, 10);

    const sys = data.language === "ar"
      ? `أنت كبير مستشاري الاستثمار في صندوق احترافي، متخصص في تنمية رؤوس الأموال الصغيرة (50–5000 ريال). ادمج أفضل ممارسات عمالقة الاستثمار:
- وارن بافت: قيمة، خندق تنافسي، صبر طويل الأمد.
- ريه داليو: تنويع شامل (All Weather)، توازن المخاطر بين الأصول.
- بيتر لينش: استثمر فيما تفهم، نمو معقول السعر (GARP).
- بنجامين جراهام: هامش أمان، تجنب المضاربة العشوائية.
- جاك بوغل: ETFs منخفضة التكلفة كأساس.
- ستانلي دروكنميلر: تركّز ذكي حين تكون القناعة عالية.
- كاثي وود: نسبة صغيرة في الابتكار طويل الأجل (كحد أقصى 10-15%).
- ناسيم طالب (Barbell): أغلب رأس المال آمن + نسبة صغيرة لرهانات عالية المردود.
- DCA الدوري + إعادة موازنة شهرية + قواعد صارمة لإدارة المخاطر (المخاطرة بأقل من 2% لكل صفقة، وقف خسارة، لا رافعة).
خصص الخطة للسوق السعودي والخليجي والأصول العالمية المتاحة (تداول، Wahed، ETFs عالمية، بيتكوين/إيثيريوم عبر منصات منظمة، الذهب الفعلي/SGOV).
- اقترح توزيعاً واقعياً يجمع: ETFs آمنة + أسهم قيادية + ذهب + نسبة محدودة من الكريبتو + سيولة طارئة (10-15%).
- اكتب أهدافاً واقعية: محافظ 1-3% شهرياً، متوازن 3-6%، هجومي 5-10% (مع مخاطرة أعلى).
- لا تعد بأرباح خيالية. كن صريحاً بشأن الخسائر المحتملة.
- خطوات أسبوعية محددة بمبالغ بالريال (مثلاً: "أودع 100 ريال في صندوق ETF عالمي مثل VWRA").
أعد الجواب فقط عبر استدعاء الأداة micro_plan. كل النصوص بالعربية الفصحى الواضحة.`
      : `You are a senior investment advisor at a top fund, specializing in growing small portfolios (50–5000 SAR). Blend best practices from Buffett (value, moat), Dalio (All-Weather diversification), Lynch (GARP, invest in what you know), Graham (margin of safety), Bogle (low-cost ETFs), Druckenmiller (high-conviction concentration), Wood (small innovation sleeve, max 10-15%), and Taleb's barbell (mostly safe + small high-payoff bets). Apply DCA, monthly rebalancing, and strict risk rules (≤2% risk per trade, stop-loss, no leverage). Tailor for Saudi/Gulf retail investors with access to Tadawul, Wahed, global ETFs, regulated crypto, and physical/SGOV gold. Realistic monthly targets: conservative 1-3%, balanced 3-6%, aggressive 5-10%. Always call micro_plan. English only.`;

    const user = `Capital: ${data.capitalSar} SAR
Risk appetite: ${data.riskAppetite}
Horizon: ${data.monthsHorizon} months
Focus areas: ${data.focus.join(", ")}
Today: ${today}

Build a comprehensive plan. Allocations percentages must sum to ~100% and reflect the focus areas + risk profile. Weekly steps must cover the first 4 weeks plus 3-4 monthly milestones with concrete SAR amounts and specific instruments (e.g. "اشترِ بـ 200 ريال من iShares MSCI World" or "150 ريال BTC عبر Rain"). Include at least 5 golden rules, 3-5 warnings, and 3-4 exit conditions.`;

    const messages = [
      { role: "system", content: sys },
      { role: "user", content: user },
    ];

    let r: Response;
    try {
      // Default to the current fast AI Gateway model, then fall back to lite.
      r = await callPlanModel(apiKey, "google/gemini-3-flash-preview", messages);
      if (r.status === 429 || r.status === 503) {
        r = await callPlanModel(apiKey, "google/gemini-2.5-flash-lite", [
        { role: "system", content: sys },
        { role: "user", content: user },
        ]);
      }
    } catch (e) {
      console.error("microCapitalPlan timeout/network fallback", e);
      return { plan: buildDeterministicMicroPlan(data), error: null as string | null, detail: "fallback_plan" };
    }

    if (r.status === 429) return { plan: null, error: "rate_limited", detail: "Too many requests" };
    if (r.status === 402) return { plan: null, error: "payment_required", detail: "Add Lovable AI credits" };
    if (!r.ok) {
      const txt = await r.text();
      console.error("microCapitalPlan error", r.status, txt);
      return { plan: null, error: "ai_error", detail: `${r.status}: ${txt.slice(0, 200)}` };
    }

    let firstPlan: MicroCapitalPlan;
    try {
      const d = await r.json();
      const call = d.choices?.[0]?.message?.tool_calls?.[0];
      if (!call?.function?.arguments) return { plan: buildDeterministicMicroPlan(data), error: null as string | null, detail: "fallback_plan" };
      firstPlan = JSON.parse(call.function.arguments) as MicroCapitalPlan;
    } catch (e) {
      console.error(e);
      return { plan: buildDeterministicMicroPlan(data), error: null as string | null, detail: "fallback_plan" };
    }

    return { plan: firstPlan, error: null as string | null, detail: null as string | null };
  });
