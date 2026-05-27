-- ForeSmart Genesis 100 position sizing archive fields.
-- Real execution remains blocked; these fields support audit/reporting only.

ALTER TABLE public.genesis100_decision_archive
  ADD COLUMN IF NOT EXISTS decision_credibility_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credibility_tier text,
  ADD COLUMN IF NOT EXISTS allocation_multiplier numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_mode text,
  ADD COLUMN IF NOT EXISTS max_single_decision_capital_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allowed_capital_for_decision numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS position_sizing_reason_ar text,
  ADD COLUMN IF NOT EXISTS position_sizing_reason_en text,
  ADD COLUMN IF NOT EXISTS stop_loss_urgency text,
  ADD COLUMN IF NOT EXISTS action_allowed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_genesis100_archive_credibility_tier
  ON public.genesis100_decision_archive(credibility_tier);
