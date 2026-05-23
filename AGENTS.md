# AGENTS.md

## Cursor Cloud specific instructions

### Overview

ForeSmart is an Arabic RTL investment analysis platform built with React 19, TanStack Start (SSR), Vite 7, and Tailwind CSS v4. The backend is hosted Supabase (no local DB setup needed). Most market data / AI / payment features use mock data with architecture ready for real provider integration.

### Package manager

This project uses **Bun** (lockfile: `bun.lock`). Install Bun via `curl -fsSL https://bun.sh/install | bash` if not present, then ensure `~/.bun/bin` is on `PATH`.

### Key commands

| Task | Command |
|------|---------|
| Install deps | `bun install` |
| Dev server | `bun run dev` (Vite, serves on port 8080) |
| Build | `bun run build` |
| Lint | `bun run lint` (ESLint + Prettier) |
| Format | `bun run format` (Prettier auto-fix) |

### Dev server notes

- The Vite dev server binds to port **8080** (configured via `@lovable.dev/vite-tanstack-config`).
- Supabase env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) are committed in `.env` — the app starts without extra secrets.
- Protected routes (e.g. `/dashboard`, `/markets`) require Supabase auth; the landing page (`/`) and auth page (`/auth`) work without credentials.

### Lint status

The codebase has ~12k pre-existing Prettier formatting warnings/errors. These are not caused by environment issues. Running `bun run lint` exits non-zero due to these; this is expected.

### Environment variables

- Required for dev: already in `.env` (Supabase URL + anon key).
- Optional: `SUPABASE_SERVICE_ROLE_KEY` (server functions), `RESEND_API_KEY` (email), `LOVABLE_API_KEY` (AI), various market-data API keys. See `README_FORESMART.md` for full list.

### No automated test suite

This codebase does not include a test runner or automated test files. Validation is done via lint and manual testing.
