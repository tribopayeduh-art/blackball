
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
    (_uid, _today, 'play',  3,  2),
    (_uid, _today, 'win',   1,  4),
    (_uid, _today, 'wager', 50, 3)
  ON CONFLICT (user_id, day, kind) DO NOTHING;
  RETURN QUERY SELECT * FROM public.user_daily_missions
    WHERE user_id = _uid AND day = _today ORDER BY kind;
END $$;

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
  _reward := LEAST(20, 2 * _streak);
  UPDATE public.profiles
     SET balance = balance + _reward,
         login_streak = _streak,
         last_login_date = _today,
         updated_at = now()
   WHERE id = _uid;
  INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, description)
  VALUES (_uid, 'deposit', _reward, _bal + _reward, 'Bônus diário (streak ' || _streak || ')');
  RETURN QUERY SELECT _reward, _streak, _bal + _reward, FALSE;
END $$;
