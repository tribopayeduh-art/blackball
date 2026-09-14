
CREATE TYPE public.match_status AS ENUM ('active', 'won', 'lost', 'forfeit');

CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stake NUMERIC(12,2) NOT NULL CHECK (stake > 0),
  payout NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (payout >= 0),
  status public.match_status NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX matches_user_active_idx ON public.matches(user_id) WHERE status = 'active';
CREATE INDEX matches_user_created_idx ON public.matches(user_id, created_at DESC);

GRANT SELECT ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own matches" ON public.matches
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Inserts/updates only happen via security-definer RPCs below.

-- Start a match: atomically debit stake and create active match row.
CREATE OR REPLACE FUNCTION public.match_start(_stake NUMERIC)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _bal NUMERIC;
  _new public.matches;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _stake IS NULL OR _stake <= 0 THEN RAISE EXCEPTION 'Stake must be positive'; END IF;

  IF EXISTS (SELECT 1 FROM public.matches WHERE user_id = _uid AND status = 'active') THEN
    RAISE EXCEPTION 'Já existe uma partida em andamento';
  END IF;

  SELECT balance INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _bal IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF _bal < _stake THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;

  UPDATE public.profiles SET balance = balance - _stake WHERE id = _uid;

  INSERT INTO public.matches (user_id, stake) VALUES (_uid, _stake)
  RETURNING * INTO _new;

  INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, description)
  VALUES (_uid, 'bet', _stake, _bal - _stake, 'Aposta partida 8-ball #' || substr(_new.id::text, 1, 8));

  RETURN _new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.match_start(NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_start(NUMERIC) TO authenticated;

-- Settle a match: atomically mark won/lost/forfeit and credit payout if won.
CREATE OR REPLACE FUNCTION public.match_settle(_match_id UUID, _won BOOLEAN, _forfeit BOOLEAN DEFAULT FALSE)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _m public.matches;
  _payout NUMERIC := 0;
  _bal NUMERIC;
  _new_status public.match_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _m FROM public.matches WHERE id = _match_id AND user_id = _uid FOR UPDATE;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF _m.status <> 'active' THEN RETURN _m; END IF; -- idempotent

  IF _won THEN
    _payout := _m.stake * 2;
    _new_status := 'won';
  ELSIF _forfeit THEN
    _new_status := 'forfeit';
  ELSE
    _new_status := 'lost';
  END IF;

  IF _payout > 0 THEN
    SELECT balance INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
    UPDATE public.profiles SET balance = balance + _payout WHERE id = _uid;
    INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, description)
    VALUES (_uid, 'win', _payout, _bal + _payout, 'Vitória 8-ball (2x) #' || substr(_m.id::text, 1, 8));
  END IF;

  UPDATE public.matches
    SET status = _new_status, payout = _payout, settled_at = now()
    WHERE id = _m.id
    RETURNING * INTO _m;

  RETURN _m;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.match_settle(UUID, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_settle(UUID, BOOLEAN, BOOLEAN) TO authenticated;

-- Helper: current active match for the authenticated user.
CREATE OR REPLACE FUNCTION public.current_active_match()
RETURNS public.matches
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.matches
   WHERE user_id = auth.uid() AND status = 'active'
   ORDER BY started_at DESC LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.current_active_match() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_active_match() TO authenticated;
