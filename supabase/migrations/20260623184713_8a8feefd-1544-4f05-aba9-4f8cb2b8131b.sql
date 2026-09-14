
-- ============ RTP CONFIG ============
CREATE TABLE IF NOT EXISTS public.rtp_config (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  target_rtp NUMERIC NOT NULL DEFAULT 0.95 CHECK (target_rtp > 0 AND target_rtp < 2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = TRUE)
);
GRANT SELECT ON public.rtp_config TO authenticated;
GRANT ALL    ON public.rtp_config TO service_role;
ALTER TABLE public.rtp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rtp readable" ON public.rtp_config FOR SELECT TO authenticated USING (true);
INSERT INTO public.rtp_config (id, target_rtp) VALUES (TRUE, 0.95) ON CONFLICT DO NOTHING;

-- ============ CUE SKINS ============
CREATE TYPE public.cue_rarity AS ENUM ('common','rare','epic','legendary');

CREATE TABLE public.cue_skins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  rarity public.cue_rarity NOT NULL DEFAULT 'common',
  price NUMERIC NOT NULL CHECK (price >= 0),
  payout_multiplier NUMERIC NOT NULL DEFAULT 1.0 CHECK (payout_multiplier >= 1 AND payout_multiplier <= 3),
  color TEXT NOT NULL DEFAULT '#cda05a',
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cue_skins TO authenticated;
GRANT ALL    ON public.cue_skins TO service_role;
ALTER TABLE public.cue_skins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "skins readable" ON public.cue_skins FOR SELECT TO authenticated USING (active = TRUE);

INSERT INTO public.cue_skins (slug,name,rarity,price,payout_multiplier,color,description) VALUES
 ('starter',  'Taco Iniciante',  'common',    0,    1.00, '#9c7a45', 'Seu taco padrão. Sólido e confiável.'),
 ('oak',      'Carvalho Clássico','common',   100,  1.05, '#c08a4a', 'Madeira nobre com punho de couro.'),
 ('crimson',  'Crimson Edge',    'rare',      500,  1.10, '#dc2626', 'Lacquer vermelho intenso.'),
 ('emerald',  'Esmeralda',       'rare',      800,  1.15, '#10b981', 'Inlays de jade nas pontas.'),
 ('obsidian', 'Obsidiana',       'epic',      2000, 1.25, '#1f2937', 'Carbono escuro, equilíbrio cirúrgico.'),
 ('royal',    'Cetro Real',      'legendary', 5000, 1.50, '#f5c518', 'Banhado a ouro. Apenas os reis empunham.')
ON CONFLICT (slug) DO NOTHING;

-- ============ USER CUES ============
CREATE TABLE public.user_cues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  skin_id UUID NOT NULL REFERENCES public.cue_skins(id) ON DELETE CASCADE,
  equipped BOOLEAN NOT NULL DEFAULT FALSE,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, skin_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_cues TO authenticated;
GRANT ALL ON public.user_cues TO service_role;
ALTER TABLE public.user_cues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own cues"   ON public.user_cues FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- writes via SECURITY DEFINER RPCs only
CREATE UNIQUE INDEX user_cues_one_equipped ON public.user_cues (user_id) WHERE equipped = TRUE;

-- Give every existing profile the starter cue, equipped
INSERT INTO public.user_cues (user_id, skin_id, equipped)
SELECT p.id, s.id, TRUE
FROM public.profiles p
CROSS JOIN public.cue_skins s
WHERE s.slug = 'starter'
ON CONFLICT (user_id, skin_id) DO NOTHING;

