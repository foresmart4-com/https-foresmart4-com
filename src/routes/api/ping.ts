import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/ping")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          JSON.stringify({
            ok: true,
            source: "tanstack-server",
            apiRouting: true,
            commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? "unknown",
            timestamp: new Date().toISOString(),
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store, no-cache, must-revalidate",
            },
          },
        );
      },
    },
  },
});
