// P0 Genesis Intelligence Rescue — Benchmark Tests
// Tests institutional depth engine and shallow answer rejection.
// All tests are pure / no AI calls / no network — O(1) deterministic assertions.
//
// Validation benchmark question (Arabic):
//   "إذا كنت مدير استثمار محافظ ولديك أفق 12-24 شهراً، كيف ستنظر إلى السوق السعودي حالياً؟"
// Expected minimum: institutional quality in all dimensions.

import { buildInstitutionalDepthContext } from "../institutionalDepthEngine";
import { shouldRejectAnswer, repairShallowAnswer } from "../shallowAnswerRejection";
import type { GenesisReply } from "@/lib/genesis.functions";

// ─── Mock data builders ────────────────────────────────────────────────────────

function mockTrackA(overrides?: Partial<{
  regime: string;
  macroBias: "bullish" | "bearish" | "neutral";
  creditStressLevel: "low" | "moderate" | "high" | "extreme";
  ratesEnv: string;
  oilLiquidity: string;
  regimeConf: number;
  macroSummary: string;
}>) {
  return {
    regime: overrides?.regime ?? "macro_transition",
    macroBias: overrides?.macroBias ?? "neutral",
    creditStressLevel: overrides?.creditStressLevel ?? "moderate",
    ratesEnv: overrides?.ratesEnv ?? "Fed holding at restrictive levels; real rates positive",
    oilLiquidity: overrides?.oilLiquidity ?? "Oil at $78 — near Saudi fiscal breakeven; direction uncertain",
    regimeConf: overrides?.regimeConf ?? 55,
    macroSummary: overrides?.macroSummary ?? "Macro transition regime with mixed signals",
  };
}

function mockTrackD(overrides?: Partial<{
  uncertaintyLevel: "low" | "moderate" | "high" | "extreme";
  primaryRisk: string;
  thesisWeakness: string;
  invalidationTrigger: string;
}>) {
  return {
    uncertaintyLevel: overrides?.uncertaintyLevel ?? "moderate",
    primaryRisk: overrides?.primaryRisk ?? "Oil price downside risk below fiscal breakeven",
    thesisWeakness: overrides?.thesisWeakness ?? "TASI valuations assume oil above $75/bbl",
    invalidationTrigger: overrides?.invalidationTrigger ?? "Oil sustained below $70/bbl for 6+ weeks",
  };
}

function mockConsensus(overrides?: Partial<{
  dominantBias: "bullish" | "bearish" | "neutral";
  agreementScore: number;
  strength: "strong" | "moderate" | "weak" | "conflicted";
}>) {
  return {
    dominantBias: overrides?.dominantBias ?? "neutral",
    agreementScore: overrides?.agreementScore ?? 55,
    strength: overrides?.strength ?? "moderate",
  };
}

