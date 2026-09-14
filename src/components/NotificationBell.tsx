import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * NotificationPopups — headless component. Subscribes to realtime
 * notifications and shows unread items as toast popups on page load
 * and as they arrive. No header UI.
 */
export function NotificationPopups({ userId }: { userId: string | null }) {
  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    const show = (n: Notif) => {
      if (shownPopups.has(n.id)) return;
      shownPopups.add(n.id);
      if (n.link) {
        toast(n.title, {
          description: n.message ?? undefined,
          action: { label: "Abrir", onClick: () => { window.location.href = n.link!; } },
        });
      } else {
        toast(n.title, { description: n.message ?? undefined });
      }
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try { new Notification(n.title, { body: n.message ?? "", icon: "/favicon.ico", tag: n.id }); } catch {}
      }
    };

    (async () => {
      if (initialFetchDone.has(userId)) return;
      initialFetchDone.add(userId);
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
        try { await Notification.requestPermission(); } catch {}
      }
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(5);
      if (!mounted || !data) return;
      const ordered = [...(data as Notif[])].reverse();
      ordered.forEach((n, i) => setTimeout(() => show(n), i * 400));
    })();

    if (popupChannels.has(userId)) {
      return () => { mounted = false; };
    }
    const ch = supabase
      .channel(`notif-pop:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => show(payload.new as Notif),
      )
      .subscribe();
    popupChannels.set(userId, ch);

    return () => {
      mounted = false;
    };
  }, [userId]);

  return null;
}

// Module-level dedupe so remounts across route changes don't re-fire toasts
const shownPopups = new Set<string>();
const initialFetchDone = new Set<string>();
const popupChannels = new Map<string, ReturnType<typeof supabase.channel>>();

type Notif = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function NotificationBell({ userId }: { userId: string | null }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (mounted && data) setItems(data as Notif[]);
    })();

    const ch = supabase
      .channel(`notif:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Notif;
          setItems((prev) => [n, ...prev].slice(0, 30));
          toast(n.title, { description: n.message ?? undefined });
          // Browser push
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(n.title, { body: n.message ?? "", icon: "/favicon.ico", tag: n.id });
            } catch {}
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [userId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function openPanel() {
    setOpen((v) => !v);
    // Ask push permission on first open
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch {}
    }
  }

  async function markAll() {
    if (!userId || unread === 0) return;
    setItems((p) => p.map((n) => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
  }

  async function removeOne(id: string) {
    setItems((p) => p.filter((n) => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={openPanel}
        aria-label="Notificações"
        className="relative h-9 w-9 rounded-xl border border-white/10 bg-[#111] inline-flex items-center justify-center text-foreground hover:border-white/25 transition"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black inline-flex items-center justify-center ring-2 ring-black">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[88vw] max-w-sm rounded-2xl bg-[#0a0a0a] border border-white/10 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.9)] z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <div className="text-xs font-bold tracking-wide uppercase text-foreground">Notificações</div>
            <div className="flex items-center gap-2">
              <button
                onClick={markAll}
                className="text-[10px] text-[var(--gold)] hover:underline disabled:opacity-40"
                disabled={unread === 0}
              >
                Marcar todas
              </button>
              <Link
                to="/notificacoes"
                onClick={() => setOpen(false)}
                className="text-[10px] text-white/60 hover:text-white"
              >
                Ver todas
              </Link>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-white/5">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-white/40">
                Nenhuma notificação ainda.
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`group px-3 py-2.5 flex gap-2 items-start hover:bg-white/[0.03] transition ${
                    !n.read ? "bg-[var(--gold)]/[0.04]" : ""
                  }`}
                >
                  <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${!n.read ? "bg-[var(--gold)]" : "bg-white/15"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-foreground truncate">{n.title}</div>
                    {n.message && (
                      <div className="text-[11px] text-white/60 line-clamp-2">{n.message}</div>
                    )}
                    <div className="text-[9px] text-white/30 mt-0.5">{timeAgo(n.created_at)} atrás</div>
                  </div>
                  <button
                    onClick={() => removeOne(n.id)}
                    className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded-md hover:bg-white/10 inline-flex items-center justify-center text-white/40 hover:text-white transition"
                    aria-label="Remover"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
          {unread > 0 && (
            <div className="px-3 py-2 border-t border-white/10 text-[10px] text-white/40 flex items-center gap-1">
              <Check className="h-3 w-3" /> {unread} não lida{unread > 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}