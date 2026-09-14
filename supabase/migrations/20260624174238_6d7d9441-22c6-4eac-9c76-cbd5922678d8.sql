
-- 1) Profile progression columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS login_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login_date DATE;

-- 2) Daily missions table
CREATE TABLE IF NOT EXISTS public.user_daily_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  kind TEXT NOT NULL CHECK (kind IN ('play','win','wager')),
  target NUMERIC NOT NULL,
  progress NUMERIC NOT NULL DEFAULT 0,
  reward NUMERIC NOT NULL,
  claimed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, day, kind)
);

GRANT SELECT, INSERT, UPDATE ON public.user_daily_missions TO authenticated;
GRANT ALL ON public.user_daily_missions TO service_role;
ALTER TABLE public.user_daily_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own missions select" ON public.user_daily_missions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3) Ensure today's missions exist for the caller
CREATE OR REPLACE FUNCTION public.ensure_daily_missions()
RETURNS SETOF public.user_daily_missions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  INSERT INTO public.user_daily_missions(user_id, day, kind, target, reward)
  VALUES
    (_uid, _today, 'play',  3,  5),
    (_uid, _today, 'win',   1,  10),
    (_uid, _today, 'wager', 50, 8)
  ON CONFLICT (user_id, day, kind) DO NOTHING;

  RETURN QUERY
    SELECT * FROM public.user_daily_missions
     WHERE user_id = _uid AND day = _today
     ORDER BY kind;
END $$;

-- 4) Claim a completed mission
CREATE OR REPLACE FUNCTION public.claim_mission(_mission_id UUID)
RETURNS public.wallet_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _m public.user_daily_missions;
  _tx public.wallet_transactions;
  _bal NUMERIC;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _m FROM public.user_daily_missions
   WHERE id = _mission_id AND user_id = _uid FOR UPDATE;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'Missão não encontrada'; END IF;
  IF _m.claimed THEN RAISE EXCEPTION 'Recompensa já resgatada'; END IF;
  IF _m.progress < _m.target THEN RAISE EXCEPTION 'Missão ainda não concluída'; END IF;

  SELECT balance INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
  UPDATE public.profiles SET balance = balance + _m.reward, updated_at = now() WHERE id = _uid;
  INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, description)
  VALUES (_uid, 'win', _m.reward, _bal + _m.reward,
          'Missão diária: ' || _m.kind)
  RETURNING * INTO _tx;

  UPDATE public.user_daily_missions SET claimed = TRUE WHERE id = _mission_id;
  RETURN _tx;
END $$;

-- 5) Daily login bonus + streak
CREATE OR REPLACE FUNCTION public.claim_daily_bonus()
RETURNS TABLE (reward NUMERIC, streak INTEGER, balance NUMERIC, already_claimed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (now() AT TIME ZONE 'UTC')::date;
  _last DATE;
  _streak INTEGER;
  _reward NUMERIC;
  _bal NUMERIC;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT last_login_date, login_streak, balance
    INTO _last, _streak, _bal
    FROM public.profiles WHERE id = _uid FOR UPDATE;

  IF _last = _today THEN
    RETURN QUERY SELECT 0::numeric, COALESCE(_streak,0), _bal, TRUE;
    RETURN;
  END IF;

  IF _last = _today - 1 THEN
    _streak := COALESCE(_streak,0) + 1;
  ELSE
    _streak := 1;
  END IF;

  _reward := LEAST(50, 5 * _streak);

  UPDATE public.profiles
     SET balance = balance + _reward,
         login_streak = _streak,
         last_login_date = _today,
         updated_at = now()
   WHERE id = _uid;

  INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, description)
  VALUES (_uid, 'deposit', _reward, _bal + _reward,
          'Bônus diário (streak ' || _streak || ')');

  RETURN QUERY SELECT _reward, _streak, _bal + _reward, FALSE;
END $$;

