// Phase-85A: Arabic Semantic Validation Runner
// Run with: node_modules/.bin/tsx scripts/validate-arabic-semantic.ts

import {
  runArabicValidation,
  detectArabicDirection,
  detectArabicPolicyStance,
  detectArabicOilSignal,
  detectArabicAllocationStance,
  isArabicDominant,
  detectArabicInvalidationActive,
} from "../src/services/institutional/arabicSemanticReasoningEngine";

// ─── Run built-in validation suite ───────────────────────────────────────────
console.log("\n=== Arabic Semantic Engine Validation (Phase-85A) ===\n");
const result = runArabicValidation();
for (const c of result.cases) {
  const icon = c.passed ? "✓" : "✗";
  const details = Object.entries(c.actual).map(([k, v]) => `${k}=${v}`).join(" ");
  console.log(`  ${icon} ${c.id}  actual: ${details}`);
}
console.log(`\nResult: ${result.passed}/${result.passed + result.failed} passed\n`);

// ─── Additional spot checks ───────────────────────────────────────────────────
const checks: [string, string, unknown, unknown][] = [
  // [label, text, expected, actual]
  ["direction-detection: neutral",
    "السوق محايد في انتظار تقييم إضافي مع ترقب البيانات",
    "neutral",
    detectArabicDirection("السوق محايد في انتظار تقييم إضافي مع ترقب البيانات"),
  ],
  ["policy-detection: holding",
    "ساما قررت الإبقاء على الأسعار بلا تغيير مع استقرار السياسة",
    "holding",
    detectArabicPolicyStance("ساما قررت الإبقاء على الأسعار بلا تغيير مع استقرار السياسة"),
  ],
  ["oil-detection: below_breakeven",
    "النفط دون نقطة التعادل للميزانية السعودية مما يضغط على الإيرادات",
    "below_breakeven",
    detectArabicOilSignal("النفط دون نقطة التعادل للميزانية السعودية مما يضغط على الإيرادات"),
  ],
  ["allocator-stance: scale_in",
    "نوصي بشراء تدريجي وبناء مركز في الأسهم السعودية مع دخول تدريجي للقطاع",
    "scale_in",
    detectArabicAllocationStance("نوصي بشراء تدريجي وبناء مركز في الأسهم السعودية مع دخول تدريجي للقطاع"),
  ],
  ["allocator-stance: avoid",
    "ننصح بتجنب القطاع وخفض التعرض مع الخروج من المراكز",
    "avoid",
    detectArabicAllocationStance("ننصح بتجنب القطاع وخفض التعرض مع الخروج من المراكز"),
  ],
  ["isArabicDominant: true",
    "السوق السعودي يتجه نحو الصعود",
    true,
    isArabicDominant("السوق السعودي يتجه نحو الصعود"),
  ],
  ["isArabicDominant: false for English",
    "The Saudi market is bullish",
    false,
    isArabicDominant("The Saudi market is bullish"),
  ],
  ["invalidation-detection: true (2+ shared kw)",
    "المستوى الحرج اختُرق بشكل واضح مع انهيار الدعم",
    true,
    detectArabicInvalidationActive(
      "المستوى الحرج اختُرق بشكل واضح مع انهيار الدعم",
      "خرق المستوى الحرج يُلغي الأطروحة",
    ),
  ],
  ["invalidation-detection: false (no signal)",
    "السوق هادئ اليوم",
    false,
    detectArabicInvalidationActive(
      "السوق هادئ اليوم",
      "خرق المستوى الحرج يُلغي الأطروحة",
    ),
  ],
];

console.log("=== Additional spot checks ===\n");
let spotPassed = 0;
for (const [label, , expected, actual] of checks) {
  const pass = actual === expected;
  if (pass) spotPassed++;
  const icon = pass ? "✓" : "✗";
  console.log(`  ${icon} ${label}`);
  if (!pass) console.log(`      expected=${expected}  actual=${actual}`);
}
console.log(`\nSpot checks: ${spotPassed}/${checks.length} passed\n`);

const totalPassed = result.passed + spotPassed;
const totalAll = (result.passed + result.failed) + checks.length;
console.log(`=== TOTAL: ${totalPassed}/${totalAll} ===\n`);

if (result.failed > 0 || spotPassed < checks.length) {
  process.exit(1);
}
