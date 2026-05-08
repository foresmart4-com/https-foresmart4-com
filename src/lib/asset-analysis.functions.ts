import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
      },
      required: ["action", "confidence", "horizon", "rationale", "drivers", "risks", "arabicSummary"],
      additionalProperties: false,
    },
  },
};

export const analyzeAsset = createServerFn({ method: "POST" })
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

export const microCapitalPlan = createServerFn({ method: "POST" })
  .inputValidator((d) => PlanInput.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { plan: null as MicroCapitalPlan | null, error: "ai_not_configured" };

    const sys = data.language === "ar"
      ? `أنت مدرب استثماري متخصص في تنمية رؤوس الأموال الصغيرة جداً (من 50 إلى 5000 ريال سعودي). صمّم خطة عملية أسبوعية واضحة، واقعية، ومناسبة للسوق السعودي والخليجي والأسواق العالمية المتاحة لمستثمر فرد.
- اقترح نسب توزيع منطقية (مثلاً 40% بيتكوين/إيثيريوم، 30% أسهم سعودية أو ETFs عالمية، 20% ذهب، 10% سيولة).
- اكتب خطوات أسبوعية محددة (الأسبوع 1، 2، 3، 4، الشهر 2...) مع مبالغ بالريال.
- اذكر قواعد إدارة المخاطر (مثلاً عدم المخاطرة بأكثر من 2% في صفقة، وقف خسارة، عدم استخدام رافعة مالية مع رأس مال صغير).
- كن صريحاً بشأن الواقعية: لا تعد بأرباح خيالية. هدف شهري معقول 3-8% للمتوازن.
استخدم الأداة micro_plan دائماً، واكتب جميع النصوص بالعربية.`
      : `You are an investing coach specializing in growing very small portfolios (50–5000 SAR). Build a realistic, week-by-week plan with concrete allocations and SAR amounts. Always call the micro_plan tool. All text in English.`;

    const user = `Capital: ${data.capitalSar} SAR
Risk appetite: ${data.riskAppetite}
Horizon: ${data.monthsHorizon} months
Focus areas: ${data.focus.join(", ")}
Today: ${new Date().toISOString().slice(0, 10)}

Build the plan. Allocations percentages must sum to ~100%. Weekly steps should cover at least the first 4 weeks plus 2-3 monthly milestones with concrete SAR amounts (e.g. "اشترِ بـ 200 ريال من ETH").`;

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
          tools: [planTool],
          tool_choice: { type: "function", function: { name: "micro_plan" } },
        }),
      });
      if (r.status === 429) return { plan: null, error: "rate_limited" };
      if (r.status === 402) return { plan: null, error: "payment_required" };
      if (!r.ok) {
        console.error("microCapitalPlan error", r.status, await r.text());
        return { plan: null, error: "ai_error" };
      }
      const d = await r.json();
      const call = d.choices?.[0]?.message?.tool_calls?.[0];
      if (!call?.function?.arguments) return { plan: null, error: "no_tool_call" };
      const plan = JSON.parse(call.function.arguments) as MicroCapitalPlan;
      return { plan, error: null as string | null };
    } catch (e) {
      console.error(e);
      return { plan: null, error: "network_error" };
    }
  });
