-- 1) interest_leads: explicitly restrict authenticated reads to admins only.
DROP POLICY IF EXISTS "authenticated admins read interest leads" ON public.interest_leads;
CREATE POLICY "authenticated admins read interest leads"
  ON public.interest_leads
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) ai_decisions: explicitly deny browser-side writes to preserve audit integrity.
DROP POLICY IF EXISTS "deny client inserts ai decisions" ON public.ai_decisions;
DROP POLICY IF EXISTS "deny client updates ai decisions" ON public.ai_decisions;
DROP POLICY IF EXISTS "deny client deletes ai decisions" ON public.ai_decisions;

CREATE POLICY "deny client inserts ai decisions"
  ON public.ai_decisions
  AS RESTRICTIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "deny client updates ai decisions"
  ON public.ai_decisions
  AS RESTRICTIVE
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "deny client deletes ai decisions"
  ON public.ai_decisions
  AS RESTRICTIVE
  FOR DELETE
  TO anon, authenticated
  USING (false);

-- 3) portfolio_snapshots: explicitly deny browser-side writes to preserve snapshot integrity.
DROP POLICY IF EXISTS "deny client inserts portfolio snapshots" ON public.portfolio_snapshots;
DROP POLICY IF EXISTS "deny client updates portfolio snapshots" ON public.portfolio_snapshots;
DROP POLICY IF EXISTS "deny client deletes portfolio snapshots" ON public.portfolio_snapshots;

CREATE POLICY "deny client inserts portfolio snapshots"
  ON public.portfolio_snapshots
  AS RESTRICTIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "deny client updates portfolio snapshots"
  ON public.portfolio_snapshots
  AS RESTRICTIVE
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "deny client deletes portfolio snapshots"
  ON public.portfolio_snapshots
  AS RESTRICTIVE
  FOR DELETE
  TO anon, authenticated
  USING (false);

-- 4) user_api_keys: move away from user-readable plaintext keys.
ALTER TABLE public.user_api_keys
  ADD COLUMN IF NOT EXISTS encrypted_api_key text,
  ADD COLUMN IF NOT EXISTS iv text,
  ADD COLUMN IF NOT EXISTS auth_tag text,
  ADD COLUMN IF NOT EXISTS key_hint text;

-- Existing plaintext keys cannot be safely encrypted in-database without exposing an encryption key.
-- Preserve only a masked hint and remove the full plaintext value.
UPDATE public.user_api_keys
SET key_hint = CASE
    WHEN api_key IS NULL OR length(api_key) < 8 THEN '••••••••'
    ELSE left(api_key, 4) || '••••' || right(api_key, 4)
  END,
  api_key = '__migrated_to_encrypted_storage__'
WHERE encrypted_api_key IS NULL;

ALTER TABLE public.user_api_keys
  ALTER COLUMN encrypted_api_key SET NOT NULL,
  ALTER COLUMN iv SET NOT NULL,
  ALTER COLUMN auth_tag SET NOT NULL,
  ALTER COLUMN key_hint SET NOT NULL,
  DROP COLUMN IF EXISTS api_key;

-- Keep owner-scoped access for key metadata/encrypted material; application code only returns masked hints.
DROP POLICY IF EXISTS "own keys all" ON public.user_api_keys;
CREATE POLICY "own keys all"
  ON public.user_api_keys
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);