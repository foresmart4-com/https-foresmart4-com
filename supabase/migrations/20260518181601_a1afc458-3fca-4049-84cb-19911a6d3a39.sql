
-- 1) interest_leads: block non-admin authenticated reads
DROP POLICY IF EXISTS "Only admins can read interest leads" ON public.interest_leads;
CREATE POLICY "Only admins can read interest leads"
ON public.interest_leads
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) ai_decisions: explicit deny of writes to anon/authenticated (service_role bypasses RLS)
DROP POLICY IF EXISTS "No client writes on ai_decisions" ON public.ai_decisions;
CREATE POLICY "No client writes on ai_decisions"
ON public.ai_decisions
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- Re-create owner SELECT (keep existing read rule intact)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='ai_decisions' AND policyname='Users can read own ai decisions'
  ) THEN
    CREATE POLICY "Users can read own ai decisions"
      ON public.ai_decisions FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3) portfolio_snapshots: explicit deny of writes to anon/authenticated
DROP POLICY IF EXISTS "No client writes on portfolio_snapshots" ON public.portfolio_snapshots;
CREATE POLICY "No client writes on portfolio_snapshots"
ON public.portfolio_snapshots
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- 4) user_api_keys: block direct client reads of api_key (only server returns it at creation)
DROP POLICY IF EXISTS "Block client reads of user_api_keys" ON public.user_api_keys;
CREATE POLICY "Block client reads of user_api_keys"
ON public.user_api_keys
AS RESTRICTIVE
FOR SELECT
TO anon, authenticated
USING (false);
