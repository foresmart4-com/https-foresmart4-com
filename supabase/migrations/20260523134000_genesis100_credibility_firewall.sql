-- ForeSmart Genesis 100 credibility/firewall archive fields.
-- Audit-only persistence scaffold; real execution remains blocked.

ALTER TABLE public.genesis100_decision_archive
  ADD COLUMN IF NOT EXISTS source_credibility_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_credibility_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS market_confirmation_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_approval_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_approval_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS intelligence_version text NOT NULL DEFAULT 'genesis-intelligence-v2';

CREATE INDEX IF NOT EXISTS idx_genesis100_archive_final_approval
  ON public.genesis100_decision_archive(final_approval_percent DESC);
