-- Defense-in-depth: explicitly deny anon/authenticated client access to sensitive email tables.
-- Service role retains full access via existing policies.

CREATE POLICY "deny client read email_send_log"
ON public.email_send_log
AS RESTRICTIVE FOR SELECT TO anon, authenticated
USING (false);

CREATE POLICY "deny client write email_send_log insert"
ON public.email_send_log
AS RESTRICTIVE FOR INSERT TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "deny client write email_send_log update"
ON public.email_send_log
AS RESTRICTIVE FOR UPDATE TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "deny client write email_send_log delete"
ON public.email_send_log
AS RESTRICTIVE FOR DELETE TO anon, authenticated
USING (false);

CREATE POLICY "deny client read suppressed_emails"
ON public.suppressed_emails
AS RESTRICTIVE FOR SELECT TO anon, authenticated
USING (false);

CREATE POLICY "deny client write suppressed_emails insert"
ON public.suppressed_emails
AS RESTRICTIVE FOR INSERT TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "deny client write suppressed_emails update"
ON public.suppressed_emails
AS RESTRICTIVE FOR UPDATE TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "deny client write suppressed_emails delete"
ON public.suppressed_emails
AS RESTRICTIVE FOR DELETE TO anon, authenticated
USING (false);

CREATE POLICY "deny client read email_unsubscribe_tokens"
ON public.email_unsubscribe_tokens
AS RESTRICTIVE FOR SELECT TO anon, authenticated
USING (false);

CREATE POLICY "deny client write email_unsubscribe_tokens insert"
ON public.email_unsubscribe_tokens
AS RESTRICTIVE FOR INSERT TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "deny client write email_unsubscribe_tokens update"
ON public.email_unsubscribe_tokens
AS RESTRICTIVE FOR UPDATE TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "deny client write email_unsubscribe_tokens delete"
ON public.email_unsubscribe_tokens
AS RESTRICTIVE FOR DELETE TO anon, authenticated
USING (false);