-- 6) Weekly leaderboard (by net profit since Monday UTC)
CREATE OR REPLACE FUNCTION public.weekly_leaderboard()
RETURNS TABLE (user_id UUID, username TEXT, wins BIGINT, profit NUMERIC, level INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH week_start AS (
    SELECT date_trunc('week', now() AT TIME ZONE 'UTC') AS ws
  ),
  agg AS (
    SELECT m.user_id,
           COUNT(*) FILTER (WHERE m.status = 'won')::bigint AS wins,
           COALESCE(SUM(CASE WHEN m.status = 'won' THEN m.payout - m.stake
                             WHEN m.status IN ('lost','forfeit') THEN -m.stake
                             ELSE 0 END), 0)::numeric AS profit
      FROM public.matches m, week_start w
     WHERE m.started_at >= w.ws
     GROUP BY m.user_id
  )
  SELECT a.user_id, p.username, a.wins, a.profit, p.level
    FROM agg a
    JOIN public.profiles p ON p.id = a.user_id
   ORDER BY a.profit DESC, a.wins DESC
   LIMIT 50;
$$;

-- Allow leaderboard to read usernames across users
GRANT EXECUTE ON FUNCTION public.weekly_leaderboard() TO authenticated;

-- 7) Extend match_settle to grant XP and update mission progress
CREATE OR REPLACE FUNCTION public.match_settle(_match_id uuid, _won boolean, _forfeit boolean DEFAULT false)
 RETURNS matches
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _m public.matches;
  _payout NUMERIC := 0;
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

  IF _m.started_at < now() - INTERVAL '30 minutes' THEN
    _forfeit := TRUE;
  END IF;

  _true_won := COALESCE(_m.rtp_outcome, FALSE) AND NOT _forfeit;

  IF _true_won THEN
    _payout := _m.stake * COALESCE(_m.payout_multiplier, 2.0);
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
            'Vitória 8-ball (' || round(COALESCE(_m.payout_multiplier,2.0),2) || 'x) #' || substr(_m.id::text,1,8));
  END IF;

  UPDATE public.matches
     SET status = _new_status, payout = _payout, settled_at = now()
   WHERE id = _m.id
   RETURNING * INTO _m;

  -- XP: base 10 per match + stake/5 + 25 bonus on win
  _xp_gain := 10 + FLOOR(_m.stake / 5)::int + CASE WHEN _true_won THEN 25 ELSE 0 END;

  SELECT level, xp INTO _old_level, _new_xp FROM public.profiles WHERE id = _uid FOR UPDATE;
  _new_xp := COALESCE(_new_xp, 0) + _xp_gain;
  -- Level formula: level = floor(sqrt(xp/100)) + 1
  _new_level := GREATEST(1, FLOOR(SQRT(_new_xp::numeric / 100.0))::int + 1);

  UPDATE public.profiles
     SET xp = _new_xp,
         level = _new_level,
         updated_at = now()
   WHERE id = _uid;

  -- Level-up bonus: 25 coins per new level
  IF _new_level > COALESCE(_old_level, 1) THEN
    _level_bonus := (_new_level - COALESCE(_old_level,1)) * 25;
    SELECT balance INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
    UPDATE public.profiles SET balance = balance + _level_bonus WHERE id = _uid;
    INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, description)
    VALUES (_uid, 'deposit', _level_bonus, _bal + _level_bonus,
            'Bônus de nível ' || _new_level);
  END IF;

  -- Ensure today's missions exist, then update progress
  INSERT INTO public.user_daily_missions(user_id, day, kind, target, reward)
  VALUES
    (_uid, _today, 'play',  3,  5),
    (_uid, _today, 'win',   1,  10),
    (_uid, _today, 'wager', 50, 8)
  ON CONFLICT (user_id, day, kind) DO NOTHING;

  UPDATE public.user_daily_missions
     SET progress = LEAST(target, progress + 1)
   WHERE user_id = _uid AND day = _today AND kind = 'play' AND NOT claimed;

  IF _true_won THEN
    UPDATE public.user_daily_missions
       SET progress = LEAST(target, progress + 1)
     WHERE user_id = _uid AND day = _today AND kind = 'win' AND NOT claimed;
  END IF;

  UPDATE public.user_daily_missions
     SET progress = LEAST(target, progress + _m.stake)
   WHERE user_id = _uid AND day = _today AND kind = 'wager' AND NOT claimed;

  RETURN _m;
END $function$;
