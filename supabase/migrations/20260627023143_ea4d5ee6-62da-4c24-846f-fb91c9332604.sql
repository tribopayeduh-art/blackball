
-- 5% platform fee on PvE winnings (applied to profit, not stake)
CREATE OR REPLACE FUNCTION public.match_settle(_match_id uuid, _won boolean, _forfeit boolean DEFAULT false)
 RETURNS matches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _m public.matches;
  _payout NUMERIC := 0;
  _gross NUMERIC := 0;
  _profit NUMERIC := 0;
  _fee NUMERIC := 0;
  _bal NUMERIC;
  _new_status public.match_status;
  _true_won BOOLEAN;
  _today DATE := (now() AT TIME ZONE 'UTC')::date;
  _xp_gain INTEGER;
  _old_level INTEGER;
  _new_xp INTEGER;
  _new_level INTEGER;
  _level_bonus NUMERIC;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _m FROM public.matches WHERE id = _match_id AND user_id = _uid FOR UPDATE;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF _m.status <> 'active' THEN RETURN _m; END IF;
  IF _m.started_at < now() - INTERVAL '30 minutes' THEN _forfeit := TRUE; END IF;

  _true_won := COALESCE(_m.rtp_outcome, FALSE) AND NOT _forfeit;

  IF _true_won THEN
    _gross  := _m.stake * COALESCE(_m.payout_multiplier, 2.0);
    _profit := _gross - _m.stake;
    _fee    := round(_profit * 0.05, 2);
    _payout := _gross - _fee;
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
    VALUES (_uid, 'win', _payout, _bal + _payout,
            'Vitória 8-ball (taxa 5% R$ ' || _fee::text || ') #' || substr(_m.id::text,1,8));
  END IF;

  UPDATE public.matches SET status = _new_status, payout = _payout, settled_at = now()
   WHERE id = _m.id RETURNING * INTO _m;

  _xp_gain := 10 + FLOOR(_m.stake / 5)::int + CASE WHEN _true_won THEN 25 ELSE 0 END;
  SELECT level, xp INTO _old_level, _new_xp FROM public.profiles WHERE id = _uid FOR UPDATE;
  _new_xp := COALESCE(_new_xp, 0) + _xp_gain;
  _new_level := GREATEST(1, FLOOR(SQRT(_new_xp::numeric / 100.0))::int + 1);
  UPDATE public.profiles SET xp = _new_xp, level = _new_level, updated_at = now() WHERE id = _uid;

  IF _new_level > COALESCE(_old_level, 1) THEN
    _level_bonus := (_new_level - COALESCE(_old_level,1)) * 25;
    SELECT balance INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
    UPDATE public.profiles SET balance = balance + _level_bonus WHERE id = _uid;
    INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, description)
    VALUES (_uid, 'deposit', _level_bonus, _bal + _level_bonus, 'Bônus de nível ' || _new_level);
  END IF;

  INSERT INTO public.user_daily_missions(user_id, day, kind, target, reward)
  VALUES (_uid, _today, 'play',  3,  5), (_uid, _today, 'win',   1,  10), (_uid, _today, 'wager', 50, 8)
  ON CONFLICT (user_id, day, kind) DO NOTHING;

  UPDATE public.user_daily_missions SET progress = LEAST(target, progress + 1)
   WHERE user_id = _uid AND day = _today AND kind = 'play' AND NOT claimed;
  IF _true_won THEN
    UPDATE public.user_daily_missions SET progress = LEAST(target, progress + 1)
     WHERE user_id = _uid AND day = _today AND kind = 'win' AND NOT claimed;
  END IF;
  UPDATE public.user_daily_missions SET progress = LEAST(target, progress + _m.stake)
   WHERE user_id = _uid AND day = _today AND kind = 'wager' AND NOT claimed;

  RETURN _m;
END $function$;

-- Public read of live PvP matches (limited columns, no last_state to avoid cheat)
CREATE OR REPLACE FUNCTION public.live_pvp_matches(_limit integer DEFAULT 20)
 RETURNS TABLE(
   id uuid, host_id uuid, guest_id uuid,
   host_name text, guest_name text,
   host_level integer, guest_level integer,
   stake numeric, pot numeric, shot_num integer,
   turn_user_id uuid, updated_at timestamptz
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT m.id, m.host_id, m.guest_id,
         ph.username, pg.username, ph.level, pg.level,
         m.stake, m.pot, m.shot_num, m.turn_user_id, m.updated_at
  FROM public.pvp_matches m
  JOIN public.profiles ph ON ph.id = m.host_id
  JOIN public.profiles pg ON pg.id = m.guest_id
  WHERE m.status = 'active'
  ORDER BY m.updated_at DESC
  LIMIT _limit
$function$;

REVOKE ALL ON FUNCTION public.live_pvp_matches(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.live_pvp_matches(integer) TO authenticated;
