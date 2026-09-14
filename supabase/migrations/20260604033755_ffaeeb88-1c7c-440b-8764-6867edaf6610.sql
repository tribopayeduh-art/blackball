
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TYPE public.tx_type AS ENUM ('deposit','withdraw','bet','win','refund');

CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.tx_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tx select" ON public.wallet_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX wallet_tx_user_idx ON public.wallet_transactions(user_id, created_at DESC);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Atomic balance update function (deposit/withdraw/bet/win)
CREATE OR REPLACE FUNCTION public.wallet_apply(_type public.tx_type, _amount NUMERIC, _description TEXT DEFAULT NULL)
RETURNS public.wallet_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _delta NUMERIC;
  _new_balance NUMERIC;
  _tx public.wallet_transactions;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;

  _delta := CASE WHEN _type IN ('deposit','win','refund') THEN _amount ELSE -_amount END;

  UPDATE public.profiles
     SET balance = balance + _delta, updated_at = now()
   WHERE id = _uid AND balance + _delta >= 0
   RETURNING balance INTO _new_balance;

  IF _new_balance IS NULL THEN RAISE EXCEPTION 'insufficient funds'; END IF;

  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, description)
  VALUES (_uid, _type, _amount, _new_balance, _description)
  RETURNING * INTO _tx;

  RETURN _tx;
END;
$$;
GRANT EXECUTE ON FUNCTION public.wallet_apply(public.tx_type, NUMERIC, TEXT) TO authenticated;
