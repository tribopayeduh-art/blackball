
CREATE OR REPLACE FUNCTION public.admin_list_cue_skins()
RETURNS SETOF public.cue_skins
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT * FROM public.cue_skins
  WHERE public.has_role(auth.uid(),'admin'::public.app_role)
  ORDER BY price ASC;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_cue_skin(_id uuid, _patch jsonb)
RETURNS public.cue_skins
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _row public.cue_skins;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.cue_skins(slug, name, price, payout_multiplier, active)
    VALUES (
      COALESCE(_patch->>'slug','novo-'||substr(md5(random()::text),1,6)),
      COALESCE(_patch->>'name','Novo taco'),
      COALESCE((_patch->>'price')::numeric, 0),
      COALESCE((_patch->>'payout_multiplier')::numeric, 1.0),
      COALESCE((_patch->>'active')::boolean, true)
    ) RETURNING * INTO _row;
  ELSE
    UPDATE public.cue_skins SET
      slug = COALESCE(_patch->>'slug', slug),
      name = COALESCE(_patch->>'name', name),
      price = COALESCE((_patch->>'price')::numeric, price),
      payout_multiplier = COALESCE((_patch->>'payout_multiplier')::numeric, payout_multiplier),
      active = COALESCE((_patch->>'active')::boolean, active)
    WHERE id=_id RETURNING * INTO _row;
  END IF;
  INSERT INTO public.admin_audit(admin_id, action, details)
  VALUES (auth.uid(),'upsert_cue_skin', jsonb_build_object('id',_row.id,'patch',_patch));
  RETURN _row;
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_cue_skin(_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.cue_skins WHERE id=_id;
  INSERT INTO public.admin_audit(admin_id,action,details) VALUES (auth.uid(),'delete_cue_skin',jsonb_build_object('id',_id));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.admin_top_affiliates(_limit int DEFAULT 50)
RETURNS TABLE(referrer_id uuid, username text, email text, referred_count bigint, total_commission numeric, total_volume numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH agg AS (
    SELECT p.id AS rid, p.username, u.email::text AS email,
      (SELECT count(*) FROM public.profiles r WHERE r.referred_by = p.id)::bigint AS rc,
      COALESCE((SELECT sum(commission) FROM public.referral_earnings re WHERE re.referrer_id=p.id),0)::numeric AS tc,
      COALESCE((SELECT sum(deposit_amount) FROM public.referral_earnings re WHERE re.referrer_id=p.id),0)::numeric AS tv
    FROM public.profiles p JOIN auth.users u ON u.id=p.id
    WHERE EXISTS (SELECT 1 FROM public.profiles r WHERE r.referred_by = p.id)
  )
  SELECT rid, username, email, rc, tc, tv FROM agg
  WHERE public.has_role(auth.uid(),'admin'::public.app_role)
  ORDER BY tc DESC NULLS LAST LIMIT _limit;
$$;

CREATE OR REPLACE FUNCTION public.admin_recent_referral_earnings(_limit int DEFAULT 100)
RETURNS TABLE(id uuid, created_at timestamptz, referrer text, referred text, deposit_amount numeric, commission numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT re.id, re.created_at,
    pr1.username AS referrer, pr2.username AS referred,
    re.deposit_amount, re.commission
  FROM public.referral_earnings re
  LEFT JOIN public.profiles pr1 ON pr1.id=re.referrer_id
  LEFT JOIN public.profiles pr2 ON pr2.id=re.referred_id
  WHERE public.has_role(auth.uid(),'admin'::public.app_role)
  ORDER BY re.created_at DESC LIMIT _limit;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_progress(_user uuid, _xp int, _level int)
RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _p public.profiles;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET xp = COALESCE(_xp, xp), level = COALESCE(_level, level), updated_at = now()
  WHERE id=_user RETURNING * INTO _p;
  INSERT INTO public.admin_audit(admin_id,action,target_user,details)
  VALUES (auth.uid(),'set_progress',_user,jsonb_build_object('xp',_xp,'level',_level));
  RETURN _p;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_list_cue_skins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_cue_skin(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_cue_skin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_top_affiliates(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_recent_referral_earnings(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_progress(uuid,int,int) TO authenticated;
