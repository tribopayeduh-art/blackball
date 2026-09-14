import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { BottomNav } from "@/components/BottomNav";
import { AppHeader } from "@/components/AppHeader";
import { ChevronLeft, Send, UserPlus, Check, X, Search, MessageCircle, Swords } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/social")({
  head: () => ({
    meta: [
      { title: "Social — Black 8 Ball" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SocialPage,
});

type ChatMsg = { id: string; user_id: string; recipient_id: string; username: string; body: string; created_at: string };
type Online = { id: string; username: string; level: number; last_seen_at: string };
type Friend = { id: string; requester_id: string; addressee_id: string; status: string };
type FriendPeer = { id: string; username: string };

function SocialPage() {
  const { user, loading } = useAuth();
  const username = (user?.user_metadata?.username as string | undefined)
    ?? user?.email?.split("@")[0]
    ?? "jogador";
  const [tab, setTab] = useState<"chat" | "online" | "amigos">("chat");

  if (loading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-zinc-500">Carregando…</div>;
  if (!user) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
      <div className="p-6 text-center max-w-sm rounded-3xl bg-[#0f0f0f] border border-zinc-800/50">
        <p className="mb-4 text-zinc-300">Faça login para acessar a área social.</p>
        <Link to="/auth" className="text-[#D4AF37] font-semibold">Entrar</Link>
      </div>
    </div>
  );

  return (
    <div className="social-clean min-h-screen pb-24 text-zinc-200" style={{ fontFamily: "'Inter', sans-serif" }}>
      <AppHeader />
      <div className="social-clean__wrap max-w-2xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6">
        <div className="social-clean__panel overflow-hidden">
          {/* Header */}
          <div className="pt-6 px-5 pb-3">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <Link to="/" className="p-1.5 -ml-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-[#D4AF37] transition">
                  <ChevronLeft className="h-4 w-4" />
                </Link>
                <div><small className="social-clean__eyebrow">COMUNIDADE</small><h1 className="text-xl font-bold text-white tracking-tight">Social</h1></div>
              </div>
              <div className="bg-zinc-900 p-2 rounded-full border border-zinc-800">
                <Search className="w-4 h-4 text-zinc-400" />
              </div>
            </div>
            {/* Tabs */}
            <div className="social-clean__tabs flex p-1 rounded-2xl">
              {([["chat","Chat"],["online","Online"],["amigos","Amigos"]] as const).map(([k,label]) => (
                <button key={k} onClick={() => setTab(k)}
                  className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-widest rounded-xl transition ${
                    tab === k
                      ? "active text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="px-2 pb-4">
            {tab === "chat" && <FriendsChat userId={user.id} username={username} />}
            {tab === "online" && <OnlineView />}
            {tab === "amigos" && <FriendsView userId={user.id} />}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

function FriendsChat({ userId, username }: { userId: string; username: string }) {
  const [friends, setFriends] = useState<FriendPeer[]>([]);
  const [loading, setLoading] = useState(true);
  const [peer, setPeer] = useState<FriendPeer | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from("friendships").select("*").eq("status", "accepted");
      if (!alive) return;
      const ids = (data ?? []).map((r: any) => r.requester_id === userId ? r.addressee_id : r.requester_id);
      if (!ids.length) { setFriends([]); setLoading(false); return; }
      const { data: profs } = await supabase.from("profiles").select("id,username").in("id", ids);
      if (!alive) return;
      setFriends((profs ?? []) as FriendPeer[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [userId]);

  if (loading) return <p className="text-center text-zinc-500 py-8 text-sm">Carregando…</p>;
  if (!friends.length) return (
    <div className="mx-2 my-3 p-6 text-center text-sm text-zinc-500 rounded-2xl bg-black/40 border border-zinc-800/50">
      Você ainda não tem amigos. Adicione amigos para começar a conversar.
    </div>
  );
  if (peer) return <DMView userId={userId} username={username} peer={peer} onBack={() => setPeer(null)} />;
  return (
    <div className="space-y-1 px-2 pt-2 max-h-[60vh] overflow-y-auto">
      {friends.map((f, i) => (
        <button key={f.id} onClick={() => setPeer(f)}
          className={`w-full text-left p-3 flex items-center rounded-2xl transition ${
            i === 0
              ? "bg-gradient-to-r from-zinc-900/60 to-transparent border-l-2 border-[#D4AF37]"
              : "hover:bg-white/5 border border-transparent hover:border-zinc-800"
          }`}>
          <div className="relative flex-shrink-0">
            <div className={`w-12 h-12 rounded-full p-0.5 ${i === 0 ? "border-2 border-[#D4AF37]/40" : "border border-zinc-800"}`}>
              <div className="w-full h-full rounded-full bg-gradient-to-br from-[#D4AF37]/30 to-amber-900/40 flex items-center justify-center text-sm font-bold text-zinc-100">
                {f.username.slice(0, 2).toUpperCase()}
              </div>
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#0f0f0f] rounded-full" />
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <div className="text-white font-bold text-sm tracking-wide truncate">{f.username}</div>
            <p className="text-[11px] text-zinc-500 truncate">Toque para conversar</p>
          </div>
          <MessageCircle className="w-4 h-4 text-zinc-600 ml-2" />
        </button>
      ))}
    </div>
  );
}

function DMView({ userId, username, peer, onBack }: { userId: string; username: string; peer: FriendPeer; onBack: () => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    supabase.from("chat_messages")
      .select("*")
      .or(`and(user_id.eq.${userId},recipient_id.eq.${peer.id}),and(user_id.eq.${peer.id},recipient_id.eq.${userId})`)
      .order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => { if (alive && data) setMsgs((data as ChatMsg[]).reverse()); });
    const ch = supabase.channel(`dm:${userId}:${peer.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (p) => {
        const m = p.new as ChatMsg;
        const between = (m.user_id === userId && m.recipient_id === peer.id) || (m.user_id === peer.id && m.recipient_id === userId);
        if (between) setMsgs((prev) => [...prev.slice(-199), m]);
      }).subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [userId, peer.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    const { error } = await supabase.from("chat_messages").insert({ user_id: userId, recipient_id: peer.id, username, body: text });
    setSending(false);
    if (error) toast.error(error.message); else setBody("");
  }, [body, sending, userId, username, peer.id]);

  const invite = useCallback(async () => {
    const raw = window.prompt(`Valor da aposta para desafiar ${peer.username} (R$):`, "10");
    if (!raw) return;
    const stake = Number(raw.replace(",", "."));
    if (!Number.isFinite(stake) || stake <= 0) { toast.error("Valor inválido"); return; }
    const { data, error } = await supabase.rpc("pvp_create_invite", {
      _guest_id: peer.id, _stake: stake,
    });
    if (error) { toast.error(error.message); return; }
    const matchId = (data as any)?.id;
    if (!matchId) { toast.error("Falha ao criar convite"); return; }
    await supabase.from("chat_messages").insert({
      user_id: userId, recipient_id: peer.id, username,
      body: `🎱PVP:${matchId}:${stake.toFixed(2)}`,
    });
    toast.success(`Convite enviado · R$ ${stake.toFixed(2)} debitados`);
  }, [peer.id, peer.username, userId, username]);

  const acceptInvite = useCallback(async (matchId: string) => {
    const { error } = await supabase.rpc("pvp_accept_invite", { _match_id: matchId });
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/pvp/$id", params: { id: matchId } });
  }, [navigate]);

  const declineInvite = useCallback(async (matchId: string) => {
    const { error } = await supabase.rpc("pvp_decline_invite", { _match_id: matchId });
    if (error) toast.error(error.message); else toast.success("Convite recusado");
  }, []);

  const openMyInvite = useCallback((matchId: string) => {
    navigate({ to: "/pvp/$id", params: { id: matchId } });
  }, [navigate]);

  return (
    <div className="flex flex-col h-[calc(100vh-260px)]">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-zinc-800/50">
        <button onClick={onBack} className="p-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-[#D4AF37] transition">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="w-10 h-10 rounded-full p-0.5 border-2 border-[#D4AF37]/40">
          <div className="w-full h-full rounded-full bg-gradient-to-br from-[#D4AF37]/30 to-amber-900/40 flex items-center justify-center text-xs font-bold text-zinc-100">
            {peer.username.slice(0, 2).toUpperCase()}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-white font-bold text-sm tracking-wide">{peer.username}</div>
          <div className="text-[10px] uppercase tracking-widest text-emerald-500 font-semibold">Online</div>
        </div>
        <button onClick={invite}
          className="px-3 h-9 flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#E6C670] to-[#B89130] text-black text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-[#D4AF37]/10 active:scale-95 transition">
          <Swords className="h-3.5 w-3.5" /> Desafiar
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {msgs.length === 0 && <p className="text-center text-sm text-zinc-600 py-8">Diga olá para {peer.username}!</p>}
        {msgs.map((m) => {
          const mine = m.user_id === userId;
          const pvpMatch = /^🎱PVP:([0-9a-f-]{36}):(\d+(?:\.\d+)?)$/.exec(m.body);
          const legacyInvite = /^🎱INVITE:(\d+(?:\.\d+)?)$/.exec(m.body);
          if (pvpMatch || legacyInvite) {
            const matchId = pvpMatch?.[1] ?? null;
            const stake = Number(pvpMatch?.[2] ?? legacyInvite?.[1] ?? 0);
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[78%] rounded-2xl p-3 bg-gradient-to-br from-zinc-900 to-black border border-[#D4AF37]/40 shadow-lg shadow-[#D4AF37]/10">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Swords className="h-4 w-4 text-[#D4AF37]" />
                    <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-bold">Convite para jogar</span>
                  </div>
                  <div className="text-white text-sm font-bold mb-2">Aposta R$ {stake.toFixed(2)}</div>
                  {mine ? (
                    matchId ? (
                      <button onClick={() => openMyInvite(matchId)}
                        className="w-full py-2 rounded-full bg-zinc-800 text-zinc-300 text-[11px] font-bold uppercase tracking-widest hover:bg-zinc-700 transition">
                        Aguardando {peer.username} · abrir mesa
                      </button>
                    ) : (
                      <div className="text-[11px] text-zinc-500">Aguardando {peer.username}…</div>
                    )
                  ) : matchId ? (
                    <div className="flex gap-2">
                      <button onClick={() => declineInvite(matchId)}
                        className="flex-1 py-2 rounded-full bg-zinc-800 text-zinc-300 text-[11px] font-bold uppercase tracking-widest hover:bg-zinc-700 transition">
                        Recusar
                      </button>
                      <button onClick={() => acceptInvite(matchId)}
                        className="flex-1 py-2 rounded-full bg-gradient-to-br from-[#E6C670] to-[#B89130] text-black text-[11px] font-bold uppercase tracking-widest active:scale-95 transition">
                        Aceitar
                      </button>
                    </div>
                  ) : (
                    <div className="text-[11px] text-zinc-500">Convite antigo · peça um novo</div>
                  )}
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] px-4 py-2.5 text-sm shadow-sm ${
                mine
                  ? "bg-gradient-to-br from-[#E6C670] to-[#B89130] text-black font-medium rounded-2xl rounded-br-md"
                  : "bg-zinc-900/80 text-zinc-200 border border-zinc-800/50 rounded-2xl rounded-bl-md"
              }`}>
                <div className="break-words whitespace-pre-wrap">{m.body}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="px-3 py-3 bg-black/60 border-t border-zinc-800/50 flex gap-2 items-center">
        <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={300} placeholder="Diga algo…"
          className="flex-1 bg-zinc-900/80 border border-zinc-800/50 rounded-full px-5 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#D4AF37]/40 transition" />
        <button type="submit" disabled={sending || !body.trim()}
          className="w-11 h-11 flex-shrink-0 bg-gradient-to-br from-[#E6C670] to-[#B89130] rounded-full flex items-center justify-center shadow-lg shadow-[#D4AF37]/10 active:scale-95 transition disabled:opacity-40">
          <Send className="w-4 h-4 text-black" />
        </button>
      </form>
    </div>
  );
}

function OnlineView() {
  const [list, setList] = useState<Online[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const load = () => supabase.rpc("online_players", { _limit: 50 }).then(({ data }) => {
      if (alive) { setList((data as Online[]) ?? []); setLoading(false); }
    });
    load();
    const id = setInterval(load, 15_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  if (loading) return <p className="text-center text-zinc-500 py-8 text-sm">Carregando…</p>;
  if (!list.length) return <p className="text-center text-zinc-500 py-8 text-sm">Ninguém online no momento.</p>;
  return (
    <div className="space-y-1 px-2 pt-2 max-h-[60vh] overflow-y-auto">
      {list.map((p) => (
        <div key={p.id} className="p-3 flex items-center rounded-2xl hover:bg-white/5 border border-transparent hover:border-zinc-800 transition">
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-full p-0.5 border border-zinc-800">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-[#D4AF37]/30 to-amber-900/40 flex items-center justify-center font-bold text-sm text-zinc-100">
                {p.username.slice(0, 2).toUpperCase()}
              </div>
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#0f0f0f] rounded-full" />
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <div className="text-white font-bold text-sm tracking-wide truncate">{p.username}</div>
            <div className="text-[10px] uppercase tracking-widest text-[#D4AF37]/80 font-semibold">Nível {p.level}</div>
          </div>
          <AddFriendBtn username={p.username} />
        </div>
      ))}
    </div>
  );
}

function AddFriendBtn({ username }: { username: string }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const add = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("friend_request", { _username: username });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
    toast.success(`Pedido enviado para ${username}`);
  };
  return (
    <button onClick={add} disabled={busy || sent}
      className={`h-9 px-3 flex items-center gap-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition disabled:opacity-60 ${
        sent
          ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
          : "border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10"
      }`}>
      {sent ? <><Check className="h-3.5 w-3.5" /> Enviado</> : <><UserPlus className="h-3.5 w-3.5" /> Add</>}
    </button>
  );
}

function FriendsView({ userId }: { userId: string }) {
  const [rows, setRows] = useState<(Friend & { other_username?: string })[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("friendships").select("*");
    if (!data) return;
    const ids = Array.from(new Set(data.flatMap((r: any) => [r.requester_id, r.addressee_id]).filter((id: string) => id !== userId)));
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id,username").in("id", ids)
      : { data: [] as any[] };
    const map = new Map((profs ?? []).map((p: any) => [p.id, p.username]));
    setRows(data.map((r: any) => ({ ...r, other_username: map.get(r.requester_id === userId ? r.addressee_id : r.requester_id) ?? "—" })));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = search.trim();
    if (!u) return;
    setBusy(true);
    const { error } = await supabase.rpc("friend_request", { _username: u });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(`Pedido enviado para ${u}`); setSearch(""); load(); }
  };

  const accept = async (id: string) => {
    const { error } = await supabase.from("friendships").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("friendships").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const incoming = rows.filter((r) => r.status === "pending" && r.addressee_id === userId);
  const outgoing = rows.filter((r) => r.status === "pending" && r.requester_id === userId);
  const accepted = rows.filter((r) => r.status === "accepted");

  return (
    <div className="space-y-5 px-2 pt-2 max-h-[60vh] overflow-y-auto">
      <form onSubmit={sendInvite} className="flex gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Adicionar por username…"
          className="flex-1 bg-zinc-900/80 border border-zinc-800/50 rounded-full px-5 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#D4AF37]/40 transition" />
        <button type="submit" disabled={busy || !search.trim()}
          className="px-4 rounded-full bg-gradient-to-br from-[#E6C670] to-[#B89130] text-black text-xs font-bold uppercase tracking-widest shadow-lg shadow-[#D4AF37]/10 disabled:opacity-40 flex items-center gap-1.5">
          <UserPlus className="h-3.5 w-3.5" /> Add
        </button>
      </form>

      {incoming.length > 0 && (
        <Section title={`Pedidos recebidos · ${incoming.length}`}>
          {incoming.map((r) => (
            <Row key={r.id} name={r.other_username!}>
              <button onClick={() => accept(r.id)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-br from-[#E6C670] to-[#B89130] text-black"><Check className="h-3.5 w-3.5" /></button>
              <button onClick={() => remove(r.id)} className="w-8 h-8 flex items-center justify-center rounded-full border border-zinc-800 text-zinc-400 hover:text-red-400 hover:border-red-500/30"><X className="h-3.5 w-3.5" /></button>
            </Row>
          ))}
        </Section>
      )}

      <Section title={`Amigos · ${accepted.length}`}>
        {accepted.length === 0 && <p className="text-sm text-zinc-500 px-2">Você ainda não tem amigos.</p>}
        {accepted.map((r) => (
          <Row key={r.id} name={r.other_username!}>
            <button onClick={() => remove(r.id)} className="w-8 h-8 flex items-center justify-center rounded-full border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-500/30"><X className="h-3.5 w-3.5" /></button>
          </Row>
        ))}
      </Section>

      {outgoing.length > 0 && (
        <Section title={`Enviados · ${outgoing.length}`}>
          {outgoing.map((r) => (
            <Row key={r.id} name={r.other_username!}>
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">Pendente</span>
              <button onClick={() => remove(r.id)} className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-500 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
            </Row>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-bold mb-2 px-2">{title}</h2>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="p-3 flex items-center rounded-2xl hover:bg-white/5 border border-transparent hover:border-zinc-800 transition">
      <div className="w-10 h-10 rounded-full p-0.5 border border-zinc-800 flex-shrink-0">
        <div className="w-full h-full rounded-full bg-gradient-to-br from-[#D4AF37]/30 to-amber-900/40 flex items-center justify-center text-xs font-bold text-zinc-100">
          {name.slice(0, 2).toUpperCase()}
        </div>
      </div>
      <div className="ml-3 flex-1 font-bold text-sm text-white truncate tracking-wide">{name}</div>
      <div className="flex gap-2 items-center">{children}</div>
    </div>
  );
}