-- Auto-grant starter cue on new profile
CREATE OR REPLACE FUNCTION public.grant_starter_cue()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid UUID;
BEGIN
  SELECT id INTO _sid FROM public.cue_skins WHERE slug = 'starter' LIMIT 1;
  IF _sid IS NOT NULL THEN
    INSERT INTO public.user_cues (user_id, skin_id, equipped)
    VALUES (NEW.id, _sid, TRUE)
    ON CONFLICT (user_id, skin_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_grant_starter
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.grant_starter_cue();

-- ============ MATCHES: server seed + pre-decided outcome ============
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS server_seed TEXT,
  ADD COLUMN IF NOT EXISTS rtp_outcome BOOLEAN,
  ADD COLUMN IF NOT EXISTS payout_multiplier NUMERIC NOT NULL DEFAULT 2.0,
  ADD COLUMN IF NOT EXISTS skin_id UUID REFERENCES public.cue_skins(id);

-- ============ match_start: RTP-decided result, server seed, skin payout ============
CREATE OR REPLACE FUNCTION public.match_start(_stake NUMERIC)
RETURNS public.matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _bal NUMERIC;
  _rtp NUMERIC;
  _mult NUMERIC := 2.0;
  _skin UUID;
  _skin_mult NUMERIC := 1.0;
  _seed TEXT;
  _r NUMERIC;
  _p NUMERIC;
  _won BOOLEAN;
  _new public.matches;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _stake IS NULL OR _stake <= 0 THEN RAISE EXCEPTION 'Stake must be positive'; END IF;
  IF _stake > 10000 THEN RAISE EXCEPTION 'Stake too large'; END IF;

  IF EXISTS (SELECT 1 FROM public.matches WHERE user_id = _uid AND status = 'active') THEN
    RAISE EXCEPTION 'Já existe uma partida em andamento';
  END IF;

  SELECT balance INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _bal IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF _bal < _stake THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;

  -- Equipped skin (if any)
  SELECT uc.skin_id, s.payout_multiplier INTO _skin, _skin_mult
  FROM public.user_cues uc
  JOIN public.cue_skins s ON s.id = uc.skin_id
  WHERE uc.user_id = _uid AND uc.equipped = TRUE
  LIMIT 1;
  _skin_mult := COALESCE(_skin_mult, 1.0);
  _mult := 2.0 * _skin_mult;  -- effective payout multiplier on win

  -- Target RTP from config
  SELECT target_rtp INTO _rtp FROM public.rtp_config WHERE id = TRUE;
  _rtp := COALESCE(_rtp, 0.95);

  -- Win probability: p * mult = RTP  =>  p = RTP / mult
  _p := LEAST(0.95, GREATEST(0.05, _rtp / _mult));

  -- Server seed (anti-cheat: outcome decided NOW, client cannot influence)
  _seed := encode(gen_random_bytes(32), 'hex');
  _r := ('x'||substr(_seed,1,12))::bit(48)::bigint::numeric / 281474976710656.0;  -- 0..1
  _won := _r < _p;

  UPDATE public.profiles SET balance = balance - _stake WHERE id = _uid;

  INSERT INTO public.matches (user_id, stake, server_seed, rtp_outcome, payout_multiplier, skin_id)
  VALUES (_uid, _stake, _seed, _won, _mult, _skin)
  RETURNING * INTO _new;

  INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, description)
  VALUES (_uid, 'bet', _stake, _bal - _stake, 'Aposta 8-ball #' || substr(_new.id::text, 1, 8));

  RETURN _new;
END $$;

-- ============ match_settle: server-authoritative — ignores client _won ============
CREATE OR REPLACE FUNCTION public.match_settle(_match_id UUID, _won BOOLEAN, _forfeit BOOLEAN DEFAULT FALSE)
RETURNS public.matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _m public.matches;
  _payout NUMERIC := 0;
  _bal NUMERIC;
  _new_status public.match_status;
  _true_won BOOLEAN;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _m FROM public.matches WHERE id = _match_id AND user_id = _uid FOR UPDATE;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF _m.status <> 'active' THEN RETURN _m; END IF;

  -- Auto-forfeit if match older than 30 min (anti-stalling)
  IF _m.started_at < now() - INTERVAL '30 minutes' THEN
    _forfeit := TRUE;
  END IF;

  -- Use server-decided outcome, NOT what the client claims
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

  RETURN _m;
END $$;

-- ============ purchase_cue ============
CREATE OR REPLACE FUNCTION public.purchase_cue(_skin_id UUID)
RETURNS public.user_cues
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _price NUMERIC;
  _bal NUMERIC;
  _row public.user_cues;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT price INTO _price FROM public.cue_skins WHERE id = _skin_id AND active = TRUE;
  IF _price IS NULL THEN RAISE EXCEPTION 'Taco não encontrado'; END IF;

  IF EXISTS (SELECT 1 FROM public.user_cues WHERE user_id = _uid AND skin_id = _skin_id) THEN
    RAISE EXCEPTION 'Você já possui este taco';
  END IF;

  SELECT balance INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _bal < _price THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;

  IF _price > 0 THEN
    UPDATE public.profiles SET balance = balance - _price WHERE id = _uid;
    INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, description)
    VALUES (_uid, 'withdraw', _price, _bal - _price, 'Compra de taco');
  END IF;

  INSERT INTO public.user_cues (user_id, skin_id, equipped)
  VALUES (_uid, _skin_id, FALSE)
  RETURNING * INTO _row;

  RETURN _row;
END $$;

-- ============ equip_cue ============
CREATE OR REPLACE FUNCTION public.equip_cue(_skin_id UUID)
RETURNS public.user_cues
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _row public.user_cues;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_cues WHERE user_id = _uid AND skin_id = _skin_id) THEN
    RAISE EXCEPTION 'Você não possui este taco';
  END IF;

  UPDATE public.user_cues SET equipped = FALSE WHERE user_id = _uid AND equipped = TRUE;
  UPDATE public.user_cues SET equipped = TRUE  WHERE user_id = _uid AND skin_id = _skin_id
  RETURNING * INTO _row;

  RETURN _row;
END $$;

REVOKE ALL ON FUNCTION public.match_start(NUMERIC)         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_settle(UUID,BOOLEAN,BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purchase_cue(UUID)           FROM PUBLIC;
REVOKE ALL ON FUNCTION public.equip_cue(UUID)              FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_start(NUMERIC)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_settle(UUID,BOOLEAN,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_cue(UUID)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_cue(UUID)              TO authenticated;