// Institutional-quality reply (should NOT be rejected)
function mockDeepReply(): GenesisReply {
  return {
    headline: "Saudi market in fiscal-breakeven conflict: oil near $78 → TASI valuation supported but transmission risk rising",
    outlook: "Saudi macro regime sits at the intersection of Fed policy constraint and oil fiscal dynamics. Rate transmission: Fed holding at restrictive → SAMA shadows → local borrowing costs elevated → credit growth decelerating → leveraged sectors under pressure. Oil at ~$78/bbl is near the $75-80 fiscal breakeven → government spending pace depends on oil direction; if oil softens, Vision 2030 capex disbursements could be deferred. Cross-asset: DXY strength is a mild headwind for EM flows including TASI foreign capital. Sector differentiation required: Aramco dividend (yield anchor) supports TASI floor; banks face NIM expansion but credit quality concerns; SABIC exposed to China PMI softness.",
    confidence: 55,
    confidenceLabel: "moderate",
    scenarios: [
      { label: "If oil sustains above $80/bbl and Fed pivots toward easing", probability: "30%", impact: "TASI re-rates higher; government spending accelerates; Vision 2030 beneficiaries outperform" },
      { label: "If oil holds $70-80 and Fed holds rates", probability: "45%", impact: "TASI range-bound; defensive sectors (Aramco, banks) outperform cyclicals; selective exposure warranted" },
      { label: "If oil falls below $70/bbl for sustained period", probability: "25%", impact: "Government spending at risk; TASI valuation floor challenged; broad derating likely" },
    ],
    risks: [
      "Oil decline below fiscal breakeven → second-order: government spending contraction → credit growth slowdown → real estate derating → TASI compression beyond energy sector",
      "Fed rate trajectory stays restrictive → SAMA constraint → Saudi credit market remains tight → leveraged sectors underperform",
    ],
    suggestedAction: null,
    disclaimer: "Educational analysis only. Not investment advice.",
    macroChain: "Fed policy → SAMA constraint (SAR peg) → Saudi borrowing costs → credit growth → non-oil GDP → TASI non-energy valuation. Oil price → fiscal surplus/deficit → government spending → Vision 2030 capex → infrastructure sector earnings.",
    bullCase: "Oil above fiscal breakeven → government spending accelerates → credit growth positive → banks expand → Vision 2030 pipeline delivers earnings. Fed pivot → SAMA easing follows → local liquidity improves → TASI multiples expand.",
    bearCase: "Oil below $70/bbl sustained → fiscal deficit widens → spending cuts → Vision 2030 deferrals → infrastructure earnings disappoint → TASI derates broadly. Fed holds restrictive → SAMA constrained → credit tight → banks face NPL risk.",
    baseCase: "Oil near breakeven + Fed holding → TASI in range-bound regime; Aramco dividend yield (~4-5%) provides floor; sector differentiation over broad exposure is the institutional call.",
    missingEvidence: "Current Aramco dividend coverage ratio at spot oil, bank credit growth Q/Q trend, foreign investor flows into TASI, and China PMI direction for SABIC margin outlook.",
    thesisChanger: "Fed pivot toward 2+ cuts changes the SAMA constraint equation materially; or oil moving decisively below $70/bbl reprices the entire Saudi fiscal thesis.",
    sectorLens: "Aramco (defensive, yield anchor) → primary position for conservative allocator. Banks → benefit from NIM but credit quality risk rising; underweight cyclical names. SABIC → avoid until China demand recovery confirmed. Vision 2030 infrastructure → hold only with oil above $80 conviction.",
    secondOrderRisks: "If oil drops below fiscal breakeven → government spending contracts → bank lending growth slows → real estate valuations compress → household wealth effect dampens consumer spending — contagion extends well beyond the energy sector. If credit spreads widen → refinancing costs rise → leveraged Vision 2030 project SPVs face cost overruns → capex deferrals → construction sector derating.",
    committeeStance: "selective_over_broad",
    committeeBullCase: "Oil above breakeven + Fed pivot = TASI re-rates; Aramco dividend yield provides entry floor for conservative accumulation.",
    committeeBearCase: "Fed constraint + oil volatility = TASI range-bound at best; Vision 2030 earnings not yet materializing → premium valuations unjustified.",
    thesis: "TASI requires selective positioning (Aramco/defensive banks) over broad index exposure until oil direction clarity and Fed pivot confirmation emerge.",
    opposingCase: "Bull case: TASI trading near historical fair value with Aramco yield support; any Fed softening would trigger re-rating. This loses because the Fed trajectory remains uncertain and oil is at, not above, fiscal breakeven.",
    invalidation: "Oil sustained above $85/bbl for 8+ weeks AND Fed signals two or more cuts → broad TASI exposure justified.",
    voiceReasoning: {
      macro: "Macro regime is transition: rate pressure from Fed/SAMA limits domestic liquidity expansion; oil near breakeven constrains fiscal multiplier. Not bearish but not constructive — range-bound bias.",
      policy: "SAMA lacks monetary independence due to SAR peg. Fed holding → SAMA constrained → local rates stay elevated. Policy cannot provide domestic stimulus offset to oil headwinds.",
      allocator: "Conservative allocator with 12-24M horizon: scale into Aramco on weakness (yield support), underweight SABIC (China risk), avoid Vision 2030 pure-plays until earnings visibility improves. Broad TASI ETF exposure not warranted — too much earnings uncertainty.",
      behavioral: "Foreign flows into TASI are sentiment-driven by oil and EM risk appetite. Retail investor concentration in Vision 2030 names creates crowding risk on any negative news.",
    },
    committeeSynthesis: {
      agreement: "All voices agree: selective exposure over broad index is the institutional call.",
      disagreement: "Policy voice emphasizes Fed constraint more than macro voice; allocator is more defensive than macro on timing.",
      dominantVoice: "allocator",
      finalStance: "Conservative scale-in to defensives (Aramco, quality banks) with explicit avoid on Vision 2030 high-multiple names until earnings confirm. Wait for Fed pivot or oil above $82/bbl to broaden exposure.",
    },
    caveats: [
      "Oil at fiscal breakeven is a fragile equilibrium — small moves have outsized fiscal implications",
      "SAMA constraint means domestic policy cannot offset external macro headwinds",
    ],
    confidenceCalibration: "55% reflects oil near breakeven (not above or below) plus Fed uncertainty — both are unresolved; confidence would rise to 65%+ on oil direction clarity and Fed cut signal.",
    reasoningQuality: "strong",
    uncertaintyLevel: "possible",
    regime: "macro_transition",
    evidence: [
      "Aramco dividend yield (~4-5%) provides valuation floor and income anchor",
      "SAR peg constraint means SAMA cannot ease independently of Fed",
      "Oil at fiscal breakeven — direction determines government spending trajectory",
      "Vision 2030 capex dependent on oil surplus not yet confirmed",
    ],
  };
}

