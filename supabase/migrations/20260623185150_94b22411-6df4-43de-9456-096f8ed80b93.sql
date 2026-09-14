
CREATE OR REPLACE FUNCTION public.match_start(_stake NUMERIC)
RETURNS public.matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  _uid UUID := auth.uid();
  _bal NUMERIC;
  _rtp NUMERIC;
  _mult NUMERIC := 2.0;
  _skin UUID;
  _skin_mult NUMERIC := 1.0;
  _seed TEXT;
  _r NUMERIC;
  _p NUMERIC;
  _won BOOLEAN;
  _new public.matches;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _stake IS NULL OR _stake <= 0 THEN RAISE EXCEPTION 'Stake must be positive'; END IF;
  IF _stake > 10000 THEN RAISE EXCEPTION 'Stake too large'; END IF;

  IF EXISTS (SELECT 1 FROM public.matches WHERE user_id = _uid AND status = 'active') THEN
    RAISE EXCEPTION 'Já existe uma partida em andamento';
  END IF;

  SELECT balance INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _bal IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF _bal < _stake THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;

  SELECT uc.skin_id, s.payout_multiplier INTO _skin, _skin_mult
  FROM public.user_cues uc
  JOIN public.cue_skins s ON s.id = uc.skin_id
  WHERE uc.user_id = _uid AND uc.equipped = TRUE
  LIMIT 1;
  _skin_mult := COALESCE(_skin_mult, 1.0);
  _mult := 2.0 * _skin_mult;

  SELECT target_rtp INTO _rtp FROM public.rtp_config WHERE id = TRUE;
  _rtp := COALESCE(_rtp, 0.95);
  _p := LEAST(0.95, GREATEST(0.05, _rtp / _mult));

  _seed := encode(extensions.gen_random_bytes(32), 'hex');
  _r := ('x'||substr(_seed,1,12))::bit(48)::bigint::numeric / 281474976710656.0;
  _won := _r < _p;

  UPDATE public.profiles SET balance = balance - _stake WHERE id = _uid;

  INSERT INTO public.matches (user_id, stake, server_seed, rtp_outcome, payout_multiplier, skin_id)
  VALUES (_uid, _stake, _seed, _won, _mult, _skin)
  RETURNING * INTO _new;

  INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, description)
  VALUES (_uid, 'bet', _stake, _bal - _stake, 'Aposta 8-ball #' || substr(_new.id::text, 1, 8));

  RETURN _new;
END $$;
