
-- Deny all client access to email_send_state (service_role policy remains)
CREATE POLICY "deny client read email_send_state"
  ON public.email_send_state
  AS RESTRICTIVE
  FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY "deny client insert email_send_state"
  ON public.email_send_state
  AS RESTRICTIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "deny client update email_send_state"
  ON public.email_send_state
  AS RESTRICTIVE
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "deny client delete email_send_state"
  ON public.email_send_state
  AS RESTRICTIVE
  FOR DELETE
  TO anon, authenticated
  USING (false);
