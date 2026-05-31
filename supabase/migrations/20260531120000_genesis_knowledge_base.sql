-- Genesis Knowledge Base — persistent summaries for the 24/7 learning system.
-- Stores compact AI-generated summaries (max 500 chars) from external sources.
-- Full documents are never stored; only distilled insights.

CREATE TABLE IF NOT EXISTS public.genesis_knowledge_base (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category    text        NOT NULL,
  title       text        NOT NULL,
  summary     text        NOT NULL,
  source      text        NOT NULL,
  source_url  text,
  valid_until timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_genesis_kb_category
  ON public.genesis_knowledge_base(category);

CREATE INDEX IF NOT EXISTS idx_genesis_kb_valid_until
  ON public.genesis_knowledge_base(valid_until);

CREATE INDEX IF NOT EXISTS idx_genesis_kb_created_at
  ON public.genesis_knowledge_base(created_at DESC);

ALTER TABLE public.genesis_knowledge_base ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny client access genesis_knowledge_base"
  ON public.genesis_knowledge_base;

CREATE POLICY "deny client access genesis_knowledge_base"
  ON public.genesis_knowledge_base FOR ALL TO authenticated
  USING (false);