// Shallow reply (should be rejected)
function mockShallowReply(): GenesisReply {
  return {
    headline: "Saudi market conditions remain mixed with significant uncertainty",
    outlook: "The Saudi market is volatile due to oil price fluctuations. Oil affects the market significantly. Liquidity is neutral at this stage. The credit pressure is moderate. Investors should monitor developments closely. There is no clear direction for the market.",
    confidence: 50,
    confidenceLabel: "moderate",
    scenarios: [
      { label: "Upside scenario", probability: "~40%", impact: "Improving conditions" },
      { label: "Base scenario", probability: "~35%", impact: "Stable conditions" },
      { label: "Downside scenario", probability: "~25%", impact: "Pressure on risk assets" },
    ],
    risks: ["Market uncertainty", "Global headwinds"],
    suggestedAction: null,
    disclaimer: "Educational only.",
  };
}

// ─── Test: Depth Engine Context Generation ────────────────────────────────────

describe("institutionalDepthEngine.buildInstitutionalDepthContext", () => {
  test("returns empty context for non-investment questions", () => {
    const result = buildInstitutionalDepthContext(
      "What is the weather in London?", null, null,
      { dominantBias: "neutral", agreementScore: 50, strength: "moderate" },
      false, false, "en",
    );
    expect(result.depthContext).toBe("");
    expect(result.saudiDepthContext).toBe("");
    expect(result.dimensionsInjected).toHaveLength(0);
  });

  test("injects all 10+ dimensions for investment questions", () => {
    const result = buildInstitutionalDepthContext(
      "Should I invest in the Saudi market over 12-24 months?",
      mockTrackA(), mockTrackD(),
      mockConsensus(),
      true, true, "en",
    );
    expect(result.dimensionsInjected).toContain("transmission_chain");
    expect(result.dimensionsInjected).toContain("second_order_effects");
    expect(result.dimensionsInjected).toContain("allocator_psychology");
    expect(result.dimensionsInjected).toContain("valuation_vs_earnings");
    expect(result.dimensionsInjected).toContain("policy_reaction");
    expect(result.dimensionsInjected).toContain("liquidity_credit");
    expect(result.dimensionsInjected).toContain("sector_rotation");
    expect(result.dimensionsInjected).toContain("risk_reward");
    expect(result.dimensionsInjected).toContain("thesis_change");
  });

  test("Saudi depth context is non-empty for Saudi questions", () => {
    const result = buildInstitutionalDepthContext(
      "What is the outlook for TASI?",
      mockTrackA(), mockTrackD(),
      mockConsensus(),
      true, true, "en",
    );
    expect(result.saudiDepthContext.length).toBeGreaterThan(200);
    expect(result.saudiDepthContext).toContain("fiscal breakeven");
    expect(result.saudiDepthContext).toContain("Aramco");
    expect(result.saudiDepthContext).toContain("SAMA");
    expect(result.saudiDepthContext).toContain("Vision 2030");
    expect(result.saudiDepthContext).toContain("conservative");
  });

  test("Saudi depth context includes Arabic mandatory depth for Arabic", () => {
    const result = buildInstitutionalDepthContext(
      "إذا كنت مدير استثمار محافظ ولديك أفق 12-24 شهراً، كيف ستنظر إلى السوق السعودي حالياً؟",
      mockTrackA(), mockTrackD(),
      mockConsensus(),
      true, true, "ar",
    );
    expect(result.saudiDepthContext).toContain("نقطة التعادل");
    expect(result.saudiDepthContext).toContain("SAMA");
    expect(result.saudiDepthContext).toContain("أرامكو");
    expect(result.saudiDepthContext).toContain("المخصص المحافظ");
  });

  test("regime conflict dimension injected when consensus is conflicted", () => {
    const result = buildInstitutionalDepthContext(
      "What is the US market outlook?",
      mockTrackA({ regimeConf: 40 }), mockTrackD(),
      mockConsensus({ strength: "conflicted", agreementScore: 45 }),
      true, false, "en",
    );
    expect(result.dimensionsInjected).toContain("regime_conflict");
    expect(result.depthContext).toContain("conflicted");
  });

  test("banned phrase enforcement block is always injected for investment questions", () => {
    const result = buildInstitutionalDepthContext(
      "Should I invest in US markets?",
      null, null,
      mockConsensus(),
      true, false, "en",
    );
    expect(result.depthContext).toContain("Banned phrases");
    expect(result.depthContext).toContain("ABSOLUTELY FORBIDDEN");
  });

  test("banned phrase enforcement block is always injected in Arabic", () => {
    const result = buildInstitutionalDepthContext(
      "هل أستثمر في الأسهم الأمريكية؟",
      null, null,
      mockConsensus(),
      true, false, "ar",
    );
    expect(result.depthContext).toContain("العبارات المحظورة");
    expect(result.depthContext).toContain("ممنوع تماماً");
  });

  test("secondOrderRisks field directive is always injected", () => {
    const result = buildInstitutionalDepthContext(
      "Which sectors should I invest in?",
      mockTrackA(), mockTrackD(),
      mockConsensus(),
      true, false, "en",
    );
    expect(result.depthContext).toContain("secondOrderRisks");
    expect(result.depthContext).toContain("second-order contagion");
  });
});

