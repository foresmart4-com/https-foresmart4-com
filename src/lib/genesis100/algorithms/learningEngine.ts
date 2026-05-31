export interface DecisionOutcome {
  decisionId: string;
  symbol: string;
  action: string;
  entryDate: number;
  entryPrice: number;
  exitDate?: number;
  exitPrice?: number;
  predictedDirection: "up" | "down" | "neutral";
  predictedConfidence: number;
  stopLossPrice: number;
  targetPrice: number;
  actualPriceAfter7d?: number;
  actualPriceAfter14d?: number;
  actualPriceAfter30d?: number;
  wasCorrect?: boolean;
  pnlPercent?: number;
  hitStopLoss?: boolean;
  hitTarget?: boolean;
  schoolScoresAtDecision: Record<string, number>;
  dominantSchoolAtDecision: string;
  regimeAtDecision: string;
}

export interface SchoolPerformance {
  correct: number;
  total: number;
  accuracy: number;
  avgPnl: number;
}

export interface LearningInsights {
  overallAccuracy: number;
  totalEvaluated: number;
  schoolAccuracy: Record<string, SchoolPerformance>;
  recommendedWeightAdjustments: Record<string, number>;
  lessons: string[];
  arabicLearningReport: string;
  dataInsufficient: boolean;
}

export function analyzeLearningOutcomes(
  outcomes: DecisionOutcome[],
): LearningInsights {
  const completed = outcomes.filter(
    (o) => o.wasCorrect !== undefined,
  );

  if (completed.length < 10) {
    return {
      overallAccuracy: 0,
      totalEvaluated: completed.length,
      schoolAccuracy: {},
      recommendedWeightAdjustments: {},
      lessons: [
        "لا تزال البيانات غير كافية للتعلم.",
        `تم تقييم ${completed.length} قرار من أصل 10 مطلوبة.`,
      ],
      arabicLearningReport:
        "Genesis في مرحلة التعلم الأولية. يحتاج 10 قرارات مكتملة على الأقل لبدء التحسين الذاتي.",
      dataInsufficient: true,
    };
  }

  const schoolStats: Record<
    string,
    { correct: number; total: number; pnl: number[] }
  > = {};

  for (const outcome of completed) {
    for (const [school, score] of Object.entries(
      outcome.schoolScoresAtDecision,
    )) {
      if (!schoolStats[school]) {
        schoolStats[school] = { correct: 0, total: 0, pnl: [] };
      }
      schoolStats[school].total++;
      const predicted = score > 55;
      if (predicted === outcome.wasCorrect) {
        schoolStats[school].correct++;
      }
      if (outcome.pnlPercent !== undefined) {
        schoolStats[school].pnl.push(outcome.pnlPercent);
      }
    }
  }

  const schoolAccuracy: Record<string, SchoolPerformance> =
    Object.fromEntries(
      Object.entries(schoolStats).map(([s, st]) => [
        s,
        {
          correct: st.correct,
          total: st.total,
          accuracy: st.total > 0 ? st.correct / st.total : 0,
          avgPnl:
            st.pnl.length > 0
              ? st.pnl.reduce((a, b) => a + b, 0) / st.pnl.length
              : 0,
        },
      ]),
    );

  const baseW = 1 / 6;
  const recommendedWeightAdjustments: Record<string, number> =
    Object.fromEntries(
      Object.entries(schoolAccuracy).map(([s, st]) => [
        s,
        Math.max(
          0.05,
          Math.min(
            0.35,
            baseW +
              (st.accuracy - 0.5) * 0.2 +
              Math.sign(st.avgPnl) * 0.05,
          ),
        ),
      ]),
    );

  const overallAccuracy =
    completed.filter((o) => o.wasCorrect).length / completed.length;

  const stopLossHits = completed.filter((o) => o.hitStopLoss).length;
  const lessons: string[] = [];

  const best = Object.entries(schoolAccuracy).sort(
    (a, b) => b[1].accuracy - a[1].accuracy,
  )[0];
  if (best && best[1].accuracy > 0.65) {
    lessons.push(
      `المدرسة "${best[0]}" حققت أعلى دقة (${(best[1].accuracy * 100).toFixed(0)}%)`,
    );
  }
  if (stopLossHits / completed.length > 0.3) {
    lessons.push(
      "وقف الخسارة يُفعَّل كثيرًا — يجب إعادة النظر في مستويات الدخول",
    );
  }
  if (overallAccuracy > 0.65) {
    lessons.push(`Genesis يُحقق دقة ${(overallAccuracy * 100).toFixed(0)}% — أداء مقبول`);
  } else {
    lessons.push("الدقة الكلية تحتاج تحسين — راجع ظروف السوق");
  }

  const arabicLearningReport = [
    "📚 تقرير التعلم الذاتي لـ Genesis",
    `📊 إجمالي القرارات المُقيَّمة: ${completed.length}`,
    `✅ دقة التوقعات: ${(overallAccuracy * 100).toFixed(1)}%`,
    `🛑 قرارات أُوقف خسارتها: ${stopLossHits} (${((stopLossHits / completed.length) * 100).toFixed(0)}%)`,
    "",
    "🏫 أداء المدارس:",
    ...Object.entries(schoolAccuracy)
      .sort((a, b) => b[1].accuracy - a[1].accuracy)
      .map(
        ([s, st]) =>
          `  • ${s}: ${(st.accuracy * 100).toFixed(0)}% دقة | متوسط ربح: ${st.avgPnl.toFixed(2)}%`,
      ),
    "",
    "💡 الدروس:",
    ...lessons.map((l) => `  • ${l}`),
    "",
    "⚠️ هذا تحليل تعليمي. الأداء السابق لا يضمن المستقبل.",
  ].join("\n");

  return {
    overallAccuracy,
    totalEvaluated: completed.length,
    schoolAccuracy,
    recommendedWeightAdjustments,
    lessons,
    arabicLearningReport,
    dataInsufficient: false,
  };
}
