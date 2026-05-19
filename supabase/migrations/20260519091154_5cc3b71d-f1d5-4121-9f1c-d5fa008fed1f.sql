
-- 1) Audit log for API key operations (no key content stored, ever)
CREATE TABLE IF NOT EXISTS public.api_key_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('add','remove','test')),
  provider TEXT NOT NULL,
  result TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_key_audit_user_created
  ON public.api_key_audit (user_id, created_at DESC);

ALTER TABLE public.api_key_audit ENABLE ROW LEVEL SECURITY;

-- Only the owning user (or admins) can READ their audit rows
CREATE POLICY "users read own api key audit"
  ON public.api_key_audit FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Restrictive: clients can NEVER write, update, or delete audit rows
CREATE POLICY "deny client writes api_key_audit insert"
  ON public.api_key_audit AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (false);
CREATE POLICY "deny client writes api_key_audit update"
  ON public.api_key_audit AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY "deny client writes api_key_audit delete"
  ON public.api_key_audit AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (false);

CREATE POLICY "service_role manages api_key_audit"
  ON public.api_key_audit FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 2) Add last-used / last-test tracking columns to user_api_keys
ALTER TABLE public.user_api_keys
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_test_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_test_result TEXT,
  ADD COLUMN IF NOT EXISTS last_test_error TEXT;

-- 3) Explicit RESTRICTIVE deny-all SELECT on sensitive API-key tables.
-- These act as a hard floor even if a future permissive policy is added.
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hard deny anon select user_api_keys" ON public.user_api_keys;
CREATE POLICY "hard deny anon select user_api_keys"
  ON public.user_api_keys AS RESTRICTIVE FOR SELECT TO anon
  USING (false);

DROP POLICY IF EXISTS "hard deny anon all user_api_keys" ON public.user_api_keys;
CREATE POLICY "hard deny anon all user_api_keys"
  ON public.user_api_keys AS RESTRICTIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "hard deny anon select broker_credentials" ON public.broker_credentials;
CREATE POLICY "hard deny anon select broker_credentials"
  ON public.broker_credentials AS RESTRICTIVE FOR SELECT TO anon
  USING (false);

DROP POLICY IF EXISTS "hard deny anon all broker_credentials" ON public.broker_credentials;
CREATE POLICY "hard deny anon all broker_credentials"
  ON public.broker_credentials AS RESTRICTIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

-- Restrictive: authenticated users may only SELECT rows they own on broker_credentials
DROP POLICY IF EXISTS "broker_credentials authenticated own-only select" ON public.broker_credentials;
CREATE POLICY "broker_credentials authenticated own-only select"
  ON public.broker_credentials AS RESTRICTIVE FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Restrictive: authenticated users may only touch their own user_api_keys rows
DROP POLICY IF EXISTS "user_api_keys authenticated own-only all" ON public.user_api_keys;
CREATE POLICY "user_api_keys authenticated own-only all"
  ON public.user_api_keys AS RESTRICTIVE FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
