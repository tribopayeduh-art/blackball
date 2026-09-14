
-- 1) matches: hide server_seed and rtp_outcome from players
REVOKE SELECT ON public.matches FROM authenticated, anon;
GRANT SELECT (id, user_id, stake, payout, status, started_at, settled_at, created_at, payout_multiplier, skin_id)
  ON public.matches TO authenticated;

-- 2) profiles: prevent players from updating privileged columns
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (username) ON public.profiles TO authenticated;

-- 3) app_settings: admin-only read
REVOKE SELECT ON public.app_settings FROM anon, authenticated;
GRANT SELECT ON public.app_settings TO authenticated;
DROP POLICY IF EXISTS "app_settings read" ON public.app_settings;
CREATE POLICY "app_settings admin read" ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role));

-- 4) rtp_config: admin-only read
REVOKE SELECT ON public.rtp_config FROM anon, authenticated;
GRANT SELECT ON public.rtp_config TO authenticated;
DROP POLICY IF EXISTS "rtp readable" ON public.rtp_config;
CREATE POLICY "rtp admin read" ON public.rtp_config
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role));

-- 5) Revoke EXECUTE from PUBLIC/anon on every SECURITY DEFINER function in public
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END $$;
