
-- handle_new_user is a trigger function, never meant to be called via the API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- wallet_apply is intentionally callable by signed-in users (it's the wallet RPC),
-- but should never be reachable by anonymous visitors.
REVOKE ALL ON FUNCTION public.wallet_apply(public.tx_type, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallet_apply(public.tx_type, numeric, text) TO authenticated;
