// Server-side Supabase client with service role key — bypasses RLS.
// Use this for admin operations in server functions and server routes only.
// For user-authenticated queries (with RLS), use the auth middleware instead.
// For access gate / role detection, use supabase.rpc("current_role") with the
// publishable key — SUPABASE_SERVICE_ROLE_KEY is NOT required for that path.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const _url = process.env.SUPABASE_URL;
const _serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Warn exactly once at module startup so Railway logs are not flooded.
// Privileged server operations (payments, email, admin writes) will throw at
// their individual call site. Auth / access-gate checks use the publishable
// key via the client SDK and are entirely unaffected.
if (_url && !_serviceKey) {
  console.warn(
    "[Supabase] SUPABASE_SERVICE_ROLE_KEY is not set. " +
    "Privileged server operations will throw if invoked. " +
    "Auth and access-gate checks use the publishable key and are unaffected.",
  );
}

// Cached success client or the first-time error (avoids re-logging on every call).
let _supabaseAdmin: ReturnType<typeof createClient<Database>> | null = null;
let _initError: Error | null = null;

function getAdminClient(): ReturnType<typeof createClient<Database>> {
  if (_supabaseAdmin) return _supabaseAdmin;

  // Re-throw the cached error so every subsequent call gets the same error
  // without producing a new console log.
  if (_initError) throw _initError;

  if (!_url) {
    _initError = new Error("[Supabase] SUPABASE_URL is required for server operations.");
    throw _initError;
  }

  if (!_serviceKey) {
    _initError = new Error(
      "[Supabase] SUPABASE_SERVICE_ROLE_KEY is required for this privileged server operation " +
      "but is not set in this environment. Set it in Railway → Variables.",
    );
    throw _initError;
  }

  _supabaseAdmin = createClient<Database>(_url, _serviceKey, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _supabaseAdmin;
}

// Server-side Supabase client with service role — bypasses RLS.
// SECURITY: Only use this for trusted server-side operations, never expose to client code.
// Import like: import { supabaseAdmin } from "@/integrations/supabase/client.server";
// Throws at call time (not at import time) if SUPABASE_SERVICE_ROLE_KEY is absent.
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_, prop, receiver) {
    return Reflect.get(getAdminClient(), prop, receiver);
  },
});