// ─── Test: Shallow Answer Rejection ──────────────────────────────────────────

describe("shallowAnswerRejection.shouldRejectAnswer", () => {
  test("non-investment questions are never rejected", () => {
    const result = shouldRejectAnswer(
      mockShallowReply(), "What is 2 + 2?", false, false, false, "en",
    );
    expect(result.rejected).toBe(false);
    expect(result.totalScore).toBe(100);
  });

  test("shallow Saudi reply is rejected with score < 80", () => {
    const result = shouldRejectAnswer(
      mockShallowReply(),
      "What is the outlook for the Saudi market?",
      true, true, false, "en",
    );
    expect(result.rejected).toBe(true);
    expect(result.totalScore).toBeLessThan(80);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.repairNeeded).toBe(true);
    expect(result.repairDirective.length).toBeGreaterThan(50);
  });

  test("institutional deep reply scores >= 80 and is NOT rejected", () => {
    const result = shouldRejectAnswer(
      mockDeepReply(),
      "إذا كنت مدير استثمار محافظ ولديك أفق 12-24 شهراً، كيف ستنظر إلى السوق السعودي حالياً؟",
      true, true, false, "ar",
    );
    expect(result.rejected).toBe(false);
    expect(result.totalScore).toBeGreaterThanOrEqual(80);
    expect(result.reasons).not.toContain("score_below_threshold");
  });

  test("shallow Arabic patterns are detected", () => {
    const result = shouldRejectAnswer(
      {
        ...mockShallowReply(),
        outlook: "السوق متذبذب حالياً والنفط يؤثر على السوق. السيولة محايدة والضغط الائتماني معتدل. لا يوجد اتجاه واضح.",
      },
      "كيف ترى السوق السعودي؟",
      true, true, false, "ar",
    );
    expect(result.patternsDetected.length).toBeGreaterThan(0);
    expect(result.rejected).toBe(true);
  });

  test("reply with macroChain but no causal arrows scores lower on causalDepth", () => {
    const replyNoArrows: GenesisReply = {
      ...mockDeepReply(),
      macroChain: "The Federal Reserve has been maintaining higher rates. This affects borrowing costs. Banks see higher net interest margins. Oil prices matter for Saudi fiscal position.",
    };
    const result = shouldRejectAnswer(replyNoArrows, "Saudi market outlook", true, true, false, "en");
    const causalDim = result.dimensionScores.find(d => d.dimension === "causalDepth");
    expect(causalDim).toBeDefined();
    // Without arrows, causal score should be lower than with arrows
    const resultWithArrows = shouldRejectAnswer(mockDeepReply(), "Saudi market outlook", true, true, false, "en");
    const causalWithArrows = resultWithArrows.dimensionScores.find(d => d.dimension === "causalDepth");
    expect(causalDim!.score).toBeLessThan(causalWithArrows!.score);
  });

  test("missing secondOrderRisks field reduces secondOrderReasoning score", () => {
    const replyNoSecondOrder: GenesisReply = {
      ...mockDeepReply(),
      secondOrderRisks: undefined,
    };
    const result = shouldRejectAnswer(replyNoSecondOrder, "Saudi market", true, true, false, "en");
    const dim = result.dimensionScores.find(d => d.dimension === "secondOrderReasoning");
    expect(dim).toBeDefined();
    expect(dim!.score).toBeLessThan(60);
  });

  test("missing allocator voice reduces allocatorRealism score", () => {
    const replyNoAllocator: GenesisReply = {
      ...mockDeepReply(),
      voiceReasoning: undefined,
      committeeStance: undefined,
    };
    const result = shouldRejectAnswer(replyNoAllocator, "Saudi market", true, true, false, "en");
    const dim = result.dimensionScores.find(d => d.dimension === "allocatorRealism");
    expect(dim).toBeDefined();
    expect(dim!.score).toBeLessThan(50);
  });

  test("repair directive is generated when rejected", () => {
    const result = shouldRejectAnswer(
      mockShallowReply(), "Saudi 12-month outlook", true, true, false, "en",
    );
    expect(result.repairDirective).toContain("secondOrderRisks");
    expect(result.repairDirective).toContain("causal");
  });
});

