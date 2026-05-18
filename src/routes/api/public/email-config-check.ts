import { createFileRoute } from "@tanstack/react-router";

// Minimal health probe — returns only whether email is configured.
// Does NOT leak key prefix, length, sender, or runtime metadata.
export const Route = createFileRoute("/api/public/email-config-check")({
  server: {
    handlers: {
      GET: async () => {
        const configured = !!process.env.RESEND_API_KEY;
        return new Response(JSON.stringify({ configured }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
