import { createFileRoute } from "@tanstack/react-router";
import { getCompanyProfile } from "@/lib/company/raneemProfile";

export const Route = createFileRoute("/api/public/company/profile")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify(getCompanyProfile(), null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
