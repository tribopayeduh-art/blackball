
-- 1) App settings (singleton)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_message TEXT NOT NULL DEFAULT 'Sistema em manutenção. Voltamos em breve.',
  signups_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  deposits_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  withdrawals_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  matches_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  bots_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  bot_creation_rate INTEGER NOT NULL DEFAULT 5,   -- bots criados por minuto (referência para feed simulado)
  bot_min_stake NUMERIC(12,2) NOT NULL DEFAULT 1,
  bot_max_stake NUMERIC(12,2) NOT NULL DEFAULT 100,
  min_stake NUMERIC(12,2) NOT NULL DEFAULT 1,
  max_stake NUMERIC(12,2) NOT NULL DEFAULT 1000,
  global_rtp NUMERIC(4,3) NOT NULL DEFAULT 0.95,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings read" ON public.app_settings;
CREATE POLICY "app_settings read" ON public.app_settings FOR SELECT USING (true);
INSERT INTO public.app_settings(id) VALUES (TRUE) ON CONFLICT DO NOTHING;

-- 2) Profile fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- 3) Broadcast notifications
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'info',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_notifications TO anon, authenticated;
GRANT ALL ON public.admin_notifications TO service_role;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcasts public" ON public.admin_notifications;
CREATE POLICY "broadcasts public" ON public.admin_notifications FOR SELECT USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;

-- 4) Admin actions log
CREATE TABLE IF NOT EXISTS public.admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID,
  action TEXT NOT NULL,
  target_user UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_audit TO authenticated;
GRANT ALL ON public.admin_audit TO service_role;
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_audit admin read" ON public.admin_audit;
CREATE POLICY "admin_audit admin read" ON public.admin_audit FOR SELECT
  USING (public.has_role(auth.uid(),'admin'::public.app_role));

-- 5) Get / set settings
CREATE OR REPLACE FUNCTION public.admin_get_settings()
RETURNS public.app_settings LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT * FROM public.app_settings WHERE id=TRUE
$$;

CREATE OR REPLACE FUNCTION public.admin_update_settings(_patch JSONB)
RETURNS public.app_settings LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _row public.app_settings;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.app_settings SET
    maintenance_mode    = COALESCE((_patch->>'maintenance_mode')::boolean, maintenance_mode),
    maintenance_message = COALESCE(_patch->>'maintenance_message', maintenance_message),
    signups_enabled     = COALESCE((_patch->>'signups_enabled')::boolean, signups_enabled),
    deposits_enabled    = COALESCE((_patch->>'deposits_enabled')::boolean, deposits_enabled),
    withdrawals_enabled = COALESCE((_patch->>'withdrawals_enabled')::boolean, withdrawals_enabled),
    matches_enabled     = COALESCE((_patch->>'matches_enabled')::boolean, matches_enabled),
    bots_enabled        = COALESCE((_patch->>'bots_enabled')::boolean, bots_enabled),
    bot_creation_rate   = COALESCE((_patch->>'bot_creation_rate')::int, bot_creation_rate),
    bot_min_stake       = COALESCE((_patch->>'bot_min_stake')::numeric, bot_min_stake),
    bot_max_stake       = COALESCE((_patch->>'bot_max_stake')::numeric, bot_max_stake),
    min_stake           = COALESCE((_patch->>'min_stake')::numeric, min_stake),
    max_stake           = COALESCE((_patch->>'max_stake')::numeric, max_stake),
    global_rtp          = COALESCE((_patch->>'global_rtp')::numeric, global_rtp),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id=TRUE RETURNING * INTO _row;

  -- Sync RTP into rtp_config if changed
  IF _patch ? 'global_rtp' THEN
    UPDATE public.rtp_config SET target_rtp = _row.global_rtp WHERE id=TRUE;
  END IF;

  INSERT INTO public.admin_audit(admin_id, action, details)
  VALUES (auth.uid(), 'update_settings', _patch);
  RETURN _row;
END $$;

