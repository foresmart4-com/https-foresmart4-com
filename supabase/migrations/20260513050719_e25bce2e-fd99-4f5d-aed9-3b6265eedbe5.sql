CREATE OR REPLACE FUNCTION public.wallet_credit_topup(
  _topup_id uuid,
  _payment_id text,
  _payment_method text
)
RETURNS TABLE(credited boolean, wallet_id uuid, user_id uuid, amount numeric)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _topup public.wallet_topups%ROWTYPE;
  _wallet public.wallets%ROWTYPE;
BEGIN
  -- Atomic guard: only one concurrent webhook will succeed.
  UPDATE public.wallet_topups
  SET status = 'paid',
      moyasar_payment_id = _payment_id,
      payment_method = _payment_method,
      updated_at = now()
  WHERE id = _topup_id
    AND status = 'pending'
  RETURNING * INTO _topup;

  IF _topup.id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::numeric;
    RETURN;
  END IF;

  -- Ensure wallet exists, then increment atomically.
  INSERT INTO public.wallets (user_id, currency, balance)
  VALUES (_topup.user_id, 'SAR', 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.wallets
  SET balance = balance + _topup.net_credit_sar,
      updated_at = now()
  WHERE user_id = _topup.user_id
  RETURNING * INTO _wallet;

  INSERT INTO public.wallet_transactions(
    user_id, wallet_id, type, amount, currency, status, reference, metadata
  ) VALUES (
    _topup.user_id, _wallet.id, 'deposit', _topup.net_credit_sar, 'SAR',
    'completed', _payment_id,
    jsonb_build_object(
      'gross', _topup.amount_sar,
      'moyasar_fee', _topup.moyasar_fee_sar,
      'service_fee', _topup.service_fee_sar
    )
  );

  RETURN QUERY SELECT true, _wallet.id, _topup.user_id, _topup.net_credit_sar;
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_credit_topup(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_credit_topup(uuid, text, text) TO service_role;

-- Ensure ON CONFLICT (user_id) target above works
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wallets_user_id_key' AND conrelid = 'public.wallets'::regclass
  ) THEN
    ALTER TABLE public.wallets ADD CONSTRAINT wallets_user_id_key UNIQUE (user_id);
  END IF;
END $$;