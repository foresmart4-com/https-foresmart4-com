import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/test-email")({
  server: {
    handlers: {
      GET: async () => {
        const { sendTestEmail } = await import("@/lib/email/resend.server");
        const to = process.env.SMTP_USER ?? "Ayyaf08@hotmail.com";
        const result = await sendTestEmail(to, "ar");
        return new Response(JSON.stringify(result, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
