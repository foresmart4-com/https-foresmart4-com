import { createFileRoute } from "@tanstack/react-router";

const BUILD_TIME = new Date().toISOString();
const BUILD_COMMIT = typeof process !== "undefined"
  ? (process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? "local")
  : "local";

export const Route = createFileRoute("/api/public/version")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({
          commit: BUILD_COMMIT,
          buildTime: BUILD_TIME,
          environment: process.env.RAILWAY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
          branch: process.env.RAILWAY_GIT_BRANCH ?? "main",
          product: "ForeSmart",
          repairPack: "root-fix-v4",
        }, null, 2), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
