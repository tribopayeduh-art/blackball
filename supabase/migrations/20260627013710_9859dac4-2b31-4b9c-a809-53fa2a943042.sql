
-- Trigger: notify on wallet transactions
CREATE OR REPLACE FUNCTION public.notify_wallet_tx()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_title TEXT;
  v_msg TEXT;
  v_type TEXT;
BEGIN
  v_type := NEW.type::text;
  IF v_type = 'deposit' THEN
    v_title := '💰 Depósito confirmado';
    v_msg := 'R$ ' || to_char(NEW.amount, 'FM999G999G990D00') || ' creditado na sua conta.';
  ELSIF v_type = 'withdraw' THEN
    v_title := '🏦 Saque processado';
    v_msg := 'R$ ' || to_char(abs(NEW.amount), 'FM999G999G990D00') || ' debitado.';
  ELSIF v_type = 'win' THEN
    v_title := '🏆 Você venceu!';
    v_msg := 'Ganhou R$ ' || to_char(NEW.amount, 'FM999G999G990D00');
  ELSIF v_type = 'bet' THEN
    RETURN NEW; -- skip bets to avoid spam
  ELSE
    v_title := 'Movimentação na carteira';
    v_msg := COALESCE(NEW.description, '');
  END IF;
  INSERT INTO public.notifications(user_id, type, title, message)
  VALUES (NEW.user_id, v_type, v_title, v_msg);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_wallet_tx ON public.wallet_transactions;
CREATE TRIGGER trg_notify_wallet_tx
AFTER INSERT ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.notify_wallet_tx();

-- Trigger: notify on friendships
CREATE OR REPLACE FUNCTION public.notify_friendship()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT username INTO v_from_name FROM public.profiles WHERE id = NEW.requester_id;
    INSERT INTO public.notifications(user_id, type, title, message, link)
    VALUES (NEW.addressee_id, 'friend_request', '👥 Novo pedido de amizade',
            COALESCE(v_from_name, 'Alguém') || ' quer ser seu amigo.', '/social');
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    SELECT username INTO v_from_name FROM public.profiles WHERE id = NEW.addressee_id;
    INSERT INTO public.notifications(user_id, type, title, message, link)
    VALUES (NEW.requester_id, 'friend_accepted', '✅ Amizade aceita',
            COALESCE(v_from_name, 'Seu amigo') || ' aceitou seu pedido.', '/social');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_friendship ON public.friendships;
CREATE TRIGGER trg_notify_friendship
AFTER INSERT OR UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.notify_friendship();

REVOKE EXECUTE ON FUNCTION public.notify_wallet_tx() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_friendship() FROM PUBLIC, anon, authenticated;
