GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT SELECT ON public.matches TO authenticated;
GRANT SELECT ON public.user_cues TO authenticated;
GRANT SELECT ON public.cue_skins TO authenticated;
GRANT SELECT ON public.rtp_config TO authenticated;

GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.wallet_transactions TO service_role;
GRANT ALL ON public.matches TO service_role;
GRANT ALL ON public.user_cues TO service_role;
GRANT ALL ON public.cue_skins TO service_role;
GRANT ALL ON public.rtp_config TO service_role;

GRANT EXECUTE ON FUNCTION public.wallet_apply(public.tx_type, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_start(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_settle(uuid, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_active_match() TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_cue(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_cue(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cue_skin_stats() TO authenticated;