// ─── Test: Deterministic Repair ───────────────────────────────────────────────

describe("shallowAnswerRejection.repairShallowAnswer", () => {
  test("fills secondOrderRisks if absent (Saudi)", () => {
    const reply: GenesisReply = { ...mockShallowReply() };
    expect(reply.secondOrderRisks).toBeUndefined();
    repairShallowAnswer(reply, mockTrackA(), mockConsensus(), true, "en");
    expect(reply.secondOrderRisks).toBeDefined();
    expect(reply.secondOrderRisks!.length).toBeGreaterThan(50);
    expect(reply.secondOrderRisks).toContain("fiscal breakeven");
  });

  test("fills secondOrderRisks in Arabic for Saudi", () => {
    const reply: GenesisReply = { ...mockShallowReply() };
    repairShallowAnswer(reply, mockTrackA(), mockConsensus(), true, "ar");
    expect(reply.secondOrderRisks).toBeDefined();
    expect(reply.secondOrderRisks).toMatch(/نقطة\s+التعادل|الإقراض|تراجع/);
  });

  test("fills missingEvidence if absent (Saudi)", () => {
    const reply: GenesisReply = { ...mockShallowReply() };
    repairShallowAnswer(reply, mockTrackA(), mockConsensus(), true, "en");
    expect(reply.missingEvidence).toBeDefined();
    expect(reply.missingEvidence).toContain("Aramco");
  });

  test("fills thesisChanger if absent (Saudi)", () => {
    const reply: GenesisReply = { ...mockShallowReply() };
    repairShallowAnswer(reply, mockTrackA(), mockConsensus(), true, "en");
    expect(reply.thesisChanger).toBeDefined();
    expect(reply.thesisChanger).toContain("Fed");
  });

  test("adds causal arrow to macroChain if it lacks one", () => {
    const reply: GenesisReply = {
      ...mockShallowReply(),
      macroChain: "Fed is holding rates. This affects the market. Saudi market is influenced by oil prices.",
    };
    repairShallowAnswer(reply, mockTrackA(), mockConsensus(), true, "en");
    expect(reply.macroChain).toContain("→");
  });

  test("does not overwrite existing secondOrderRisks", () => {
    const existing = "Existing second-order analysis that is already deep.";
    const reply: GenesisReply = {
      ...mockShallowReply(),
      secondOrderRisks: existing,
    };
    repairShallowAnswer(reply, mockTrackA(), mockConsensus(), true, "en");
    expect(reply.secondOrderRisks).toBe(existing);
  });

  test("fills global (non-Saudi) secondOrderRisks correctly", () => {
    const reply: GenesisReply = { ...mockShallowReply() };
    repairShallowAnswer(reply, mockTrackA(), mockConsensus({ dominantBias: "bearish" }), false, "en");
    expect(reply.secondOrderRisks).toBeDefined();
    expect(reply.secondOrderRisks!.length).toBeGreaterThan(50);
  });
});

