
-- Partners
CREATE TABLE public.api_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  api_secret TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  balance NUMERIC NOT NULL DEFAULT 0,
  callback_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.api_partners TO service_role;
ALTER TABLE public.api_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct access" ON public.api_partners FOR ALL USING (false) WITH CHECK (false);

-- Rounds (one row per external bet round)
CREATE TABLE public.api_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.api_partners(id) ON DELETE CASCADE,
  external_round_id TEXT NOT NULL,
  external_user_id TEXT NOT NULL,
  stake NUMERIC NOT NULL,
  payout NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',  -- open | won | lost | refunded
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  UNIQUE (partner_id, external_round_id)
);
GRANT ALL ON public.api_rounds TO service_role;
ALTER TABLE public.api_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct access" ON public.api_rounds FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX api_rounds_partner_created_idx ON public.api_rounds(partner_id, created_at DESC);

-- Call log
CREATE TABLE public.api_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.api_partners(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INT NOT NULL,
  payload JSONB,
  response JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.api_calls TO service_role;
ALTER TABLE public.api_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct access" ON public.api_calls FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX api_calls_partner_created_idx ON public.api_calls(partner_id, created_at DESC);

-- Admin RPCs
CREATE OR REPLACE FUNCTION public.admin_list_partners()
RETURNS SETOF public.api_partners
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.api_partners
  WHERE public.has_role(auth.uid(),'admin'::public.app_role)
  ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_partner(_name TEXT, _callback_url TEXT DEFAULT NULL)
RETURNS public.api_partners
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _row public.api_partners;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.api_partners(name, api_key, api_secret, callback_url)
  VALUES (
    _name,
    'pk_' || encode(extensions.gen_random_bytes(16),'hex'),
    'sk_' || encode(extensions.gen_random_bytes(32),'hex'),
    _callback_url
  ) RETURNING * INTO _row;
  INSERT INTO public.admin_audit(admin_id,action,details)
  VALUES (auth.uid(),'create_partner',jsonb_build_object('id',_row.id,'name',_name));
  RETURN _row;
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_partner(_id UUID, _patch JSONB)
RETURNS public.api_partners
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.api_partners;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.api_partners SET
    name = COALESCE(_patch->>'name', name),
    active = COALESCE((_patch->>'active')::boolean, active),
    callback_url = COALESCE(_patch->>'callback_url', callback_url),
    notes = COALESCE(_patch->>'notes', notes),
    balance = COALESCE((_patch->>'balance')::numeric, balance),
    updated_at = now()
  WHERE id=_id RETURNING * INTO _row;
  INSERT INTO public.admin_audit(admin_id,action,details)
  VALUES (auth.uid(),'update_partner',jsonb_build_object('id',_id,'patch',_patch));
  RETURN _row;
END $$;

CREATE OR REPLACE FUNCTION public.admin_rotate_partner_secret(_id UUID)
RETURNS public.api_partners
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _row public.api_partners;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.api_partners
    SET api_secret = 'sk_' || encode(extensions.gen_random_bytes(32),'hex'), updated_at = now()
   WHERE id=_id RETURNING * INTO _row;
  INSERT INTO public.admin_audit(admin_id,action,details)
  VALUES (auth.uid(),'rotate_partner_secret',jsonb_build_object('id',_id));
  RETURN _row;
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_partner(_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.api_partners WHERE id=_id;
  INSERT INTO public.admin_audit(admin_id,action,details) VALUES (auth.uid(),'delete_partner',jsonb_build_object('id',_id));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.admin_partner_stats(_id UUID)
RETURNS JSON
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.has_role(auth.uid(),'admin'::public.app_role) THEN json_build_object(
    'rounds_total',(SELECT count(*) FROM public.api_rounds WHERE partner_id=_id),
    'rounds_today',(SELECT count(*) FROM public.api_rounds WHERE partner_id=_id AND created_at > now()-interval '24 hours'),
    'wagered_total',(SELECT COALESCE(sum(stake),0) FROM public.api_rounds WHERE partner_id=_id),
    'payout_total',(SELECT COALESCE(sum(payout),0) FROM public.api_rounds WHERE partner_id=_id),
    'house_profit',(SELECT COALESCE(sum(stake-payout),0) FROM public.api_rounds WHERE partner_id=_id AND status<>'open'),
    'last_call',(SELECT max(created_at) FROM public.api_calls WHERE partner_id=_id),
    'calls_today',(SELECT count(*) FROM public.api_calls WHERE partner_id=_id AND created_at > now()-interval '24 hours')
  ) ELSE NULL END;
$$;

CREATE OR REPLACE FUNCTION public.admin_recent_api_calls(_partner UUID DEFAULT NULL, _limit INT DEFAULT 100)
RETURNS SETOF public.api_calls
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.api_calls
  WHERE public.has_role(auth.uid(),'admin'::public.app_role)
    AND (_partner IS NULL OR partner_id=_partner)
  ORDER BY created_at DESC LIMIT _limit;
$$;
