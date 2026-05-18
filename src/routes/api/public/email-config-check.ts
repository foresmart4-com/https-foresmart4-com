import { createFileRoute } from "@tanstack/react-router";
import { PRIMARY_SENDER } from "@/lib/email/resend.server";

export const Route = createFileRoute("/api/public/email-config-check")({
  server: {
    handlers: {
      GET: async () => {
        const key = process.env.RESEND_API_KEY ?? "";
        return new Response(
          JSON.stringify({
            configured: !!key,
            keyPrefix: key ? key.slice(0, 4) : null,
            keyLength: key.length,
            sender: PRIMARY_SENDER,
            runtime: "production",
            timestamp: new Date().toISOString(),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
