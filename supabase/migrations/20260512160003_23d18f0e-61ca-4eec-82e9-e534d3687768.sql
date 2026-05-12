
-- Explicit RESTRICTIVE policies blocking non-admin UPDATE/DELETE on wallet_topups
CREATE POLICY "block non-admin topup updates"
  ON public.wallet_topups
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "block non-admin topup deletes"
  ON public.wallet_topups
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
