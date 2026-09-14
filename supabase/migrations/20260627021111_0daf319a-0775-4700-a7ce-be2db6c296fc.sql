
-- ============ TABELA ============
CREATE TYPE public.pvp_status AS ENUM ('pending','active','finished','cancelled','expired');

CREATE TABLE public.pvp_matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stake           NUMERIC NOT NULL CHECK (stake > 0),
  pot             NUMERIC NOT NULL,
  fee_pct         NUMERIC NOT NULL DEFAULT 0.05,
  status          public.pvp_status NOT NULL DEFAULT 'pending',
  turn_user_id    UUID,
  turn_started_at TIMESTAMPTZ,
  shot_num        INT NOT NULL DEFAULT 0,
  last_state      JSONB,
  winner_id       UUID,
  loser_id        UUID,
  host_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  guest_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at      TIMESTAMPTZ,
  CHECK (host_id <> guest_id)
);

CREATE INDEX pvp_matches_host_idx  ON public.pvp_matches(host_id, status);
CREATE INDEX pvp_matches_guest_idx ON public.pvp_matches(guest_id, status);

GRANT SELECT, INSERT, UPDATE ON public.pvp_matches TO authenticated;
GRANT ALL ON public.pvp_matches TO service_role;

ALTER TABLE public.pvp_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants can read"
  ON public.pvp_matches FOR SELECT TO authenticated
  USING (auth.uid() = host_id OR auth.uid() = guest_id);

-- writes go through SECURITY DEFINER RPCs; no direct INSERT/UPDATE policy

ALTER PUBLICATION supabase_realtime ADD TABLE public.pvp_matches;
ALTER TABLE public.pvp_matches REPLICA IDENTITY FULL;

-- ============ RPCs ============

CREATE OR REPLACE FUNCTION public.pvp_create_invite(_guest_id UUID, _stake NUMERIC)
RETURNS public.pvp_matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid UUID := auth.uid(); _bal NUMERIC; _row public.pvp_matches;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _guest_id IS NULL OR _guest_id = _uid THEN RAISE EXCEPTION 'invalid opponent'; END IF;
  IF _stake IS NULL OR _stake <= 0 THEN RAISE EXCEPTION 'invalid stake'; END IF;
  IF _stake > 10000 THEN RAISE EXCEPTION 'stake too large'; END IF;
  IF NOT public.are_friends(_uid, _guest_id) THEN RAISE EXCEPTION 'only friends can challenge'; END IF;

  SELECT balance INTO _bal FROM public.profiles WHERE id=_uid FOR UPDATE;
  IF _bal < _stake THEN RAISE EXCEPTION 'insufficient funds'; END IF;
  UPDATE public.profiles SET balance = balance - _stake, updated_at = now() WHERE id=_uid;
  INSERT INTO public.wallet_transactions(user_id,type,amount,balance_after,description)
  VALUES (_uid,'bet',_stake,_bal-_stake,'PvP desafio (aguardando aceite)');

  INSERT INTO public.pvp_matches(host_id, guest_id, stake, pot, status)
  VALUES (_uid, _guest_id, _stake, _stake*2, 'pending')
  RETURNING * INTO _row;

  INSERT INTO public.notifications(user_id, type, title, message, link)
  VALUES (_guest_id, 'pvp_invite', '🎱 Convite para jogar',
          'Você foi desafiado para uma partida de R$ '||_stake::text, '/social');

  RETURN _row;
END $$;

CREATE OR REPLACE FUNCTION public.pvp_accept_invite(_match_id UUID)
RETURNS public.pvp_matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid UUID := auth.uid(); _m public.pvp_matches; _bal NUMERIC; _first UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _m FROM public.pvp_matches WHERE id=_match_id FOR UPDATE;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'match not found'; END IF;
  IF _m.guest_id <> _uid THEN RAISE EXCEPTION 'not the invited player'; END IF;
  IF _m.status <> 'pending' THEN RAISE EXCEPTION 'invite no longer pending'; END IF;

  SELECT balance INTO _bal FROM public.profiles WHERE id=_uid FOR UPDATE;
  IF _bal < _m.stake THEN RAISE EXCEPTION 'insufficient funds'; END IF;
  UPDATE public.profiles SET balance = balance - _m.stake, updated_at = now() WHERE id=_uid;
  INSERT INTO public.wallet_transactions(user_id,type,amount,balance_after,description)
  VALUES (_uid,'bet',_m.stake,_bal-_m.stake,'PvP aceite #'||substr(_m.id::text,1,8));

  _first := CASE WHEN random() < 0.5 THEN _m.host_id ELSE _m.guest_id END;
  UPDATE public.pvp_matches
     SET status='active', turn_user_id=_first, turn_started_at=now(),
         host_seen_at=now(), guest_seen_at=now(), updated_at=now()
   WHERE id=_match_id RETURNING * INTO _m;

  INSERT INTO public.notifications(user_id, type, title, message, link)
  VALUES (_m.host_id, 'pvp_accepted', '✅ Desafio aceito!',
          'Sua partida PvP começou. Boa sorte!', '/play?pvp='||_m.id::text);

  RETURN _m;
END $$;

