REVOKE EXECUTE ON FUNCTION public.wallet_apply(public.tx_type, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_start(numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_settle(uuid, boolean, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_active_match() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purchase_cue(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.equip_cue(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cue_skin_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_starter_cue() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.wallet_apply(public.tx_type, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_start(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_settle(uuid, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_active_match() TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_cue(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_cue(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cue_skin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_starter_cue() TO service_role;