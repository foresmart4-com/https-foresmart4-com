-- Distributed rate limit counters, authoritative across workers.
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  bucket_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- Deny-all to anon/authenticated; only service role (server) can touch.
CREATE POLICY "rate_limit_counters_deny_all"
  ON public.rate_limit_counters
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS rate_limit_counters_window_idx
  ON public.rate_limit_counters (window_start);

-- Atomic increment-and-return. Returns the post-increment count for the
-- current window (window_seconds-wide tumbling window).
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  _bucket_key TEXT,
  _window_seconds INTEGER,
  _max_hits INTEGER
)
RETURNS TABLE(current_count INTEGER, allowed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_start TIMESTAMPTZ;
  _count INTEGER;
BEGIN
  _window_start := date_trunc('second', now())
    - (EXTRACT(EPOCH FROM now())::BIGINT % _window_seconds) * interval '1 second';

  INSERT INTO public.rate_limit_counters AS r (bucket_key, window_start, count)
  VALUES (_bucket_key, _window_start, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET count = r.count + 1
  RETURNING r.count INTO _count;

  -- Opportunistic GC of old rows (keep 1h history).
  DELETE FROM public.rate_limit_counters
   WHERE window_start < now() - interval '1 hour';

  RETURN QUERY SELECT _count, _count <= _max_hits;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_hit(TEXT, INTEGER, INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(TEXT, INTEGER, INTEGER) TO service_role;