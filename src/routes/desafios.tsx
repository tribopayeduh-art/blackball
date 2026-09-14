import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";
import {
  Plus, Swords, Trophy, Zap, Filter, RefreshCw, Wallet,
  Home, BarChart3, User as UserIcon, Menu, Crown, X, Target, TrendingUp, DollarSign,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/desafios")({
  head: () => ({
    meta: [
      { title: "Desafios em tempo real — Black 8 Ball" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DesafiosPage,
});

type Mode = "8 BALL" | "9 BALL";
type Status = "open" | "taken" | "expired";
type Challenge = {
  id: string;
  host: string;
  level: number;
  stake: number;
  mode: Mode;
  region: string;
  winrate: number;
  secondsLeft: number;
  status: Status;
  _endsAt?: number;
};

const NAMES = [
  "Maicon", "Kelvin", "Jonathan", "Rafa", "Bruno", "Diego", "Lucas", "Vitor",
  "Caio", "Pedro", "Thiago", "André", "Gustavo", "Rodrigo", "Felipe", "Renan",
  "Matheus", "Igor", "Léo", "Murilo", "Júlio", "Wesley", "Eduardo", "Marcos",
  "Vinicius", "Henrique", "Otávio", "Erick", "Davi", "Samuel", "Yuri", "Cauã",
];
const MODES: Mode[] = ["8 BALL", "9 BALL"];
const STAKES = [5, 10, 25, 50, 75, 100, 150, 200, 300, 500];
const REGIONS = ["SP", "RJ", "MG", "RS", "BA", "PR", "PE", "DF", "CE", "GO"];

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
const makeChallenge = (): Challenge => ({
  id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  host: pick(NAMES),
  level: 3 + Math.floor(Math.random() * 60),
  stake: pick(STAKES),
  mode: pick(MODES),
  region: pick(REGIONS),
  winrate: 35 + Math.floor(Math.random() * 55),
  secondsLeft: 25 + Math.floor(Math.random() * 60),
  status: "open",
});
const fmtTimer = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

type FilterMode = "all" | "8 BALL" | "9 BALL";

function DesafiosPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [list, setList] = useState<Challenge[]>(() => Array.from({ length: 6 }, makeChallenge));
  const [filter, setFilter] = useState<FilterMode>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmC, setConfirmC] = useState<Challenge | null>(null);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);

  const refreshBalance = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("balance").eq("id", user.id).single();
    if (data) setBalance(Number(data.balance));
  }, [user]);
  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  // Tick: countdown, mark expired/taken, sweep finished
  useEffect(() => {
    const t = setInterval(() => {
      setList((prev) => {
        const next: Challenge[] = [];
        for (const c of prev) {
          if (c.status !== "open") {
            if (c._endsAt && Date.now() > c._endsAt) continue;
            next.push(c);
            continue;
          }
          const s = c.secondsLeft - 1;
          if (s <= 0) { next.push({ ...c, secondsLeft: 0, status: "expired", _endsAt: Date.now() + 1500 }); continue; }
          if (Math.random() < 0.025) { next.push({ ...c, status: "taken", _endsAt: Date.now() + 1500 }); continue; }
          next.push({ ...c, secondsLeft: s });
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Spawn new challenges (keeps 4-8 open)
  useEffect(() => {
    let cancelled = false;
    const schedule = () => {
      const delay = 2000 + Math.random() * 4500;
      setTimeout(() => {
        if (cancelled) return;
        setList((prev) => {
          const openCount = prev.filter((c) => c.status === "open").length;
          if (openCount >= 8) return prev;
          return [makeChallenge(), ...prev].slice(0, 12);
        });
        schedule();
      }, delay);
    };
    schedule();
    return () => { cancelled = true; };
  }, []);

  async function accept(c: Challenge) {
    if (busyId) return;
    if (c.stake > balance) { toast.error("Saldo insuficiente para esse desafio."); return; }
    setConfirmC(null);
    setBusyId(c.id);
    setList((prev) => prev.map((x) => x.id === c.id ? { ...x, status: "taken", _endsAt: Date.now() + 1200 } : x));
    toast.success(`Desafio aceito! Entrando na mesa contra ${c.host}…`);
    setTimeout(() => nav({ to: "/play", search: { stake: c.stake } }), 350);
  }

  function refreshList() {
    setList((prev) => {
      const fresh = Array.from({ length: 4 }, makeChallenge);
      return [...fresh, ...prev.filter((c) => c.status === "open")].slice(0, 12);
    });
    toast("Atualizando feed…");
  }

  if (loading || !user) return null;

  const visible = list.filter((c) => filter === "all" || c.mode === filter);
  const openCount = list.filter((c) => c.status === "open").length;

  return (
    <div className="platform-challenges-page min-h-screen pb-24 bg-black relative overflow-hidden text-foreground page-enter">
      <AppHeader balance={balance} />
      {/* HERO */}
      <section className="relative px-3 sm:px-4 pt-3">
        <div className="platform-wide-banner relative max-w-2xl mx-auto rounded-2xl overflow-hidden border border-primary/35">
          <img
            src="/platform/banners/challenges-v2.png"
            alt="Prêmio em dobro — vença a partida e receba até 2x o valor apostado"
            className="platform-banner-image block w-full"
          />
          <span className="platform-banner-shade" />
          <span className="platform-banner-copy is-centered"><small>JOGADORES ONLINE</small><strong>DESAFIOS <em>AO VIVO</em></strong></span>
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <div className="hidden xs:flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur border border-white/10 px-2.5 py-1">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-70" />
                <span className="relative inline-block h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] font-black text-emerald-400 tracking-wider">{openCount} AO VIVO</span>
            </div>
            <button
              onClick={refreshList}
              aria-label="Atualizar"
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl border border-[var(--gold)]/60 bg-black/70 backdrop-blur inline-flex items-center justify-center text-[var(--gold)] hover:bg-black/90 transition"
            >
              <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      </section>

      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 space-y-3">
        {/* Filter chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button className="shrink-0 h-10 w-10 rounded-xl border border-white/10 bg-[#111] inline-flex items-center justify-center text-muted-foreground">
            <Filter className="h-4 w-4" />
          </button>
          {([
            { id: "all", label: "TODOS" },
            { id: "8 BALL", label: "8 BALL", dot: "#000" },
            { id: "9 BALL", label: "9 BALL", dot: "#facc15" },
          ] as { id: FilterMode; label: string; dot?: string }[]).map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`shrink-0 h-10 px-4 rounded-full border text-[11px] font-black tracking-wider uppercase transition inline-flex items-center gap-2 ${
                  active
                    ? "bg-[var(--gold)]/10 border-[var(--gold)] text-[var(--gold)] shadow-[0_0_0_3px_rgba(212,175,55,0.08)]"
                    : "border-white/10 bg-[#141414] text-white/80 hover:text-white"
                }`}
              >
                {f.id !== "all" && (
                  <span className="relative inline-flex h-4 w-4 rounded-full bg-black border border-white/20 items-center justify-center">
                    <span className="absolute inset-0.5 rounded-full" style={{ background: f.id === "8 BALL" ? "#000" : "radial-gradient(circle, #facc15 55%, #000 56%)" }} />
                    <span className="relative text-[7px] font-black text-white">{f.id === "8 BALL" ? "8" : "9"}</span>
                  </span>
                )}
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Feed */}
        <div className="challenge-feed space-y-3">
          {visible.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-8 text-center text-xs text-muted-foreground">
              Aguardando novos desafios…
            </div>
          )}

          {visible.map((c) => {
            const isOpen = c.status === "open";
            const isTaken = c.status === "taken";
            const urgent = isOpen && c.secondsLeft <= 10;
            const canAfford = c.stake <= balance;
            const ballBg = c.mode === "8 BALL" ? "#000" : "radial-gradient(circle, #facc15 55%, #000 56%)";
            const ballNum = c.mode === "8 BALL" ? "8" : "9";

            return (
              <div
                key={c.id}
                className={`relative rounded-2xl border bg-gradient-to-b from-[#161616] to-[#0d0d0d] p-3 sm:p-4 shadow-xl shadow-black/40 transition-all duration-500 ${
                  isOpen ? `border-white/5 ${urgent ? "ring-1 ring-destructive/40" : ""}` : isTaken ? "border-emerald-500/30 opacity-70" : "border-destructive/30 opacity-50"
                }`}
              >
                {/* Top: avatar + info */}
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="relative shrink-0 flex flex-col items-center">
                    <div className="h-14 w-14 sm:h-[72px] sm:w-[72px] rounded-full bg-black border-2 border-[var(--gold)] flex items-center justify-center text-xl sm:text-3xl font-black text-white shadow-[0_0_18px_-4px_rgba(212,175,55,0.6)]">
                      {c.host.charAt(0)}
                    </div>
                    <span className="-mt-2 px-1.5 py-0.5 rounded-full bg-[var(--gold)] text-black text-[9px] font-black inline-flex items-center gap-0.5 shadow">
                      <Trophy className="h-2.5 w-2.5" /> {c.level}
                    </span>
                  </div>

                  {/* Middle info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-sm sm:text-lg text-white truncate">{c.host}</span>
                      <span className="text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded-md bg-[#1c1c1c] border border-white/10 text-white/80">
                        {c.region}
                      </span>
                      <span className="text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded-md bg-black border border-[var(--gold)] text-[var(--gold)] inline-flex items-center gap-1">
                        <span className="relative inline-flex h-3 w-3 rounded-full items-center justify-center" style={{ background: ballBg }}>
                          <span className="text-[6px] font-black text-white">{ballNum}</span>
                        </span>
                        {c.mode}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 sm:gap-5">
                      <div className="flex items-center gap-1.5">
                        <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[var(--gold)] shrink-0" />
                        <div className="leading-none">
                          <div className="font-black text-xs sm:text-sm text-white">{c.winrate}%</div>
                          <div className="text-[8px] font-black tracking-widest text-white/50 mt-0.5">WIN RATE</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[var(--gold)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6M5 5l2-2M19 5l-2-2"/></svg>
                        <div className={`leading-none ${urgent ? "animate-pulse" : ""}`}>
                          <div className={`font-black text-xs sm:text-sm tabular-nums ${urgent ? "text-destructive" : "text-white"}`}>{fmtTimer(c.secondsLeft)}</div>
                          <div className="text-[8px] font-black tracking-widest text-white/50 mt-0.5">TEMPO</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stake / Prize / Action — stacks below on mobile, inline on sm+ */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-black border border-white/10 px-2.5 py-1.5 flex items-center justify-between">
                    <span className="text-[9px] font-black tracking-widest text-white/50">APOSTA</span>
                    <span className="font-black text-sm text-white tabular-nums">R$ {c.stake}</span>
                  </div>
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1.5 flex items-center justify-between">
                    <span className="text-[9px] font-black tracking-widest text-emerald-400/80">PRÊMIO</span>
                    <span className="font-black text-sm text-emerald-400 tabular-nums">R$ {c.stake * 2}</span>
                  </div>
                </div>
                <button
                  disabled={!isOpen || !canAfford || busyId === c.id}
                  onClick={() => setConfirmC(c)}
                  className="mt-2 w-full h-10 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 text-black font-black text-xs tracking-[0.18em] uppercase inline-flex items-center justify-center gap-1.5 shadow-[0_8px_22px_-10px_rgba(16,185,129,0.9)] hover:brightness-110 active:scale-[0.99] transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isTaken ? "Aceito por outro" : !isOpen ? "Expirado" : !canAfford ? (<><Wallet className="h-3.5 w-3.5" /> Sem saldo</>) : (<><Zap className="h-3.5 w-3.5" /> Aceitar desafio</>)}
                </button>

                {/* Timer bar */}
                {isOpen && (
                  <div className="mt-3 h-1 rounded-full bg-black/60 overflow-hidden">
                    <div
                      className={`h-full transition-all relative ${urgent ? "bg-destructive" : "bg-gradient-to-r from-[var(--gold)] to-amber-400"}`}
                      style={{ width: `${Math.min(100, (c.secondsLeft / 60) * 100)}%` }}
                    >
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.6)]" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </main>

      {confirmC && typeof document !== "undefined" && createPortal((() => {
        const c = confirmC;
        const hash = [...c.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
        const played = 40 + (hash % 460);
        const wins = Math.round((played * c.winrate) / 100);
        const losses = played - wins;
        const avgStake = 35 + ((hash >>> 4) % 90);
        const totalWon = wins * avgStake;
        const stats = [
          { icon: <Target className="h-4 w-4" />, label: "Partidas", value: played.toString() },
          { icon: <Trophy className="h-4 w-4" />, label: "Vitórias", value: wins.toString() },
          { icon: <X className="h-4 w-4" />, label: "Derrotas", value: losses.toString() },
          { icon: <TrendingUp className="h-4 w-4" />, label: "Win rate", value: `${c.winrate}%` },
          { icon: <DollarSign className="h-4 w-4" />, label: "Total ganho", value: `R$ ${totalWon.toLocaleString("pt-BR")}` },
          { icon: <Crown className="h-4 w-4" />, label: "Nível", value: c.level.toString() },
        ];
         return (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-3 animate-in fade-in overflow-y-auto" onClick={() => setConfirmC(null)}>
            <div className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border border-[var(--gold)]/30 shadow-[0_20px_60px_-10px_rgba(212,175,55,0.3)]" onClick={(e) => e.stopPropagation()}>
              <div className="relative p-5 bg-gradient-to-b from-[var(--gold)]/10 to-transparent border-b border-white/5">
                <button onClick={() => setConfirmC(null)} className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 inline-flex items-center justify-center text-white/60">
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-black border-2 border-[var(--gold)] flex items-center justify-center text-2xl font-black text-white shadow-[0_0_24px_-4px_rgba(212,175,55,0.7)]">
                    {c.host.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-xl text-white truncate">{c.host}</div>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#1c1c1c] border border-white/10 text-white/80">{c.region}</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-black border border-[var(--gold)] text-[var(--gold)]">{c.mode}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <p className="text-[10px] font-black tracking-widest text-white/40 uppercase mb-2">Estatísticas do oponente</p>
                <div className="grid grid-cols-2 gap-2">
                  {stats.map((s) => (
                    <div key={s.label} className="rounded-lg bg-black/60 border border-white/10 px-3 py-2.5 flex items-center gap-2">
                      <span className="text-[var(--gold)] shrink-0">{s.icon}</span>
                      <div className="min-w-0 leading-none">
                        <div className="font-black text-sm text-white tabular-nums truncate">{s.value}</div>
                        <div className="text-[9px] font-black tracking-widest text-white/40 uppercase mt-1">{s.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-black border border-white/10 px-3 py-2 flex items-center justify-between">
                    <span className="text-[9px] font-black tracking-widest text-white/50">APOSTA</span>
                    <span className="font-black text-sm text-white tabular-nums">R$ {c.stake}</span>
                  </div>
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 flex items-center justify-between">
                    <span className="text-[9px] font-black tracking-widest text-emerald-400/80">PRÊMIO</span>
                    <span className="font-black text-sm text-emerald-400 tabular-nums">R$ {c.stake * 2}</span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => setConfirmC(null)} className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 text-white font-black text-xs tracking-[0.18em] uppercase hover:bg-white/10 transition">
                    Cancelar
                  </button>
                  <button onClick={() => accept(c)} className="flex-1 h-11 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 text-black font-black text-xs tracking-[0.18em] uppercase inline-flex items-center justify-center gap-1.5 shadow-[0_8px_22px_-10px_rgba(16,185,129,0.9)] hover:brightness-110 active:scale-[0.99] transition">
                    <Zap className="h-3.5 w-3.5" /> Confirmar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })(), document.body)}

      <BottomNav />
    </div>
  );
}

function NavBtn({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 transition py-1 min-w-0 ${active ? "text-[var(--gold)]" : "text-muted-foreground hover:text-foreground"}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="text-[8px] sm:text-[9px] font-black tracking-[0.12em] uppercase leading-none truncate max-w-full">{label}</span>
    </button>
  );
}
