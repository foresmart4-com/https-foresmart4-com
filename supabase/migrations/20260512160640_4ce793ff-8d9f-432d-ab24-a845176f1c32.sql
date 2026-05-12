
-- Wallets: block non-admin UPDATE/DELETE (keep SELECT and INSERT via existing permissive policy)
CREATE POLICY "block non-admin wallet updates"
ON public.wallets AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "block non-admin wallet deletes"
ON public.wallets AS RESTRICTIVE
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Wallet transactions: block non-admin INSERT/UPDATE/DELETE (keep SELECT)
CREATE POLICY "block non-admin tx inserts"
ON public.wallet_transactions AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "block non-admin tx updates"
ON public.wallet_transactions AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "block non-admin tx deletes"
ON public.wallet_transactions AS RESTRICTIVE
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Subscriptions: block non-admin INSERT/UPDATE/DELETE (keep SELECT)
CREATE POLICY "block non-admin subscription inserts"
ON public.subscriptions AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "block non-admin subscription updates"
ON public.subscriptions AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "block non-admin subscription deletes"
ON public.subscriptions AS RESTRICTIVE
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
