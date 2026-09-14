
-- 1. Add referral fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id);

-- Backfill referral codes for existing profiles
UPDATE public.profiles
   SET referral_code = upper(substr(md5(id::text || random()::text), 1, 8))
 WHERE referral_code IS NULL;

ALTER TABLE public.profiles ALTER COLUMN referral_code SET NOT NULL;

-- 2. Referral earnings table
CREATE TABLE IF NOT EXISTS public.referral_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deposit_amount NUMERIC NOT NULL,
  commission NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.referral_earnings TO authenticated;
GRANT ALL ON public.referral_earnings TO service_role;

ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own referral earnings"
  ON public.referral_earnings FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- 3. Update handle_new_user to generate referral_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)),
    upper(substr(md5(NEW.id::text || random()::text), 1, 8))
  );
  RETURN NEW;
END;
$$;

-- 4. Apply referral code function (called by referred user after signup)
CREATE OR REPLACE FUNCTION public.apply_referral_code(_code TEXT)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid UUID := auth.uid();
  _referrer UUID;
  _p public.profiles;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT referred_by INTO _referrer FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _referrer IS NOT NULL THEN RAISE EXCEPTION 'Você já usou um código de indicação'; END IF;

  SELECT id INTO _referrer FROM public.profiles WHERE upper(referral_code) = upper(_code);
  IF _referrer IS NULL THEN RAISE EXCEPTION 'Código inválido'; END IF;
  IF _referrer = _uid THEN RAISE EXCEPTION 'Você não pode usar seu próprio código'; END IF;

  UPDATE public.profiles SET referred_by = _referrer, updated_at = now()
   WHERE id = _uid
   RETURNING * INTO _p;

  RETURN _p;
END $$;

-- 5. Trigger: when a referred user deposits, give 30% to referrer
CREATE OR REPLACE FUNCTION public.referral_on_deposit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _referrer UUID;
  _commission NUMERIC;
  _bal NUMERIC;
BEGIN
  IF NEW.type <> 'deposit' THEN RETURN NEW; END IF;
  IF NEW.description LIKE 'Bônus%' OR NEW.description LIKE 'Comissão%' THEN
    RETURN NEW;
  END IF;

  SELECT referred_by INTO _referrer FROM public.profiles WHERE id = NEW.user_id;
  IF _referrer IS NULL THEN RETURN NEW; END IF;

  _commission := round(NEW.amount * 0.30, 2);
  IF _commission <= 0 THEN RETURN NEW; END IF;

  SELECT balance INTO _bal FROM public.profiles WHERE id = _referrer FOR UPDATE;
  UPDATE public.profiles SET balance = balance + _commission, updated_at = now()
   WHERE id = _referrer;

  INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, description)
  VALUES (_referrer, 'deposit', _commission, _bal + _commission,
          'Comissão de indicação (30%)');

  INSERT INTO public.referral_earnings (referrer_id, referred_id, deposit_amount, commission)
  VALUES (_referrer, NEW.user_id, NEW.amount, _commission);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_referral_on_deposit ON public.wallet_transactions;
CREATE TRIGGER trg_referral_on_deposit
  AFTER INSERT ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.referral_on_deposit();