-- 6) Advanced stats
CREATE OR REPLACE FUNCTION public.admin_advanced_stats()
RETURNS JSON LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE WHEN public.has_role(auth.uid(),'admin'::public.app_role) THEN json_build_object(
    'users_total',     (SELECT count(*) FROM public.profiles),
    'users_today',     (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '24 hours'),
    'users_week',      (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
    'users_month',     (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '30 days'),
    'dau',             (SELECT count(DISTINCT id) FROM public.profiles WHERE last_seen_at > now() - interval '24 hours'),
    'wau',             (SELECT count(DISTINCT id) FROM public.profiles WHERE last_seen_at > now() - interval '7 days'),
    'mau',             (SELECT count(DISTINCT id) FROM public.profiles WHERE last_seen_at > now() - interval '30 days'),
    'online_now',      (SELECT count(*) FROM public.profiles WHERE last_seen_at > now() - interval '5 minutes'),
    'matches_total',   (SELECT count(*) FROM public.matches),
    'matches_today',   (SELECT count(*) FROM public.matches WHERE created_at > now() - interval '24 hours'),
    'matches_active',  (SELECT count(*) FROM public.matches WHERE status='active'),
    'matches_won',     (SELECT count(*) FROM public.matches WHERE status='won'),
    'matches_lost',    (SELECT count(*) FROM public.matches WHERE status IN ('lost','forfeit'))::int,
    'balance_total',   (SELECT COALESCE(sum(balance),0) FROM public.profiles),
    'deposits_today',  (SELECT COALESCE(sum(amount),0) FROM public.wallet_transactions WHERE type='deposit' AND created_at > now() - interval '24 hours'),
    'deposits_week',   (SELECT COALESCE(sum(amount),0) FROM public.wallet_transactions WHERE type='deposit' AND created_at > now() - interval '7 days'),
    'withdrawals_today',(SELECT COALESCE(sum(amount),0) FROM public.wallet_transactions WHERE type='withdraw' AND created_at > now() - interval '24 hours'),
    'wagered_today',   (SELECT COALESCE(sum(stake),0) FROM public.matches WHERE created_at > now() - interval '24 hours'),
    'house_profit_today',(SELECT COALESCE(sum(stake - COALESCE(payout,0)),0) FROM public.matches WHERE created_at > now() - interval '24 hours' AND status <> 'active'),
    'banned_users',    (SELECT count(*) FROM public.profiles WHERE banned)
  ) ELSE NULL END
$$;

-- 7) Active matches list
CREATE OR REPLACE FUNCTION public.admin_active_matches()
RETURNS TABLE(id uuid, user_id uuid, username text, stake numeric, started_at timestamptz, age_seconds int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT m.id, m.user_id, p.username, m.stake, m.started_at,
         EXTRACT(EPOCH FROM (now()-m.started_at))::int
    FROM public.matches m JOIN public.profiles p ON p.id=m.user_id
   WHERE public.has_role(auth.uid(),'admin'::public.app_role)
     AND m.status='active'
   ORDER BY m.started_at DESC LIMIT 200
$$;

-- 8) Ban / unban
CREATE OR REPLACE FUNCTION public.admin_set_banned(_user uuid, _banned boolean, _reason text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET banned=_banned, ban_reason=_reason, updated_at=now() WHERE id=_user;
  INSERT INTO public.admin_audit(admin_id, action, target_user, details)
  VALUES (auth.uid(), CASE WHEN _banned THEN 'ban_user' ELSE 'unban_user' END, _user, jsonb_build_object('reason',_reason));
  RETURN true;
END $$;

-- 9) Force end match
CREATE OR REPLACE FUNCTION public.admin_force_end_match(_match uuid, _refund boolean DEFAULT true)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _m public.matches; _bal numeric;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _m FROM public.matches WHERE id=_match FOR UPDATE;
  IF _m.status <> 'active' THEN RETURN false; END IF;
  IF _refund THEN
    SELECT balance INTO _bal FROM public.profiles WHERE id=_m.user_id FOR UPDATE;
    UPDATE public.profiles SET balance=balance+_m.stake WHERE id=_m.user_id;
    INSERT INTO public.wallet_transactions(user_id,type,amount,balance_after,description)
    VALUES (_m.user_id,'refund',_m.stake,_bal+_m.stake,'Reembolso admin partida '||substr(_match::text,1,8));
  END IF;
  UPDATE public.matches SET status='forfeit', settled_at=now() WHERE id=_match;
  INSERT INTO public.admin_audit(admin_id,action,target_user,details)
  VALUES (auth.uid(),'force_end_match',_m.user_id,jsonb_build_object('match',_match,'refund',_refund));
  RETURN true;
END $$;

-- 10) Broadcast
CREATE OR REPLACE FUNCTION public.admin_broadcast(_title text, _body text, _kind text DEFAULT 'info')
RETURNS public.admin_notifications LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _row public.admin_notifications;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.admin_notifications(title,body,kind,created_by)
  VALUES (_title,_body,_kind,auth.uid()) RETURNING * INTO _row;
  INSERT INTO public.admin_audit(admin_id,action,details)
  VALUES (auth.uid(),'broadcast',jsonb_build_object('title',_title,'kind',_kind));
  RETURN _row;
END $$;

-- 11) Heartbeat (any authenticated user can ping)
CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.profiles SET last_seen_at = now() WHERE id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_settings(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_advanced_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_active_matches() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_banned(uuid,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_force_end_match(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_broadcast(text,text,text) TO authenticated;

-- 12) Block banned users from starting matches and applying wallet (extra guard)
CREATE OR REPLACE FUNCTION public.guard_user_not_banned()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _b boolean;
BEGIN
  SELECT banned INTO _b FROM public.profiles WHERE id=auth.uid();
  IF _b THEN RAISE EXCEPTION 'Conta suspensa'; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.guard_user_not_banned() TO authenticated;
