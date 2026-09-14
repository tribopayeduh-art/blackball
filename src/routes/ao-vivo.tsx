import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { BottomNav } from "@/components/BottomNav";
import { AppHeader } from "@/components/AppHeader";
import { ArrowLeft, Radio, Swords, Trophy } from "lucide-react";

export const Route = createFileRoute("/ao-vivo")({
  head: () => ({ meta: [{ title: "Ao Vivo — Partidas PvP" }] }),
  component: AoVivo,
});

type Live = {
  id: string; host_id: string; guest_id: string;
  host_name: string; guest_name: string;
  host_level: number; guest_level: number;
  stake: number; pot: number; shot_num: number;
  turn_user_id: string | null; updated_at: string;
};

function AoVivo() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<Live[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = async () => {
      const { data } = await supabase.rpc("live_pvp_matches", { _limit: 30 });
      if (alive && data) { setRows(data as Live[]); setBusy(false); }
    };
    load();
    const i = setInterval(load, 5000);
    return () => { alive = false; clearInterval(i); };
  }, [user]);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-400">Carregando…</div>;
  if (!user) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Link to="/auth" className="text-[var(--gold)] underline">Entrar para ver partidas ao vivo</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader />
      <div className="max-w-2xl mx-auto px-4 pt-4 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <h1 className="text-lg font-black uppercase tracking-widest text-white">Ao Vivo</h1>
        </div>
        <span className="ml-auto text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
          {rows.length} {rows.length === 1 ? "partida" : "partidas"}
        </span>
      </div>

      <main className="max-w-2xl mx-auto p-4 space-y-3">
        {busy && <p className="text-center text-sm text-zinc-500 py-12">Buscando partidas…</p>}
        {!busy && rows.length === 0 && (
          <div className="text-center py-16">
            <Radio className="h-12 w-12 mx-auto text-zinc-700 mb-3" />
            <p className="text-zinc-400 font-semibold">Nenhuma partida ao vivo agora</p>
            <p className="text-xs text-zinc-600 mt-1">Desafie um amigo para começar uma!</p>
          </div>
        )}
        {rows.map((m) => {
          const isParticipant = user.id === m.host_id || user.id === m.guest_id;
          return (
            <div key={m.id} className="rounded-2xl bg-gradient-to-br from-zinc-900 to-black border border-white/5 p-4 shadow-lg">
              <div className="flex items-center gap-3">
                <Player name={m.host_name} level={m.host_level} active={m.turn_user_id === m.host_id} />
                <div className="flex flex-col items-center px-2">
                  <Swords className="h-4 w-4 text-[var(--gold)]" />
                  <div className="mt-1 px-2 py-0.5 rounded-md bg-[var(--gold)]/10 border border-[var(--gold)]/30">
                    <div className="text-[8px] uppercase tracking-widest text-[var(--gold)]/80 font-bold">Pote</div>
                    <div className="text-xs font-black text-[var(--gold)] tabular-nums">R$ {Number(m.pot).toFixed(0)}</div>
                  </div>
                </div>
                <Player name={m.guest_name} level={m.guest_level} active={m.turn_user_id === m.guest_id} right />
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                <span>Tacada #{m.shot_num + 1}</span>
                {isParticipant ? (
                  <Link to="/pvp/$id" params={{ id: m.id }} className="px-3 py-1.5 rounded-lg bg-[var(--gold)] text-black font-black text-[10px]">
                    Voltar à mesa
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-400">
                    <Trophy className="h-3 w-3" /> R$ {(Number(m.pot) * 0.95).toFixed(2)} para o vencedor
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </main>
      <BottomNav />
    </div>
  );
}

function Player({ name, level, active, right }: { name: string; level: number; active: boolean; right?: boolean }) {
  return (
    <div className={`flex-1 ${right ? "text-left" : "text-right"}`}>
      <div className="flex items-center gap-2" style={{ flexDirection: right ? "row" : "row-reverse" }}>
        <div className={`h-10 w-10 rounded-full flex items-center justify-center font-black text-sm ${
          active ? "bg-emerald-500/20 ring-2 ring-emerald-400 text-emerald-200" : "bg-zinc-800 text-zinc-400"
        }`}>
          {(name || "?").slice(0, 1).toUpperCase()}
        </div>
        <div>
          <div className="font-black text-white text-sm leading-tight truncate max-w-[100px]">{name}</div>
          <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">Nv {level ?? 1}</div>
        </div>
      </div>
    </div>
  );
}