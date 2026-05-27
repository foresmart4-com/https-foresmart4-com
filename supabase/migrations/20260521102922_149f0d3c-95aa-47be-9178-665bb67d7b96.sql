-- Defense-in-depth: explicitly deny client inserts on interest_leads.
-- Lead submission must go through submitInterestLead server fn (uses service role + rate limit).
CREATE POLICY "deny client inserts interest_leads"
ON public.interest_leads
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);