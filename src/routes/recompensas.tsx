import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Crown, Trophy, Target, Zap, ChevronLeft, Check, Lock } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/recompensas")({
  head: () => ({
    meta: [
      { title: "Recompensas — Black 8 Ball" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecompensasPage,
});

type Mission = {
  id: string;
  kind: "play" | "win" | "wager";
  target: number;
  progress: number;
  reward: number;
  claimed: boolean;
};
type Leader = { user_id: string; username: string; wins: number; profit: number; level: number };
type Profile = { username: string; balance: number; xp: number; level: number };

const xpForLevel = (lvl: number) => Math.pow(lvl - 1, 2) * 100;

const MISSION_LABELS: Record<Mission["kind"], { title: string; icon: ReactNode; unit: string }> = {
  play:  { title: "Jogue 3 partidas hoje",         icon: <Zap className="h-4 w-4" />,    unit: "partidas" },
  win:   { title: "Vença 1 partida hoje",          icon: <Trophy className="h-4 w-4" />, unit: "vitória" },
  wager: { title: "Aposte R$ 50 no total hoje",    icon: <Target className="h-4 w-4" />, unit: "R$" },
};

function RecompensasPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: p }, { data: m }, { data: lb }] = await Promise.all([
      supabase.from("profiles").select("username,balance,xp,level").eq("id", user.id).single(),
      supabase.rpc("ensure_daily_missions"),
      supabase.rpc("weekly_leaderboard"),
    ]);
    if (p) setProfile(p as Profile);
    if (m) setMissions(m as Mission[]);
    if (lb) setLeaders(lb as Leader[]);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function claimMission(id: string) {
    if (busy) return;
    setBusy(id);
    const { error } = await supabase.rpc("claim_mission", { _mission_id: id });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Recompensa creditada");
    await load();
  }

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando recompensas…
      </div>
    );
  }

  const curLvlXp = xpForLevel(profile.level);
  const nextLvlXp = xpForLevel(profile.level + 1);
  const xpInto = Math.max(0, profile.xp - curLvlXp);
  const xpSpan = Math.max(1, nextLvlXp - curLvlXp);
  const xpPct = Math.min(100, Math.round((xpInto / xpSpan) * 100));

  return (
    <div className="min-h-screen bg-black text-foreground pb-24 page-enter">
      <AppHeader balance={profile.balance} />
      <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-4">
        <h1 className="font-black text-sm tracking-[0.15em] uppercase text-foreground">Recompensas</h1>
      </div>

      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 space-y-5">
        {/* LEVEL + XP */}
        <Card className="relative overflow-hidden p-5 bg-gradient-to-br from-card via-card to-background border-[var(--gold)]/40">
          <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[var(--gold)]/20 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[var(--gold)] to-amber-700 p-[2px]">
              <div className="h-full w-full rounded-full bg-black flex items-center justify-center text-xl font-black text-[var(--gold)]">
                {profile.level}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-[var(--gold)]" />
                <span className="font-black text-sm tracking-wider uppercase">Nível {profile.level}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">XP total: <span className="font-mono text-foreground">{profile.xp.toLocaleString("pt-BR")}</span></div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Próximo</div>
              <div className="font-mono text-sm font-black text-[var(--gold)]">{xpInto}/{xpSpan}</div>
            </div>
          </div>
          <div className="relative mt-4 h-2.5 rounded-full bg-background/60 overflow-hidden border border-border/60">
            <div className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-amber-300 transition-all" style={{ width: `${xpPct}%` }} />
          </div>
          <p className="relative mt-3 text-[11px] text-muted-foreground">
            Ganhe XP em cada partida. A cada novo nível você recebe <span className="text-[var(--gold)] font-bold">+R$ 25</span> automaticamente.
          </p>
        </Card>

        {/* DAILY MISSIONS */}
        <Card className="p-4 bg-card/70 border-border/60">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-sm tracking-tight flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Missões diárias
            </h2>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Renovam à meia-noite UTC</span>
          </div>
          <ul className="space-y-2">
            {missions.map((m) => {
              const meta = MISSION_LABELS[m.kind];
              const pct = Math.min(100, Math.round((Number(m.progress) / Number(m.target)) * 100));
              const ready = Number(m.progress) >= Number(m.target) && !m.claimed;
              return (
                <li key={m.id} className="rounded-xl border border-border/50 bg-background/40 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-7 w-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center">{meta.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black truncate">{meta.title}</div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">
                        {Number(m.progress)} / {Number(m.target)} {meta.unit}
                      </div>
                    </div>
                    <button
                      disabled={!ready || !!busy}
                      onClick={() => claimMission(m.id)}
                      className={`shrink-0 h-9 px-3 rounded-lg text-[10px] font-black tracking-wider uppercase inline-flex items-center gap-1 transition ${
                        m.claimed
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          : ready
                            ? "bg-[var(--gold)] text-black hover:brightness-110"
                            : "bg-background/40 text-muted-foreground border border-border/40"
                      }`}
                    >
                      {m.claimed ? (<><Check className="h-3 w-3" /> Resgatado</>)
                        : ready ? (<>+R$ {Number(m.reward).toFixed(0)}</>)
                        : (<><Lock className="h-3 w-3" /> R$ {Number(m.reward).toFixed(0)}</>)}
                    </button>
                  </div>
                  <div className="h-1.5 rounded-full bg-background/60 overflow-hidden">
                    <div className={`h-full ${m.claimed ? "bg-emerald-500" : "bg-primary"} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* WEEKLY LEADERBOARD */}
        <Card className="p-4 bg-card/70 border-border/60">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-sm tracking-tight flex items-center gap-2">
              <Trophy className="h-4 w-4 text-[var(--gold)]" /> Ranking semanal
            </h2>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">por lucro</span>
          </div>
          {leaders.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sem partidas registradas nesta semana ainda.</p>
          ) : (
            <ol className="divide-y divide-border/60">
              {leaders.slice(0, 20).map((l, i) => {
                const isMe = l.user_id === user.id;
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                return (
                  <li key={l.user_id} className={`py-2.5 flex items-center gap-3 ${isMe ? "bg-[var(--gold)]/5 -mx-2 px-2 rounded-md" : ""}`}>
                    <div className="w-7 text-center font-black text-xs tabular-nums text-muted-foreground">
                      {medal ?? `#${i + 1}`}
                    </div>
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-secondary to-card border border-[var(--gold)]/50 flex items-center justify-center text-xs font-black">
                      {l.username?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black truncate flex items-center gap-1.5">
                        {l.username}
                        {isMe && <span className="text-[8px] px-1 rounded bg-[var(--gold)] text-black uppercase">Você</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Lv {l.level} • {l.wins} vit</div>
                    </div>
                    <div className={`font-mono font-black text-sm tabular-nums ${Number(l.profit) >= 0 ? "text-primary" : "text-destructive"}`}>
                      {Number(l.profit) >= 0 ? "+" : ""}R$ {Number(l.profit).toFixed(0)}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="mt-3 text-[10px] text-muted-foreground text-center">
            O top 3 da semana recebe prêmios surpresa toda segunda-feira.
          </p>
        </Card>

        <div className="text-center">
          <Link to="/" className="text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
            Voltar ao painel
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
