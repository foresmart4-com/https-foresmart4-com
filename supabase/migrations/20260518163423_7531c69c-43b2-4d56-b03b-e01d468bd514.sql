
-- 1) bank_account_secrets — add explicit service_role-only policies (currently no policies)
CREATE POLICY "service_role manages bank secrets"
  ON public.bank_account_secrets
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "deny anon/authenticated bank secrets"
  ON public.bank_account_secrets
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- 2) subscriptions — remove permissive self-insert; only admin/service_role may write
DROP POLICY IF EXISTS "own subscription insert" ON public.subscriptions;

-- Make the restrictive blocks cover public (anon + authenticated), not just authenticated
DROP POLICY IF EXISTS "block non-admin subscription inserts" ON public.subscriptions;
DROP POLICY IF EXISTS "block non-admin subscription updates" ON public.subscriptions;
DROP POLICY IF EXISTS "block non-admin subscription deletes" ON public.subscriptions;

CREATE POLICY "block non-admin subscription inserts"
  ON public.subscriptions AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR auth.role() = 'service_role');

CREATE POLICY "block non-admin subscription updates"
  ON public.subscriptions AS RESTRICTIVE FOR UPDATE TO public
  USING (has_role(auth.uid(), 'admin'::app_role) OR auth.role() = 'service_role')
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR auth.role() = 'service_role');

CREATE POLICY "block non-admin subscription deletes"
  ON public.subscriptions AS RESTRICTIVE FOR DELETE TO public
  USING (has_role(auth.uid(), 'admin'::app_role) OR auth.role() = 'service_role');

-- 3) interest_leads — explicit deny SELECT to anon (INSERT remains allowed for the public form)
CREATE POLICY "deny anon read interest leads"
  ON public.interest_leads AS RESTRICTIVE FOR SELECT TO anon
  USING (false);

-- 4) autonomous_sessions, execution_history, risk_events — enforce server-side writes only
CREATE POLICY "deny client writes autonomous_sessions"
  ON public.autonomous_sessions AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "deny client updates autonomous_sessions"
  ON public.autonomous_sessions AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "deny client deletes autonomous_sessions"
  ON public.autonomous_sessions AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "deny client writes execution_history"
  ON public.execution_history AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "deny client updates execution_history"
  ON public.execution_history AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "deny client deletes execution_history"
  ON public.execution_history AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "deny client writes risk_events"
  ON public.risk_events AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "deny client updates risk_events"
  ON public.risk_events AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "deny client deletes risk_events"
  ON public.risk_events AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role));
