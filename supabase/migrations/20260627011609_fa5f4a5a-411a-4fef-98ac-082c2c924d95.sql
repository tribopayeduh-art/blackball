
-- Convert chat_messages into 1:1 DMs between accepted friends
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Helper: are two users accepted friends?
CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = _a AND addressee_id = _b)
        OR (requester_id = _b AND addressee_id = _a))
  );
$$;
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;

-- Reset policies
DROP POLICY IF EXISTS "chat_messages_select" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_insert" ON public.chat_messages;
DROP POLICY IF EXISTS "chat read" ON public.chat_messages;
DROP POLICY IF EXISTS "chat insert" ON public.chat_messages;
DROP POLICY IF EXISTS "select chat" ON public.chat_messages;
DROP POLICY IF EXISTS "insert chat" ON public.chat_messages;

CREATE POLICY "dm_select" ON public.chat_messages FOR SELECT TO authenticated
USING (
  recipient_id IS NOT NULL
  AND (user_id = auth.uid() OR recipient_id = auth.uid())
);

CREATE POLICY "dm_insert" ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND recipient_id IS NOT NULL
  AND recipient_id <> auth.uid()
  AND public.are_friends(auth.uid(), recipient_id)
);