// ─── Test: Saudi 12-24 Month Conservative Allocator Benchmark ─────────────────
// Validation question: "إذا كنت مدير استثمار محافظ ولديك أفق 12–24 شهراً، كيف ستنظر إلى السوق السعودي حالياً؟"

describe("Saudi 12-24 month conservative allocator validation", () => {
  const validationQuestion = "إذا كنت مدير استثمار محافظ ولديك أفق 12-24 شهراً، كيف ستنظر إلى السوق السعودي حالياً؟";

  test("depth engine context for validation question contains all required Saudi elements", () => {
    const result = buildInstitutionalDepthContext(
      validationQuestion,
      mockTrackA({ oilLiquidity: "Oil at $78 — near Saudi fiscal breakeven $75-80/bbl" }),
      mockTrackD(),
      mockConsensus(),
      true, true, "ar",
    );
    // Must have Saudi depth
    expect(result.saudiDepthContext).toContain("نقطة التعادل");
    expect(result.saudiDepthContext).toContain("SAMA");
    expect(result.saudiDepthContext).toContain("أرامكو");
    expect(result.saudiDepthContext).toContain("البتروكيماويات");
    expect(result.saudiDepthContext).toContain("رؤية 2030");
    expect(result.saudiDepthContext).toContain("المخصص المحافظ");
    // Must have allocator psychology
    expect(result.depthContext).toContain("المخصص المؤسسي");
    // Must have transmission chain directive
    expect(result.depthContext).toContain("سلسلة نقل");
    // Must have second-order effects directive
    expect(result.depthContext).toContain("التأثيرات من الدرجة الثانية");
  });

  test("deep reply for validation question scores >= 80 (institutional quality)", () => {
    const result = shouldRejectAnswer(
      mockDeepReply(), validationQuestion, true, true, false, "ar",
    );
    expect(result.totalScore).toBeGreaterThanOrEqual(80);
    expect(result.rejected).toBe(false);
  });

  test("shallow reply for validation question is rejected with score < 80", () => {
    const result = shouldRejectAnswer(
      mockShallowReply(), validationQuestion, true, true, false, "ar",
    );
    expect(result.totalScore).toBeLessThan(80);
    expect(result.rejected).toBe(true);
  });

  test("repaired shallow reply for validation question meets minimum thresholds", () => {
    const reply: GenesisReply = { ...mockShallowReply() };
    repairShallowAnswer(reply, mockTrackA(), mockConsensus(), true, "ar");
    // After repair: key fields must be present
    expect(reply.secondOrderRisks).toBeDefined();
    expect(reply.missingEvidence).toBeDefined();
    expect(reply.thesisChanger).toBeDefined();
  });
});

// ─── Test: Sector Benchmark ───────────────────────────────────────────────────

