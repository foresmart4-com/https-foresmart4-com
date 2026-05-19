// Server-only allowlist guard for any URL we forward to a third-party redirect
// (Stripe, Moyasar, Supabase generateLink, etc.). Blocks open-redirect abuse.

const ALLOWED_ORIGINS = new Set<string>([
  "https://foresmart4.store",
  "https://www.foresmart4.store",
  "https://foresmart4.com",
  "https://www.foresmart4.com",
  "https://https-foresmart4-com.lovable.app",
  "https://id-preview--5a68377c-93dc-42f4-9999-fc0850af1ae2.lovable.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
]);

export function assertSafeReturnUrl(url: string): string {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("Invalid returnUrl"); }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("Invalid returnUrl protocol");
  }
  if (!ALLOWED_ORIGINS.has(parsed.origin)) {
    throw new Error(`returnUrl origin not allowed: ${parsed.origin}`);
  }
  return parsed.toString();
}