CREATE OR REPLACE FUNCTION public.pvp_decline_invite(_match_id UUID)
RETURNS public.pvp_matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid UUID := auth.uid(); _m public.pvp_matches; _bal NUMERIC;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _m FROM public.pvp_matches WHERE id=_match_id FOR UPDATE;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'match not found'; END IF;
  IF _m.status <> 'pending' THEN RAISE EXCEPTION 'invite no longer pending'; END IF;
  IF _uid NOT IN (_m.host_id, _m.guest_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT balance INTO _bal FROM public.profiles WHERE id=_m.host_id FOR UPDATE;
  UPDATE public.profiles SET balance = balance + _m.stake, updated_at = now() WHERE id=_m.host_id;
  INSERT INTO public.wallet_transactions(user_id,type,amount,balance_after,description)
  VALUES (_m.host_id,'refund',_m.stake,_bal+_m.stake,'PvP convite recusado/cancelado');

  UPDATE public.pvp_matches SET status='cancelled', settled_at=now(), updated_at=now() WHERE id=_match_id
  RETURNING * INTO _m;
  RETURN _m;
END $$;

CREATE OR REPLACE FUNCTION public.pvp_submit_turn(_match_id UUID, _state JSONB, _next_user UUID)
RETURNS public.pvp_matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid UUID := auth.uid(); _m public.pvp_matches;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _m FROM public.pvp_matches WHERE id=_match_id FOR UPDATE;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'match not found'; END IF;
  IF _m.status <> 'active' THEN RAISE EXCEPTION 'match not active'; END IF;
  IF _m.turn_user_id <> _uid THEN RAISE EXCEPTION 'not your turn'; END IF;
  IF _next_user NOT IN (_m.host_id, _m.guest_id) THEN RAISE EXCEPTION 'invalid next player'; END IF;

  UPDATE public.pvp_matches
     SET last_state = _state,
         shot_num = shot_num + 1,
         turn_user_id = _next_user,
         turn_started_at = now(),
         updated_at = now(),
         host_seen_at  = CASE WHEN _uid = host_id  THEN now() ELSE host_seen_at  END,
         guest_seen_at = CASE WHEN _uid = guest_id THEN now() ELSE guest_seen_at END
   WHERE id = _match_id RETURNING * INTO _m;
  RETURN _m;
END $$;

CREATE OR REPLACE FUNCTION public.pvp_heartbeat(_match_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  UPDATE public.pvp_matches
     SET host_seen_at  = CASE WHEN _uid = host_id  THEN now() ELSE host_seen_at  END,
         guest_seen_at = CASE WHEN _uid = guest_id THEN now() ELSE guest_seen_at END
   WHERE id=_match_id AND status='active' AND _uid IN (host_id, guest_id);
END $$;

CREATE OR REPLACE FUNCTION public.pvp_settle(_match_id UUID, _winner_id UUID)
RETURNS public.pvp_matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid UUID := auth.uid(); _m public.pvp_matches;
        _payout NUMERIC; _fee NUMERIC; _loser UUID; _bal NUMERIC;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _m FROM public.pvp_matches WHERE id=_match_id FOR UPDATE;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'match not found'; END IF;
  IF _m.status <> 'active' THEN RETURN _m; END IF;
  IF _uid NOT IN (_m.host_id, _m.guest_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _winner_id NOT IN (_m.host_id, _m.guest_id) THEN RAISE EXCEPTION 'invalid winner'; END IF;

  _loser  := CASE WHEN _winner_id = _m.host_id THEN _m.guest_id ELSE _m.host_id END;
  _fee    := round(_m.pot * _m.fee_pct, 2);
  _payout := _m.pot - _fee;

  SELECT balance INTO _bal FROM public.profiles WHERE id=_winner_id FOR UPDATE;
  UPDATE public.profiles SET balance = balance + _payout, updated_at=now() WHERE id=_winner_id;
  INSERT INTO public.wallet_transactions(user_id,type,amount,balance_after,description)
  VALUES (_winner_id,'win',_payout,_bal+_payout,
          'Vitória PvP #'||substr(_m.id::text,1,8)||' (taxa '||_fee::text||')');

  UPDATE public.pvp_matches
     SET status='finished', winner_id=_winner_id, loser_id=_loser,
         settled_at=now(), updated_at=now()
   WHERE id=_match_id RETURNING * INTO _m;

  INSERT INTO public.notifications(user_id, type, title, message)
  VALUES (_loser, 'pvp_lost', '💔 Derrota PvP', 'Você perdeu a partida contra seu amigo.');

  RETURN _m;
END $$;

CREATE OR REPLACE FUNCTION public.pvp_claim_walkover(_match_id UUID)
RETURNS public.pvp_matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid UUID := auth.uid(); _m public.pvp_matches; _opp_seen TIMESTAMPTZ;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _m FROM public.pvp_matches WHERE id=_match_id FOR UPDATE;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'match not found'; END IF;
  IF _m.status <> 'active' THEN RAISE EXCEPTION 'match not active'; END IF;
  IF _uid NOT IN (_m.host_id, _m.guest_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  _opp_seen := CASE WHEN _uid=_m.host_id THEN _m.guest_seen_at ELSE _m.host_seen_at END;
  IF _opp_seen > now() - interval '120 seconds' THEN
    RAISE EXCEPTION 'opponent still connected';
  END IF;
  RETURN public.pvp_settle(_match_id, _uid);
END $$;

CREATE OR REPLACE FUNCTION public.pvp_current_active()
RETURNS SETOF public.pvp_matches
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.pvp_matches
  WHERE status='active' AND (host_id=auth.uid() OR guest_id=auth.uid())
  ORDER BY updated_at DESC LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.pvp_create_invite(UUID,NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pvp_accept_invite(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pvp_decline_invite(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pvp_submit_turn(UUID,JSONB,UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pvp_heartbeat(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pvp_settle(UUID,UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pvp_claim_walkover(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pvp_current_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pvp_create_invite(UUID,NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pvp_accept_invite(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pvp_decline_invite(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pvp_submit_turn(UUID,JSONB,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pvp_heartbeat(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pvp_settle(UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pvp_claim_walkover(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pvp_current_active() TO authenticated;
