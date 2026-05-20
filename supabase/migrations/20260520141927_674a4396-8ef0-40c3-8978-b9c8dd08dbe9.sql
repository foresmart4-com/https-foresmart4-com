-- Remove client-side write policies on user_api_keys; all writes now go through
-- server functions using the service role. Authenticated users still cannot read
-- raw key material (block-reads policy remains).
DROP POLICY IF EXISTS "own keys all" ON public.user_api_keys;
DROP POLICY IF EXISTS "user_api_keys authenticated own-only all" ON public.user_api_keys;

-- Explicit deny for authenticated client writes (defense in depth).
CREATE POLICY "deny client insert user_api_keys"
  ON public.user_api_keys AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (false);
CREATE POLICY "deny client update user_api_keys"
  ON public.user_api_keys AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY "deny client delete user_api_keys"
  ON public.user_api_keys AS RESTRICTIVE FOR DELETE TO authenticated
  USING (false);