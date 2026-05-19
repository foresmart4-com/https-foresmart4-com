DROP POLICY IF EXISTS "users read own broker creds" ON public.broker_credentials;
CREATE POLICY "users read own broker creds" ON public.broker_credentials
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "deny anon wallet_tx" ON public.wallet_transactions;
CREATE POLICY "deny anon wallet_tx" ON public.wallet_transactions
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "users read own disclaimer" ON public.disclaimer_acceptances;
CREATE POLICY "users read own disclaimer" ON public.disclaimer_acceptances
  FOR SELECT TO authenticated USING (auth.uid() = user_id);