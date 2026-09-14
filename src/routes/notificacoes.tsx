import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Bell, ChevronLeft, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/notificacoes")({
  component: NotificacoesPage,
  head: () => ({ meta: [{ title: "Notificações | Black 8 Ball" }] }),
});

type Notif = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function NotificacoesPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let live = true;
    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (live && data) setItems(data as Notif[]);
    })();
    const ch = supabase
      .channel(`notif-page:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (p) => setItems((prev) => [p.new as Notif, ...prev])
      )
      .subscribe();
    return () => {
      live = false;
      supabase.removeChannel(ch);
    };
  }, [user]);

  async function markRead(n: Notif) {
    if (n.read) return;
    setItems((p) => p.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    await supabase.from("notifications").update({ read: true }).eq("id", n.id);
  }

  async function markAll() {
    if (!user) return;
    setBusy(true);
    setItems((p) => p.map((n) => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setBusy(false);
    toast.success("Todas marcadas como lidas");
  }

  async function clearAll() {
    if (!user) return;
    if (!confirm("Apagar todas as notificações?")) return;
    setBusy(true);
    setItems([]);
    await supabase.from("notifications").delete().eq("user_id", user.id);
    setBusy(false);
  }

  async function removeOne(id: string) {
    setItems((p) => p.filter((n) => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
  }

  if (loading || !user) {
    return <div className="min-h-screen bg-black text-white grid place-items-center">Carregando…</div>;
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-black text-foreground pb-24">
      <AppHeader />
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-base font-black tracking-tight flex items-center gap-2">
              <Bell className="h-4 w-4 text-[var(--gold)]" /> Notificações
            </h1>
            <p className="text-[10px] text-white/40">{unread} não lida{unread === 1 ? "" : "s"} de {items.length}</p>
          </div>
          <button
            onClick={markAll}
            disabled={busy || unread === 0}
            className="text-[10px] px-2 py-1.5 rounded-lg border border-white/10 bg-[#111] hover:border-[var(--gold)]/40 disabled:opacity-40 inline-flex items-center gap-1"
          >
            <Check className="h-3 w-3" /> Marcar todas
          </button>
          <button
            onClick={clearAll}
            disabled={busy || items.length === 0}
            className="text-[10px] px-2 py-1.5 rounded-lg border border-white/10 bg-[#111] hover:border-rose-500/40 disabled:opacity-40 inline-flex items-center gap-1 text-rose-300"
          >
            <Trash2 className="h-3 w-3" /> Limpar
          </button>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-10 text-center">
            <Bell className="h-8 w-8 text-white/20 mx-auto mb-3" />
            <p className="text-sm text-white/50">Você não tem notificações ainda.</p>
          </div>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              onClick={() => markRead(n)}
              className={`group cursor-pointer rounded-2xl border p-3 flex gap-3 items-start transition ${
                !n.read
                  ? "bg-gradient-to-r from-[var(--gold)]/[0.08] to-transparent border-[var(--gold)]/30"
                  : "bg-[#0a0a0a] border-white/[0.06] hover:border-white/15"
              }`}
            >
              <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${!n.read ? "bg-[var(--gold)] shadow-[0_0_8px_rgba(212,175,55,0.8)]" : "bg-white/15"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-foreground">{n.title}</div>
                  <div className="text-[10px] text-white/30 shrink-0">{fmt(n.created_at)}</div>
                </div>
                {n.message && <div className="text-xs text-white/60 mt-0.5">{n.message}</div>}
                {n.link && (
                  <Link to={n.link} className="inline-block mt-2 text-[10px] text-[var(--gold)] hover:underline">
                    Abrir →
                  </Link>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeOne(n.id); }}
                className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded-md hover:bg-white/10 inline-flex items-center justify-center text-white/40 hover:text-rose-400 transition shrink-0"
                aria-label="Remover"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
}