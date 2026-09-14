
-- Chat global
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_created_at_idx ON public.chat_messages(created_at DESC);
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat read all auth" ON public.chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "chat insert own" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Amizades simétricas
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friend read own" ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() IN (requester_id, addressee_id));
CREATE POLICY "friend create" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "friend update addressee" ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() IN (requester_id, addressee_id));
CREATE POLICY "friend delete own" ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() IN (requester_id, addressee_id));

-- RPC: jogadores online (últimos 5 min) — não expõe last_seen do profile via select direto
CREATE OR REPLACE FUNCTION public.online_players(_limit int DEFAULT 30)
RETURNS TABLE(id uuid, username text, level int, last_seen_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, username, level, last_seen_at
  FROM public.profiles
  WHERE last_seen_at > now() - interval '5 minutes' AND NOT COALESCE(banned,false)
  ORDER BY last_seen_at DESC LIMIT _limit
$$;
REVOKE EXECUTE ON FUNCTION public.online_players(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.online_players(int) TO authenticated;

-- RPC: enviar convite por username
CREATE OR REPLACE FUNCTION public.friend_request(_username text)
RETURNS friendships LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _target uuid; _row public.friendships;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO _target FROM public.profiles WHERE lower(username) = lower(_username);
  IF _target IS NULL THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
  IF _target = _uid THEN RAISE EXCEPTION 'Não pode se adicionar'; END IF;
  INSERT INTO public.friendships(requester_id, addressee_id) VALUES (_uid, _target)
  ON CONFLICT (requester_id, addressee_id) DO UPDATE SET updated_at = now()
  RETURNING * INTO _row;
  RETURN _row;
END $$;
REVOKE EXECUTE ON FUNCTION public.friend_request(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.friend_request(text) TO authenticated;
