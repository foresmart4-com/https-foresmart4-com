import { createFileRoute } from "@tanstack/react-router";
import { runConsensus } from "@/lib/ai/consensus/consensusEngine";
import { AI_SAFETY_FLAGS } from "@/lib/ai/core/safety";

const SYMBOLS = ["AAPL", "BTCUSDT", "WTI", "2222.SR"];

export const Route = createFileRoute("/api/ai/agents/portfolio-debate")({
  server: {
    handlers: {
      GET: async () => {
        const results = await Promise.all(SYMBOLS.map((symbol) => runConsensus(symbol)));
        return new Response(JSON.stringify({
          symbols: SYMBOLS,
          debates: results.map((result, index) => ({ symbol: SYMBOLS[index], consensus: result.consensus })),
          summaryAr: "نقاش محفظة متعدد الوكلاء للقراءة فقط. لا توجد أوامر تنفيذ أو نقل أموال.",
          ...AI_SAFETY_FLAGS,
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
