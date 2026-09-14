
CREATE TABLE IF NOT EXISTS public.pix_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identifier TEXT NOT NULL UNIQUE,
  gateway_id TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'PENDING',
  pix_code TEXT,
  pix_image TEXT,
  credited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pix_deposits TO authenticated;
GRANT ALL ON public.pix_deposits TO service_role;
ALTER TABLE public.pix_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pix select" ON public.pix_deposits FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own pix insert" ON public.pix_deposits FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS pix_deposits_user_idx ON public.pix_deposits(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.credit_pix_deposit(_identifier TEXT, _gateway_id TEXT, _status TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _dep public.pix_deposits;
  _bal NUMERIC;
BEGIN
  SELECT * INTO _dep FROM public.pix_deposits WHERE identifier = _identifier FOR UPDATE;
  IF _dep.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  UPDATE public.pix_deposits SET gateway_id = COALESCE(_gateway_id, gateway_id), status = _status, updated_at = now() WHERE id = _dep.id;
  IF _status <> 'OK' OR _dep.credited_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'credited', false);
  END IF;
  SELECT balance INTO _bal FROM public.profiles WHERE id = _dep.user_id FOR UPDATE;
  UPDATE public.profiles SET balance = balance + _dep.amount, updated_at = now() WHERE id = _dep.user_id;
  INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, description)
  VALUES (_dep.user_id, 'deposit', _dep.amount, _bal + _dep.amount, 'Depósito PIX ' || _dep.identifier);
  UPDATE public.pix_deposits SET credited_at = now() WHERE id = _dep.id;
  RETURN jsonb_build_object('ok', true, 'credited', true, 'amount', _dep.amount);
END $$;

REVOKE EXECUTE ON FUNCTION public.credit_pix_deposit(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_pix_deposit(TEXT, TEXT, TEXT) TO service_role;
