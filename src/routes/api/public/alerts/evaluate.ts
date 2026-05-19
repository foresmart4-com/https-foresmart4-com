import { createFileRoute } from "@tanstack/react-router";
import { runEvaluation } from "@/lib/observability/observability.functions";

// Public endpoint for scheduled evaluation. Requires shared secret header.
// Configure secret OBSERVABILITY_CRON_SECRET and call from pg_cron / uptime
// monitor with header `x-cron-secret: <secret>`.
export const Route = createFileRoute("/api/public/alerts/evaluate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.OBSERVABILITY_CRON_SECRET;
        const provided = request.headers.get("x-cron-secret");
        if (!secret || provided !== secret) {
          return new Response("forbidden", { status: 403 });
        }
        try {
          const result = await runEvaluation();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          return Response.json(
            { ok: false, error: (e as Error).message },
            { status: 500 },
          );
        }
      },
    },
  },
});
