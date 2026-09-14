
CREATE OR REPLACE FUNCTION public.cue_skin_stats()
RETURNS TABLE(skin_id uuid, total_wins bigint, total_profit numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id AS skin_id,
    COALESCE(SUM(CASE WHEN m.status = 'won' THEN 1 ELSE 0 END), 0)::bigint AS total_wins,
    COALESCE(SUM(CASE WHEN m.status = 'won' THEN (m.payout - m.stake) ELSE 0 END), 0)::numeric AS total_profit
  FROM public.cue_skins s
  LEFT JOIN public.matches m ON m.skin_id = s.id
  GROUP BY s.id;
$$;

REVOKE ALL ON FUNCTION public.cue_skin_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cue_skin_stats() TO authenticated;
