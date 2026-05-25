import { createFileRoute } from "@tanstack/react-router";
import { vaultStatus } from "@/services/security/encryption";

// Health probe — returns only whether the vault key is configured.
// Never reveals key content, length, or any secret material.
export const Route = createFileRoute("/api/public/vault-status")({
  server: {
    handlers: {
      GET: async () => {
        const { ok } = vaultStatus();
        return new Response(JSON.stringify({ configured: ok }), {
          status: ok ? 200 : 503,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
