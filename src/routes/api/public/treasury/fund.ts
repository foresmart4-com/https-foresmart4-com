import { createFileRoute } from "@tanstack/react-router";
import { fundTreasury } from "@/lib/treasury/treasury";

export const Route = createFileRoute("/api/public/treasury/fund")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { amount?: number; source?: string; reference?: string; notes?: string } = {};
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }, null, 2), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { amount, source, reference, notes } = body;
        if (typeof amount !== "number" || !source || !reference) {
          return new Response(JSON.stringify({ success: false, error: "Missing required fields: amount, source, reference" }, null, 2), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const result = fundTreasury(
          amount,
          source as "manual_corporate" | "company_bank_transfer" | "treasury_adjustment",
          reference,
          notes ?? "",
        );

        return new Response(JSON.stringify({
          product: "ForeSmart",
          ...result,
          adminOnly: true,
          liveExecutionEnabled: false,
        }, null, 2), {
          status: result.success ? 200 : 400,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