describe("Saudi sector depth benchmark", () => {
  test("sector depth context names all critical Saudi sectors with causal linkage", () => {
    const result = buildInstitutionalDepthContext(
      "Which Saudi sectors should I position in?",
      mockTrackA({ macroBias: "neutral" }), mockTrackD(),
      mockConsensus(),
      true, true, "en",
    );
    expect(result.saudiDepthContext).toContain("Aramco");
    expect(result.saudiDepthContext).toContain("SABIC");
    expect(result.saudiDepthContext).toContain("banks");
    expect(result.saudiDepthContext).toContain("Vision 2030");
    expect(result.saudiDepthContext).toContain("China");
    // Must include causal rotation logic
    expect(result.depthContext).toContain("Sector rotation");
  });
});

// ─── Test: US Market + Oil + Fed Linkage Benchmark ───────────────────────────

describe("US market / oil / Fed linkage benchmark", () => {
  test("transmission chain and policy reaction injected for US market question", () => {
    const result = buildInstitutionalDepthContext(
      "What is the US market outlook given current Fed policy?",
      mockTrackA({ regime: "high_vol_risk-off", creditStressLevel: "high" }),
      mockTrackD({ primaryRisk: "Fed over-tightening into weakening earnings cycle" }),
      mockConsensus({ dominantBias: "bearish", strength: "moderate" }),
      true, false, "en",
    );
    expect(result.depthContext).toContain("Policy reaction function");
    expect(result.depthContext).toContain("Transmission chain");
    expect(result.depthContext).toContain("credit stress");
  });

  test("oil-Fed linkage: regime conflict dimension triggers for conflicted consensus", () => {
    const result = buildInstitutionalDepthContext(
      "How does oil price interact with Fed policy for equity markets?",
      mockTrackA({ regime: "macro_transition" }),
      mockTrackD(),
      mockConsensus({ strength: "conflicted", agreementScore: 42 }),
      true, false, "en",
    );
    expect(result.dimensionsInjected).toContain("regime_conflict");
    expect(result.depthContext).toContain("Conflict resolution rule");
  });
});

// ─── Test: Recession vs Rate Cuts Benchmark ──────────────────────────────────

describe("recession vs rate cuts sector benchmark", () => {
  test("sector rotation differentiates recession vs rate-cut environment", () => {
    // Bearish bias — should show defensive sector rotation
    const resultRecession = buildInstitutionalDepthContext(
      "Which sectors benefit if there is a recession?",
      mockTrackA({ macroBias: "bearish", creditStressLevel: "high" }),
      mockTrackD(),
      mockConsensus({ dominantBias: "bearish" }),
      true, false, "en",
    );
    expect(resultRecession.depthContext).toContain("Defensives");
    expect(resultRecession.depthContext).toContain("quality over momentum");

    // Bullish bias — should show risk-on rotation
    const resultCuts = buildInstitutionalDepthContext(
      "Which sectors benefit from rate cuts?",
      mockTrackA({ macroBias: "bullish", creditStressLevel: "low" }),
      mockTrackD(),
      mockConsensus({ dominantBias: "bullish", strength: "strong" }),
      true, false, "en",
    );
    expect(resultCuts.depthContext).toContain("Cyclicals");
  });
});

// ─── Test: Broad vs Selective Exposure Benchmark ─────────────────────────────

describe("broad vs selective exposure allocator benchmark", () => {
  test("allocator psychology recommends selective over broad in neutral regime", () => {
    const result = buildInstitutionalDepthContext(
      "Should I use a Saudi ETF or invest selectively?",
      mockTrackA({ macroBias: "neutral" }),
      mockTrackD(),
      mockConsensus({ strength: "weak", agreementScore: 48 }),
      true, true, "en",
    );
    expect(result.depthContext).toContain("sector selectivity");
  });

  test("Saudi conservative allocator stance covers scale-in vs avoid", () => {
    const result = buildInstitutionalDepthContext(
      "As a conservative allocator, what is my Saudi exposure strategy?",
      mockTrackA({ creditStressLevel: "moderate", macroBias: "neutral" }),
      mockTrackD(),
      mockConsensus(),
      true, true, "en",
    );
    expect(result.saudiDepthContext).toContain("Scale in gradually");
    expect(result.saudiDepthContext).toContain("Wait");
    expect(result.saudiDepthContext).toContain("Avoid");
  });
});
