import { createFileRoute } from "@tanstack/react-router";
import { allProvidersHealth, selectMarketProvider, selectMacroProvider } from "@/services/providers";

const BUILD_TIME = new Date().toISOString();

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        let providerStatus: Record<string, unknown> = {};
        let marketProvider = "unknown";
        let macroProvider = "unknown";
        try {
          providerStatus = allProvidersHealth();
          marketProvider = selectMarketProvider();
          macroProvider = selectMacroProvider();
        } catch { /* providers may not be available */ }

        let dbStatus = "unknown";
        try {
          const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
          dbStatus = supabaseUrl ? "configured" : "not_configured";
        } catch { dbStatus = "error"; }

        return new Response(JSON.stringify({
          ok: true,
          product: "ForeSmart",
          commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? "local",
          buildTime: BUILD_TIME,
          environment: process.env.RAILWAY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
          database: { status: dbStatus },
          providers: providerStatus,
          activeMarketProvider: marketProvider,
          activeMacroProvider: macroProvider,
          apis: {
            supabase: dbStatus,
            genesis100: "active",
            treasury: "active",
            broker: "paper_only",
          },
          repairPack: "root-fix-v4",
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
