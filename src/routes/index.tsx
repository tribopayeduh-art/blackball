import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";
import {
  LogOut, Wallet, ArrowDownToLine, ArrowUpFromLine, Play, History,
  Home, User as UserIcon, Eye, EyeOff, TrendingUp, Trophy, Bell, Plus, Timer, Swords, Crown, ChevronRight, Store,
  Shield, Medal, Target, Flame, Settings, Share2, Copy, Zap, Award, Star, Menu, BarChart3,
  Globe, Volume2, VolumeX, Moon, Sun, Lock, HelpCircle, FileText, MessageCircle, Pencil, Check, X, Mail, Smartphone, KeyRound, Trash2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { AppHeader } from "@/components/AppHeader";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import bannerImg from "@/assets/live-matches-banner.jpg";
import { BottomNav } from "@/components/BottomNav";
import { useServerFn } from "@tanstack/react-start";
import { createPixDeposit, checkPixDeposit } from "@/lib/pix.functions";
import {
  LOCAL_TEST_MODE,
  applyLocalWallet,
  resetLocalGameState,
  updateLocalProfile,
} from "@/lib/local-test-mode";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel — 8 Ball Cash" },
      { name: "description", content: "Teste o jogo 8-ball localmente, sem login e sem banco de dados." },
    ],
    links: [
      // Pré-carrega a página do jogo enquanto o usuário está no painel
      { rel: "prefetch", href: "/game/index.html", as: "document" },
      { rel: "prefetch", href: "/game/html5games/gameapi/v1.js", as: "script" },
    ],
  }),
  component: Dashboard,
});

type Profile = { username: string; balance: number; referral_code: string; referred_by: string | null };
type Tx = { id: string; type: string; amount: number; balance_after: number; description: string | null; created_at: string };

type Tab = "home" | "wallet" | "ranking" | "profile";

// Simulação de tráfego de jogadores — solicitações entram, expiram e somem
const SIM_NAMES = [
  "Maicon", "Kelvin", "Jonathan", "Rafa", "Bruno", "Diego", "Lucas", "Vitor",
  "Caio", "Pedro", "Thiago", "André", "Gustavo", "Rodrigo", "Felipe", "Renan",
  "Matheus", "Igor", "Léo", "Murilo", "Júlio", "Wesley", "Eduardo", "Marcos",
];
const SIM_MODES = ["8 BALL", "9 BALL"] as const;
const SIM_STAKES = [10, 25, 50, 75, 100, 150, 200];
type BetReq = {
  id: string;
  host: string;
  level: number;
  stake: number;
  mode: string;
  secondsLeft: number;
  status: "open" | "taken" | "expired";
};
const fmtTimer = (s: number) => {
  const m = Math.max(0, Math.floor(s / 60));
  const r = Math.max(0, s % 60);
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];
const makeReq = (): BetReq => ({
  id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  host: pick(SIM_NAMES),
  level: 5 + Math.floor(Math.random() * 40),
  stake: pick(SIM_STAKES),
  mode: pick(SIM_MODES),
  secondsLeft: 20 + Math.floor(Math.random() * 40), // 20-60s
  status: "open",
});

function Dashboard() {
  const nav = useNavigate();
  const { user, loading, isAdmin } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [amount, setAmount] = useState("50");
  const [walletAction, setWalletAction] = useState<"deposit" | "withdraw">("deposit");
  const [pixKeyType, setPixKeyType] = useState(() => typeof window === "undefined" ? "cpf" : localStorage.getItem("bb:pix-key-type") || "cpf");
  const [pixKey, setPixKey] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem("bb:pix-key") || "");
  const [busy, setBusy] = useState(false);
  const [pixModal, setPixModal] = useState<{ code: string; image: string; identifier: string; amount: number } | null>(null);
  const pixCreate = useServerFn(createPixDeposit);
  const pixCheck = useServerFn(checkPixDeposit);
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "home";
    try {
      const t = sessionStorage.getItem("bb:open-tab");
      if (t) {
        sessionStorage.removeItem("bb:open-tab");
        if (t === "wallet" || t === "profile" || t === "ranking" || t === "home") return t as Tab;
      }
    } catch {}
    return "home";
  });
  const [hideBalance, setHideBalance] = useState(false);

  // Tráfego simulado de solicitações de aposta
  const [requests, setRequests] = useState<BetReq[]>(() =>
    Array.from({ length: 3 }, makeReq),
  );

  // Tick de 1s: decrementa timers, marca expirados/aceitos, remove após pequena animação
  useEffect(() => {
    const tick = setInterval(() => {
      setRequests((prev) => {
        const next: BetReq[] = [];
        for (const r of prev) {
          if (r.status !== "open") {
            // mantém por ~1.5s para mostrar o estado, depois some
            if ((r as any)._endsAt && Date.now() > (r as any)._endsAt) continue;
            next.push(r);
            continue;
          }
          const s = r.secondsLeft - 1;
          if (s <= 0) {
            next.push({ ...r, secondsLeft: 0, status: "expired", ...( { _endsAt: Date.now() + 1500 } as any) });
            continue;
          }
          // 4% de chance por segundo de outro jogador aceitar antes
          if (Math.random() < 0.04) {
            next.push({ ...r, status: "taken", ...( { _endsAt: Date.now() + 1500 } as any) });
            continue;
          }
          next.push({ ...r, secondsLeft: s });
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  // Spawn de novas solicitações em intervalos aleatórios (mantém 2-5 abertas)
  useEffect(() => {
    let cancelled = false;
    const schedule = () => {
      const delay = 2500 + Math.random() * 5000; // 2.5-7.5s
      setTimeout(() => {
        if (cancelled) return;
        setRequests((prev) => {
          const openCount = prev.filter((r) => r.status === "open").length;
          if (openCount >= 5) return prev;
          return [makeReq(), ...prev].slice(0, 6);
        });
        schedule();
      }, delay);
    };
    schedule();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    // Admins podem navegar livremente pelo app público; o redirecionamento
    // para /admin acontece apenas logo após o login (via /auth).
  }, [user, loading, nav]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [{ data: p, error: profileError }, { data: t }] = await Promise.all([
      supabase.from("profiles").select("username, balance, referral_code, referred_by").eq("id", user.id).single(),
      supabase.from("wallet_transactions").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    if (p) {
      setProfile({ username: p.username, balance: Number(p.balance), referral_code: p.referral_code, referred_by: p.referred_by });
    } else {
      const fallbackUsername = user.user_metadata?.username || user.email?.split("@")[0] || "Player";
      const newCode = Math.random().toString(36).slice(2, 10).toUpperCase();
      const { data: created } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          username: fallbackUsername,
          referral_code: newCode,
        })
        .select("username, balance, referral_code, referred_by")
        .single();

      setProfile({
        username: created?.username ?? fallbackUsername,
        balance: Number(created?.balance ?? 0),
        referral_code: created?.referral_code ?? newCode,
        referred_by: created?.referred_by ?? null,
      });

      if (profileError) {
        console.warn("Perfil recriado para liberar o carregamento do app.", profileError.message);
      }
    }
    setTxs((t as any) ?? []);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: surface referral commissions / bonuses arriving asynchronously
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`wallet-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const tx = payload.new as { type: string; amount: number; description: string | null };
          const desc = tx.description ?? "";
          if (desc.startsWith("Comissão de indicação")) {
            toast.success(`💰 Comissão recebida: R$ ${Number(tx.amount).toFixed(2)}`, { description: "Um amigo indicado fez um depósito." });
            refresh();
          } else if (desc.startsWith("Bônus de nível")) {
            toast.success(`⭐ ${desc}: +R$ ${Number(tx.amount).toFixed(2)}`);
          } else if (desc.startsWith("Depósito PIX")) {
            toast.success(`✅ Depósito confirmado: +R$ ${Number(tx.amount).toFixed(2)}`);
            setPixModal(null);
            refresh();
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refresh]);

  async function move(type: "deposit" | "withdraw") {
    if (busy) return;
    const normalized = amount.trim().replace(",", ".");
    const amt = Number(normalized);

    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Digite um valor válido para continuar.");
      return;
    }

    const centsSafeAmount = Math.round(amt * 100) / 100;

    if (type === "withdraw") {
      const cleanKey = pixKey.trim();
      if (cleanKey.length < 5) {
        toast.error("Informe uma chave PIX válida para solicitar o saque.");
        return;
      }
      try {
        localStorage.setItem("bb:pix-key-type", pixKeyType);
        localStorage.setItem("bb:pix-key", cleanKey);
      } catch {}
    }

    if (LOCAL_TEST_MODE) {
      setBusy(true);
      try {
        const tx = applyLocalWallet(type, centsSafeAmount);
        setProfile((current) => current ? { ...current, balance: Number(tx.balance_after) } : current);
        setTxs((current) => [tx, ...current.filter((item) => item.id !== tx.id)].slice(0, 20));
        toast.success(type === "deposit"
          ? `+ R$ ${centsSafeAmount.toFixed(2)} adicionados para teste`
          : `- R$ ${centsSafeAmount.toFixed(2)} retirados no teste`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível alterar o saldo local.");
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      if (type === "deposit") {
        try {
          const pix = await pixCreate({ data: { amount: centsSafeAmount } });
          setPixModal({ code: pix.pixCode, image: pix.pixImage, identifier: pix.identifier, amount: pix.amount });
          toast.success("PIX gerado. Escaneie o QR Code para concluir.");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Falha ao gerar PIX.");
        }
        return;
      }
      const { data, error } = await supabase.rpc("wallet_apply", {
        _type: "withdraw",
        _amount: centsSafeAmount,
        _description: `Saque PIX · ${pixKeyType.toUpperCase()}`,
      });

      if (error) {
        const message = error.message?.toLowerCase().includes("permission denied")
          ? "Carteira sem permissão no backend. Recarregue a página e tente novamente."
          : error.message?.toLowerCase().includes("insufficient funds")
            ? "Saldo insuficiente para realizar o saque."
            : error.message || "Não foi possível concluir a operação.";
        toast.error(message);
        return;
      }

      const tx = data as Tx | null;
      if (tx) {
        setProfile((current) => current ? { ...current, balance: Number(tx.balance_after) } : current);
        setTxs((current) => [tx, ...current.filter((item) => item.id !== tx.id)].slice(0, 20));
      }

      toast.success(`- R$ ${centsSafeAmount.toFixed(2)} sacado`);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (LOCAL_TEST_MODE) {
      resetLocalGameState();
      toast.success("Dados de teste redefinidos");
      window.location.reload();
      return;
    }
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-foreground text-background font-black flex items-center justify-center animate-pulse">8</div>
          Carregando…
        </div>
      </div>
    );
  }

  const wins = txs.filter((t) => t.type === "win").length;
  const totalWon = txs.filter((t) => t.type === "win").reduce((s, t) => s + Number(t.amount), 0);
  const totalBet = txs.filter((t) => t.type === "bet").reduce((s, t) => s + Number(t.amount), 0);
  const coins = Math.floor(profile.balance);

  return (
    <div className="platform-lobby min-h-screen pb-24 relative overflow-hidden bg-background page-enter">
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[var(--gold)]/10 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -left-32 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />

      <AppHeader
        balance={profile.balance}
        coins={coins}
        hideBalance={hideBalance}
        onMenu={() => setTab("profile")}
        onWallet={() => setTab("wallet")}
        onDeposit={() => setTab("wallet")}
      />

      <main className="platform-lobby__main max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-5 relative">
        {LOCAL_TEST_MODE && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-300">
            Modo teste local ativo · sem login e sem banco · saldo e progresso ficam neste navegador
          </div>
        )}
        {tab === "home" && (
          <div className="platform-home-layout space-y-4 sm:space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Hero banner — Escolha sua aposta */}
            <Link
              to="/bet"
              className="platform-home-hero block group relative overflow-hidden rounded-2xl border border-primary/40 shadow-2xl shadow-black/50"
              aria-label="Escolha sua aposta"
            >
              <img
                src="/platform/banners/home-arena-v2.png"
                alt="Escolha sua aposta — vitória paga 2x o valor apostado"
                width={1280}
                height={604}
                className="platform-banner-image w-full block group-hover:scale-[1.02] transition-transform duration-500"
              />
              <span className="platform-banner-shade" />
              <span className="platform-banner-copy">
                <small>ARENA BLACK BALL</small>
                <strong>ENTRE NA MESA.<br /><em>DOMINE A PARTIDA.</em></strong>
                <b>ESCOLHER APOSTA <ChevronRight /></b>
              </span>
              <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-1.5 pointer-events-none">
                {[0,1,2,3].map(i => (
                  <span key={i} className={`h-1.5 rounded-full transition-all ${i===0 ? "w-4 bg-[var(--gold)]" : "w-1.5 bg-foreground/40"}`} />
                ))}
              </div>
            </Link>

            <div className="lobby-wallet-strip">
              <div><Wallet /><span><small>SALDO PARA JOGAR</small><strong>R$ {profile.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span></div>
              <Link to="/shop"><Plus /> DEPOSITAR</Link>
            </div>

            {/* Criar aposta — acesso rápido */}
            <Link
              to="/bet"
              className="platform-home-quick block rounded-2xl border border-primary/40 bg-gradient-to-r from-[#26030a] via-[#0f0507] to-[#1b0207] p-3 hover:border-primary transition group"
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[var(--gold)] to-amber-700 flex items-center justify-center text-black">
                  <Plus className="h-5 w-5" strokeWidth={3} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--gold)]">Criar aposta</div>
                  <div className="text-[11px] text-muted-foreground">Defina o valor e desafie outros jogadores</div>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--gold)] group-hover:translate-x-0.5 transition" />
              </div>
            </Link>

            {/* Section header */}
            <div className="platform-section-head grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-1 pt-1">
              <h2 className="min-w-0 truncate text-xs font-black tracking-[0.15em] text-foreground flex items-center gap-2 uppercase">
                <Swords className="h-4 w-4 shrink-0 text-[var(--gold)]" />
                <span className="truncate">Solicitações de aposta</span>
              </h2>
              <Link
                to="/ao-vivo"
                aria-label="Ver partidas ao vivo"
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-red-300 hover:bg-red-500/20 transition"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
                Ao Vivo
              </Link>
            </div>

            {/* Bet requests — tráfego simulado */}
            <div className="platform-request-grid space-y-3">
              {requests.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-6 text-center text-xs text-muted-foreground">
                  Aguardando novos desafios...
                </div>
              )}
              {requests.map((m) => {
                const isOpen = m.status === "open";
                const isTaken = m.status === "taken";
                return (
                <div
                  key={m.id}
                  className={`bet-challenge-card rounded-2xl border backdrop-blur p-3 sm:p-3.5 transition-all duration-500 ${
                    isOpen
                      ? "border-border/70 opacity-100 translate-y-0 animate-in fade-in slide-in-from-top-2"
                      : isTaken
                        ? "border-[var(--gold)]/40 opacity-70"
                        : "border-destructive/40 opacity-50"
                  }`}
                >
                  <div className="bet-challenge-card__top flex items-start gap-2.5 sm:gap-3">
                    <div className="bet-challenge-card__avatar relative shrink-0">
                      <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-gradient-to-br from-secondary to-card border-2 border-[var(--gold)] flex items-center justify-center text-base sm:text-lg font-black text-foreground">
                        {m.host.charAt(0)}
                      </div>
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-primary ring-2 ring-card" />
                    </div>

                    <div className="bet-challenge-card__player min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-sm text-foreground truncate">{m.host}</span>
                        <span className="text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded border border-[var(--gold)]/50 text-[var(--gold)] shrink-0">
                          NÍVEL {m.level}
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">Desafiou você para uma partida</p>
                      <div className="bet-challenge-card__stake"><small>VALOR DA APOSTA</small><strong>R$ {m.stake.toFixed(2).replace(".",",")}</strong></div>
                    </div>

                    <div className="bet-challenge-card__versus shrink-0 self-center">
                      <span className="h-9 w-9 rounded-full border border-[var(--gold)]/60 flex items-center justify-center text-[var(--gold)] font-black text-xs">VS</span>
                    </div>

                    <div className="bet-challenge-card__game shrink-0 flex flex-col items-end gap-1">
                      <div className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold ${m.secondsLeft <= 10 && isOpen ? "text-destructive animate-pulse" : "text-[var(--gold)]"}`}>
                        <Timer className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {fmtTimer(m.secondsLeft)}
                      </div>
                      <BallRack />
                      <div className="text-right leading-tight">
                        <div className="text-[8px] uppercase tracking-wider text-muted-foreground">Bolinho</div>
                        <div className="text-[10px] font-black text-foreground">{m.mode}</div>
                      </div>
                    </div>
                  </div>

                  {isOpen ? (
                    <div className="bet-challenge-card__actions mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setRequests((prev) => prev.filter((r) => r.id !== m.id))}
                        className="h-10 rounded-lg border border-border bg-secondary/50 text-foreground text-[11px] sm:text-xs font-black tracking-wider uppercase hover:bg-secondary transition">
                        Recusar
                      </button>
                      <Link to="/play" search={{ stake: m.stake } as any}
                        className="h-10 rounded-lg bg-primary text-primary-foreground text-[11px] sm:text-xs font-black tracking-wider uppercase inline-flex items-center justify-center shadow-lg shadow-primary/30 hover:brightness-110 transition">
                        Aceitar
                      </Link>
                    </div>
                  ) : (
                    <div className={`mt-3 h-10 rounded-lg flex items-center justify-center text-[11px] sm:text-xs font-black tracking-wider uppercase ${
                      isTaken ? "bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/40" : "bg-destructive/10 text-destructive border border-destructive/30"
                    }`}>
                      {isTaken ? "Aceita por outro jogador" : "Tempo esgotado"}
                    </div>
                  )}
                </div>
                );
              })}
            </div>

            {/* Ranking banner */}
            <button onClick={() => setTab("ranking")}
              className="platform-ranking w-full mt-2 rounded-2xl border border-primary/35 bg-gradient-to-r from-card via-card to-primary/10 p-3.5 flex items-center gap-3 shadow-lg">
              <Trophy className="h-9 w-9 text-[var(--gold)] shrink-0" />
              <div className="min-w-0 flex-1 text-left">
                <div className="font-black text-sm tracking-tight"><span className="text-foreground">RANKING</span> <span className="text-[var(--gold)]">BLACK BALL</span></div>
                <div className="text-[10px] text-muted-foreground tracking-wider uppercase">Os melhores, as maiores apostas!</div>
              </div>
              <span className="shrink-0 h-9 px-3 rounded-lg border border-[var(--gold)]/60 text-[var(--gold)] text-[10px] font-black tracking-wider inline-flex items-center gap-1 uppercase">
                Ver ranking <ChevronRight className="h-3 w-3" />
              </span>
            </button>
          </div>
        )}

        {tab === "wallet" && (
          <div className="wallet-clean space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="wallet-clean__heading">
              <div><small>CONTA BLACK BALL</small><h1>Carteira</h1></div>
              <p>Saldo, depósitos e saques em um só lugar.</p>
            </div>

            {/* Balance hero (now lives in wallet) */}
            <div className="wallet-clean__balance relative overflow-hidden rounded-3xl p-5">
              <div className="wallet-clean__orb" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    <Wallet className="h-3 w-3" /> Saldo disponível
                  </div>
                  <button onClick={() => setHideBalance((v) => !v)} className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-background/30 text-muted-foreground">
                    {hideBalance ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="wallet-clean__value mt-3 font-mono text-4xl sm:text-5xl font-black tabular-nums tracking-tight">
                  {hideBalance ? "R$ ••••" : `R$ ${profile.balance.toFixed(2)}`}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <MiniStat label="Vitórias" value={String(wins)} />
                  <MiniStat label="Ganhos" value={`R$ ${totalWon.toFixed(0)}`} />
                  <MiniStat label="Apostado" value={`R$ ${totalBet.toFixed(0)}`} />
                </div>
                <div className="wallet-clean__status"><span><Shield /> Conta protegida</span><span>PIX disponível 24h</span></div>
              </div>
            </div>

            <Card className="wallet-clean__move p-4 sm:p-5">
              <div className="wallet-clean__switch" role="tablist" aria-label="Tipo de movimentação">
                <button className={walletAction === "deposit" ? "active" : ""} onClick={() => setWalletAction("deposit")}><ArrowDownToLine /> Depositar</button>
                <button className={walletAction === "withdraw" ? "active" : ""} onClick={() => setWalletAction("withdraw")}><ArrowUpFromLine /> Sacar</button>
              </div>
              <h2 className="font-bold mt-5 mb-1">{walletAction === "deposit" ? "Adicionar saldo" : "Solicitar saque PIX"}</h2>
              <p className="text-xs text-muted-foreground mb-4">{walletAction === "deposit" ? "Escolha o valor e gere seu pagamento PIX." : "O saque será enviado para a chave informada abaixo."}</p>

              <label htmlFor="wallet-amount" className="text-xs text-muted-foreground">Valor</label>
              <div className="mt-1 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input id="wallet-amount" inputMode="decimal" type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="h-14 pl-11 text-2xl font-mono font-bold" />
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {[10, 50, 100, 500].map((v) => (
                  <button key={v} onClick={() => setAmount(String(v))}
                    className="rounded-lg border border-border py-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary transition">
                    R$ {v}
                  </button>
                ))}
              </div>

              {walletAction === "withdraw" && (
                <div className="wallet-clean__pix mt-4">
                  <label htmlFor="pix-key" className="text-xs text-muted-foreground">Chave PIX para receber</label>
                  <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2 mt-1.5">
                    <Select value={pixKeyType} onValueChange={setPixKeyType}>
                      <SelectTrigger aria-label="Tipo de chave PIX"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cpf">CPF</SelectItem><SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="telefone">Telefone</SelectItem><SelectItem value="aleatoria">Aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input id="pix-key" value={pixKey} onChange={(e) => setPixKey(e.target.value)} autoComplete="off"
                      placeholder={pixKeyType === "cpf" ? "000.000.000-00" : pixKeyType === "email" ? "voce@email.com" : pixKeyType === "telefone" ? "+55 (00) 00000-0000" : "Chave aleatória"} />
                  </div>
                  <p><Lock /> Sua chave fica salva somente neste dispositivo.</p>
                </div>
              )}

              <Button onClick={() => move(walletAction)} disabled={busy} className="wallet-clean__cta mt-5 h-12 w-full font-bold">
                {walletAction === "deposit" ? <ArrowDownToLine /> : <ArrowUpFromLine />}
                {busy ? "Processando…" : walletAction === "deposit" ? "Continuar para o PIX" : "Solicitar saque"}
              </Button>
              {walletAction === "deposit" && <Link to="/shop" className="wallet-clean__full-deposit">Abrir área completa de depósito <ChevronRight /></Link>}
            </Card>

            <Card className="wallet-clean__history p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Recentes</h3>
                <button onClick={() => setTab("ranking")} className="text-xs text-primary hover:underline">Ver tudo</button>
              </div>
              <TxList txs={txs.slice(0, 4)} empty="Sem movimentações ainda." />
            </Card>
          </div>
        )}

        {tab === "ranking" && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h1 className="text-2xl font-black tracking-tight">Ranking</h1>
              <p className="text-sm text-muted-foreground">Os melhores da Black Ball</p>
            </div>
            <Card className="p-5">
              <TxList txs={txs} empty="Nenhuma movimentação ainda." />
            </Card>
          </div>
        )}

        {tab === "profile" && (
          <ProfileTab
            profile={profile}
            email={user.email ?? ""}
            wins={wins}
            totalWon={totalWon}
            totalBet={totalBet}
            txCount={txs.length}
            onLogout={logout}
          />
        )}
      </main>

      <BottomNav />
      <Dialog open={!!pixModal} onOpenChange={(o) => { if (!o) setPixModal(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pague R$ {pixModal?.amount.toFixed(2)} via PIX</DialogTitle>
            <DialogDescription>Escaneie o QR Code ou copie o código abaixo. O saldo é creditado automaticamente após o pagamento.</DialogDescription>
          </DialogHeader>
          {pixModal && (
            <div className="flex flex-col items-center gap-3">
              <img src={pixModal.image} alt="QR Code PIX" className="w-56 h-56 rounded-lg bg-white p-2" />
              <div className="w-full">
                <label className="text-xs text-muted-foreground">PIX Copia e Cola</label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={pixModal.code} className="font-mono text-xs" />
                  <Button type="button" size="icon" variant="secondary" onClick={() => { navigator.clipboard.writeText(pixModal.code); toast.success("Código copiado"); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={async () => {
                  const r = await pixCheck({ data: { identifier: pixModal.identifier } });
                  if (r && (r as { credited_at: string | null }).credited_at) {
                    toast.success("Pagamento confirmado!");
                    setPixModal(null);
                    await refresh();
                  } else {
                    toast.info(`Status: ${(r as { status: string }).status}. Aguardando pagamento…`);
                  }
                }}
              >
                Já paguei
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BallRack() {
  // Triangle rack: rows of 1, 2, 3, 4 balls
  const rows = [
    ["#f5c518"],
    ["#1d4ed8", "#dc2626"],
    ["#7e22ce", "#0f172a", "#f97316"],
    ["#16a34a", "#9a3412", "#facc15", "#0ea5e9"],
  ];
  return (
    <div className="flex flex-col items-center gap-[1px]">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-[1px]">
          {row.map((c, j) => (
            <span key={j} className="h-2 w-2 rounded-full border border-foreground/40" style={{ background: c }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 py-3 transition relative ${active ? "text-[var(--gold)]" : "text-muted-foreground hover:text-foreground"}`}>
      {active && <span className="absolute top-1 h-1 w-1 rounded-full bg-[var(--gold)]" />}
      {icon}
      <span className="text-[10px] font-bold tracking-wider uppercase">{label}</span>
    </button>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl p-3 bg-card/60 backdrop-blur border border-border/60">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 font-mono font-black text-base text-foreground tabular-nums">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-3 py-2 bg-background/40 backdrop-blur border border-border/60">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono font-black text-sm text-foreground tabular-nums">{value}</div>
    </div>
  );
}

function TxList({ txs, empty }: { txs: Tx[]; empty: string }) {
  if (txs.length === 0) return <p className="text-sm text-muted-foreground py-2">{empty}</p>;
  return (
    <ul className="divide-y divide-border/60">
      {txs.map((t) => {
        const positive = t.type === "deposit" || t.type === "win" || t.type === "refund";
        return (
          <li key={t.id} className="py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${positive ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>
                {positive ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm">{labelFor(t.type)}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {new Date(t.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`font-mono font-bold text-sm ${positive ? "text-primary" : "text-accent"}`}>
                {positive ? "+" : "−"} R$ {Number(t.amount).toFixed(2)}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">R$ {Number(t.balance_after).toFixed(2)}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function labelFor(t: string) {
  return { deposit: "Depósito", withdraw: "Saque", bet: "Aposta", win: "Vitória", refund: "Reembolso" }[t] ?? t;
}

function ProfileTab({
  profile, email, wins, totalWon, totalBet, txCount, onLogout,
}: {
  profile: Profile; email: string; wins: number; totalWon: number; totalBet: number; txCount: number; onLogout: () => void;
}) {
  const profit = totalWon - totalBet;
  const matches = Math.max(wins + Math.max(0, Math.floor(totalBet / 50) - wins), txCount > 0 ? 1 : 0);
  const losses = Math.max(0, matches - wins);
  const winrate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
  // Level math: every 500 in stakes = +1 level
  const xp = Math.floor(totalBet + totalWon);
  const level = Math.max(1, Math.floor(xp / 500) + 1);
  const xpInto = xp % 500;
  const xpPct = Math.min(100, Math.round((xpInto / 500) * 100));
  const referral = profile.referral_code;
  const referralLink = typeof window !== "undefined"
    ? LOCAL_TEST_MODE ? `${window.location.origin}/` : `${window.location.origin}/auth?ref=${referral}`
    : referral;

  // Editable settings (persist in localStorage)
  const [editOpen, setEditOpen] = useState(false);
  const [newName, setNewName] = useState(profile.username);
  const [saving, setSaving] = useState(false);
  const [lang, setLang] = useState<string>(() => (typeof window !== "undefined" && localStorage.getItem("bb.lang")) || "pt-BR");
  const [sound, setSound] = useState<boolean>(() => (typeof window !== "undefined" ? localStorage.getItem("bb.sound") !== "0" : true));
  const [notif, setNotif] = useState<boolean>(() => (typeof window !== "undefined" ? localStorage.getItem("bb.notif") !== "0" : true));
  const [pushNotif, setPushNotif] = useState<boolean>(() => (typeof window !== "undefined" ? localStorage.getItem("bb.push") === "1" : false));
  const [emailNotif, setEmailNotif] = useState<boolean>(() => (typeof window !== "undefined" ? localStorage.getItem("bb.email") !== "0" : true));
  const [dark, setDark] = useState<boolean>(true);

  useEffect(() => { localStorage.setItem("bb.lang", lang); }, [lang]);
  useEffect(() => { localStorage.setItem("bb.sound", sound ? "1" : "0"); }, [sound]);
  useEffect(() => { localStorage.setItem("bb.notif", notif ? "1" : "0"); }, [notif]);
  useEffect(() => { localStorage.setItem("bb.push", pushNotif ? "1" : "0"); }, [pushNotif]);
  useEffect(() => { localStorage.setItem("bb.email", emailNotif ? "1" : "0"); }, [emailNotif]);

  async function saveName() {
    const trimmed = newName.trim();
    if (trimmed.length < 3) { toast.error("Mínimo de 3 caracteres"); return; }
    if (trimmed === profile.username) { setEditOpen(false); return; }
    setSaving(true);
    if (LOCAL_TEST_MODE) {
      updateLocalProfile({ username: trimmed });
      setSaving(false);
      toast.success("Nome atualizado no modo local");
      setEditOpen(false);
      setTimeout(() => window.location.reload(), 250);
      return;
    }
    const { error } = await supabase.from("profiles").update({ username: trimmed }).eq("id", (await supabase.auth.getUser()).data.user!.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Nome atualizado");
    setEditOpen(false);
    // Soft-refresh so header reflects change
    setTimeout(() => window.location.reload(), 400);
  }

  async function resetPassword() {
    if (LOCAL_TEST_MODE) {
      toast("Login e senha estão desativados no modo teste local");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/auth" });
    if (error) toast.error(error.message);
    else toast.success("E-mail de redefinição enviado");
  }

  async function copyRef() {
    try { await navigator.clipboard.writeText(referralLink); toast.success("Link de indicação copiado"); }
    catch { toast.error("Não foi possível copiar"); }
  }

  const badges = [
    { id: "first", icon: <Star className="h-4 w-4" />, label: "Primeira aposta", unlocked: totalBet > 0 },
    { id: "win",   icon: <Trophy className="h-4 w-4" />, label: "Primeira vitória", unlocked: wins > 0 },
    { id: "hot",   icon: <Flame className="h-4 w-4" />, label: "Em chamas", unlocked: wins >= 3 },
    { id: "high",  icon: <Zap className="h-4 w-4" />, label: "High Roller", unlocked: totalBet >= 500 },
    { id: "lord",  icon: <Crown className="h-4 w-4" />, label: "Rei da mesa", unlocked: wins >= 10 },
    { id: "shark", icon: <Medal className="h-4 w-4" />, label: "Tubarão", unlocked: profit >= 200 },
  ];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Hero card */}
      <div className="relative overflow-hidden rounded-3xl border border-[var(--gold)]/40 bg-gradient-to-br from-card via-card to-background p-5 shadow-2xl shadow-black/40">
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[var(--gold)]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />

        <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <div className="relative shrink-0">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[var(--gold)] to-amber-700 p-[2px]">
              <div className="h-full w-full rounded-full bg-gradient-to-br from-secondary to-card flex items-center justify-center text-2xl font-black text-foreground">
                {profile.username.charAt(0).toUpperCase()}
              </div>
            </div>
            <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-[var(--gold)] text-background text-[9px] font-black inline-flex items-center gap-0.5">
              <Crown className="h-2.5 w-2.5" /> {level}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-lg truncate text-foreground">{profile.username}</span>
              <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
            </div>
            <div className="text-[11px] text-muted-foreground truncate">{email}</div>
            <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-black text-[var(--gold)] tracking-wider uppercase">
              <Award className="h-3 w-3" /> {level >= 10 ? "Mestre" : level >= 5 ? "Profissional" : "Iniciante"}
            </div>
          </div>
          <button onClick={() => setEditOpen(true)} className="shrink-0 h-9 w-9 rounded-full border border-border bg-background/40 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition" aria-label="Editar perfil">
            <Pencil className="h-4 w-4" />
          </button>
        </div>

        {/* XP bar */}
        <div className="relative mt-5">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5">
            <span className="text-muted-foreground">Nível {level}</span>
            <span className="text-[var(--gold)]">{xpInto} / 500 XP</span>
          </div>
          <div className="h-2 rounded-full bg-background/60 overflow-hidden border border-border/60">
            <div className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-amber-300 transition-all" style={{ width: `${xpPct}%` }} />
          </div>
        </div>
      </div>

      {/* Quick stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatCard icon={<Trophy className="h-3.5 w-3.5" />} label="Vitórias" value={String(wins)} />
        <StatCard icon={<Target className="h-3.5 w-3.5" />} label="Derrotas" value={String(losses)} />
        <StatCard icon={<TrendingUp className="h-3.5 w-3.5" />} label="Win rate" value={`${winrate}%`} />
        <StatCard icon={<Wallet className="h-3.5 w-3.5" />} label="Lucro" value={`R$ ${profit.toFixed(0)}`} />
      </div>

      {/* Performance summary */}
      <Card className="p-4 bg-card/70 backdrop-blur border-border/60">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black text-sm tracking-tight flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Desempenho
          </h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Últimos 30 dias</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/60 bg-background/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total ganho</div>
            <div className="mt-1 font-mono text-lg font-black text-primary tabular-nums">R$ {totalWon.toFixed(2)}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total apostado</div>
            <div className="mt-1 font-mono text-lg font-black text-foreground tabular-nums">R$ {totalBet.toFixed(2)}</div>
          </div>
        </div>
        {/* Win bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] mb-1.5">
            <span className="text-primary font-bold">Vitórias {wins}</span>
            <span className="text-muted-foreground font-bold">Derrotas {losses}</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-background/60 border border-border/60">
            <div className="bg-primary" style={{ width: `${winrate}%` }} />
            <div className="bg-destructive/70" style={{ width: `${100 - winrate}%` }} />
          </div>
        </div>
      </Card>

      {/* Achievements */}
      <Card className="p-4 bg-card/70 backdrop-blur border-border/60">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black text-sm tracking-tight flex items-center gap-2">
            <Medal className="h-4 w-4 text-[var(--gold)]" /> Conquistas
          </h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {badges.filter(b => b.unlocked).length}/{badges.length}
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {badges.map(b => (
            <div key={b.id}
              className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 p-1.5 text-center transition ${
                b.unlocked
                  ? "border-[var(--gold)]/50 bg-gradient-to-br from-[var(--gold)]/15 to-transparent text-[var(--gold)]"
                  : "border-border/50 bg-background/30 text-muted-foreground/40 grayscale"
              }`}
              title={b.label}
            >
              {b.icon}
              <span className="text-[8px] font-bold tracking-tight leading-tight line-clamp-2">{b.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Referral */}
      <ReferralCard profile={profile} referral={referral} referralLink={referralLink} onCopy={copyRef} />

      {/* Quick actions */}
      <Card className="p-2 bg-card/70 backdrop-blur border-border/60 divide-y divide-border/60">
        <ProfileLink to="/shop" icon={<Wallet className="h-4 w-4 text-[var(--gold)]" />} label="Depositar saldo" hint="Adicione saldo via PIX" />
        <ProfileLink to="/play" icon={<Play className="h-4 w-4 text-primary" />} label="Jogar agora" hint="Entrar em uma partida" />
      </Card>

      {/* Conta */}
      <SectionTitle icon={<UserIcon className="h-3.5 w-3.5" />} label="Conta" />
      <Card className="p-2 bg-card/70 backdrop-blur border-border/60 divide-y divide-border/60">
        <SettingRow icon={<UserIcon className="h-4 w-4 text-foreground" />} label="Nome de usuário" hint={profile.username}
          action={<button onClick={() => setEditOpen(true)} className="text-[11px] font-black text-primary uppercase tracking-wider">Editar</button>} />
        <SettingRow icon={<Mail className="h-4 w-4 text-foreground" />} label="E-mail" hint={email}
          action={<span className="text-[10px] font-bold text-[var(--gold)] uppercase">Verificado</span>} />
        <SettingRow icon={<Smartphone className="h-4 w-4 text-foreground" />} label="Telefone" hint="Não cadastrado"
          action={<button onClick={() => toast("Em breve")} className="text-[11px] font-black text-primary uppercase tracking-wider">Adicionar</button>} />
        <SettingRow icon={<Wallet className="h-4 w-4 text-foreground" />} label="Métodos de pagamento" hint="Pix, cartão, cripto"
          action={<ChevronRight className="h-4 w-4 text-muted-foreground" />} />
      </Card>

      {/* Preferências */}
      <SectionTitle icon={<Settings className="h-3.5 w-3.5" />} label="Preferências" />
      <Card className="p-2 bg-card/70 backdrop-blur border-border/60 divide-y divide-border/60">
        <SettingRow icon={<Globe className="h-4 w-4 text-foreground" />} label="Idioma" hint="Selecione a linguagem do app"
          action={
            <Select value={lang} onValueChange={(v) => { setLang(v); toast.success("Idioma alterado"); }}>
              <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pt-BR">🇧🇷 Português</SelectItem>
                <SelectItem value="en-US">🇺🇸 English</SelectItem>
                <SelectItem value="es-ES">🇪🇸 Español</SelectItem>
                <SelectItem value="fr-FR">🇫🇷 Français</SelectItem>
              </SelectContent>
            </Select>
          } />
        <SettingRow icon={dark ? <Moon className="h-4 w-4 text-foreground" /> : <Sun className="h-4 w-4 text-foreground" />}
          label="Tema escuro" hint="Aparência da interface"
          action={<Switch checked={dark} onCheckedChange={setDark} />} />
        <SettingRow icon={sound ? <Volume2 className="h-4 w-4 text-foreground" /> : <VolumeX className="h-4 w-4 text-foreground" />}
          label="Som do jogo" hint="Efeitos sonoros e música"
          action={<Switch checked={sound} onCheckedChange={setSound} />} />
        <SettingRow icon={<Bell className="h-4 w-4 text-foreground" />} label="Notificações" hint="Desafios e atualizações"
          action={<Switch checked={notif} onCheckedChange={setNotif} />} />
        <SettingRow icon={<Smartphone className="h-4 w-4 text-foreground" />} label="Push no celular" hint="Receber alertas no dispositivo"
          action={<Switch checked={pushNotif} onCheckedChange={setPushNotif} />} />
        <SettingRow icon={<Mail className="h-4 w-4 text-foreground" />} label="E-mail promocional" hint="Ofertas e promoções"
          action={<Switch checked={emailNotif} onCheckedChange={setEmailNotif} />} />
      </Card>

      {/* Segurança */}
      <SectionTitle icon={<Shield className="h-3.5 w-3.5" />} label="Segurança" />
      <Card className="p-2 bg-card/70 backdrop-blur border-border/60 divide-y divide-border/60">
        <SettingRow icon={<KeyRound className="h-4 w-4 text-foreground" />} label="Alterar senha" hint="Enviaremos um link por e-mail"
          action={<button onClick={resetPassword} className="text-[11px] font-black text-primary uppercase tracking-wider">Enviar</button>} />
        <SettingRow icon={<Lock className="h-4 w-4 text-foreground" />} label="Autenticação em 2 fatores" hint="Camada extra de segurança"
          action={<span className="text-[10px] font-bold text-muted-foreground uppercase">Em breve</span>} />
        <SettingRow icon={<Shield className="h-4 w-4 text-foreground" />} label="Sessões ativas" hint="1 dispositivo conectado"
          action={<ChevronRight className="h-4 w-4 text-muted-foreground" />} />
      </Card>

      {/* Suporte e Legal */}
      <SectionTitle icon={<HelpCircle className="h-3.5 w-3.5" />} label="Suporte" />
      <Card className="p-2 bg-card/70 backdrop-blur border-border/60 divide-y divide-border/60">
        <SettingRow icon={<MessageCircle className="h-4 w-4 text-foreground" />} label="Central de ajuda" hint="Tire suas dúvidas"
          action={<ChevronRight className="h-4 w-4 text-muted-foreground" />} />
        <SettingRow icon={<FileText className="h-4 w-4 text-foreground" />} label="Termos de uso" hint="Regras da plataforma"
          action={<ChevronRight className="h-4 w-4 text-muted-foreground" />} />
        <SettingRow icon={<Shield className="h-4 w-4 text-foreground" />} label="Política de privacidade" hint="Como tratamos seus dados"
          action={<ChevronRight className="h-4 w-4 text-muted-foreground" />} />
        <SettingRow icon={<Trash2 className="h-4 w-4 text-destructive" />} label="Excluir conta" hint="Apaga permanentemente seus dados"
          action={<span className="text-[10px] font-bold text-destructive uppercase">Solicitar</span>} />
      </Card>

      <Button onClick={onLogout} variant="secondary" className="w-full h-12 font-bold">
        <LogOut className="h-4 w-4 mr-2" /> {LOCAL_TEST_MODE ? "Redefinir dados de teste" : "Sair da conta"}
      </Button>

      <p className="text-center text-[10px] text-muted-foreground/60 pt-1">Black Ball · v1.0</p>

      {/* Edit profile dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
            <DialogDescription>Atualize seu nome de exibição.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Nome de usuário</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={20} className="h-11" />
            <p className="text-[10px] text-muted-foreground">3-20 caracteres. Visível para outros jogadores.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)} className="flex-1"><X className="h-4 w-4 mr-1" /> Cancelar</Button>
            <Button onClick={saveName} disabled={saving} className="flex-1"><Check className="h-4 w-4 mr-1" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileLink({ to, icon, label, hint }: { to: string; icon: React.ReactNode; label: string; hint: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-3 py-3 hover:bg-background/40 rounded-lg transition">
      <span className="h-9 w-9 rounded-lg bg-background/60 border border-border/60 inline-flex items-center justify-center shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-foreground truncate">{label}</div>
        <div className="text-[11px] text-muted-foreground truncate">{hint}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  );
}

function ReferralCard({ profile, referral, referralLink, onCopy }: { profile: Profile; referral: string; referralLink: string; onCopy: () => void }) {
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [earnings, setEarnings] = useState<{ count: number; total: number }>({ count: 0, total: 0 });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: rows } = await supabase
        .from("referral_earnings")
        .select("commission")
        .eq("referrer_id", user.id);
      if (!active) return;
      const owned = (rows ?? []);
      const total = owned.reduce((s: number, r: any) => s + Number(r.commission), 0);
      setEarnings({ count: owned.length, total });
    })();
    return () => { active = false; };
  }, [profile.referral_code]);

  async function applyCode() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) { toast.error("Código inválido"); return; }
    setApplying(true);
    const { error } = await supabase.rpc("apply_referral_code", { _code: trimmed });
    setApplying(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Código aplicado! Seu amigo ganhará 30% dos seus depósitos.");
    setTimeout(() => window.location.reload(), 600);
  }

  async function shareLink() {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: "Black Ball — 8 Ball Cash",
          text: `Joga 8 ball comigo! Use meu código ${referral} ao se cadastrar.`,
          url: referralLink,
        });
      } catch { /* user cancelled */ }
    } else {
      onCopy();
    }
  }

  return (
    <Card className="p-4 bg-gradient-to-br from-card via-card to-primary/10 border-primary/40 space-y-3">
      <div className="flex items-center gap-2">
        <Share2 className="h-4 w-4 text-primary" />
        <h3 className="font-black text-sm tracking-tight">Indique amigos</h3>
        <span className="ml-auto text-[10px] font-black tracking-wider text-primary uppercase">30% vitalício</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Cada amigo que entrar com seu código te dá <span className="font-black text-foreground">30% de tudo que ele depositar</span>, para sempre.
      </p>

      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 rounded-lg border border-dashed border-primary/50 bg-background/40 px-3 py-2 font-mono text-base font-black text-primary tracking-[0.2em] truncate text-center">
          {referral}
        </div>
        <button onClick={onCopy} className="h-10 px-3 rounded-lg bg-background/60 border border-border text-[11px] font-black tracking-wider uppercase inline-flex items-center gap-1.5 transition shrink-0" aria-label="Copiar link">
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button onClick={shareLink} className="h-10 px-3 rounded-lg bg-primary text-primary-foreground text-[11px] font-black tracking-wider uppercase inline-flex items-center gap-1.5 hover:brightness-110 transition shrink-0">
          <Share2 className="h-3.5 w-3.5" /> Enviar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/60 bg-background/40 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Indicados</div>
          <div className="font-mono text-base font-black tabular-nums">{earnings.count}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/40 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Comissão total</div>
          <div className="font-mono text-base font-black tabular-nums text-primary">R$ {earnings.total.toFixed(2)}</div>
        </div>
      </div>

      {profile.referred_by ? (
        <div className="rounded-lg bg-background/40 border border-border/60 px-3 py-2 text-[11px] text-muted-foreground inline-flex items-center gap-2">
          <Check className="h-3.5 w-3.5 text-primary" /> Você foi indicado por um amigo
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Tem um código? Insira aqui"
            maxLength={12}
            className="h-10 font-mono tracking-wider"
          />
          <Button onClick={applyCode} disabled={applying} size="sm" className="h-10 px-3 text-[11px] font-black uppercase tracking-wider">
            Aplicar
          </Button>
        </div>
      )}
    </Card>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-2 px-1 text-[10px] font-black tracking-[0.18em] uppercase text-muted-foreground">
      <span className="text-[var(--gold)]">{icon}</span> {label}
    </div>
  );
}

function SettingRow({ icon, label, hint, action }: { icon: React.ReactNode; label: string; hint?: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <span className="h-9 w-9 rounded-lg bg-background/60 border border-border/60 inline-flex items-center justify-center shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-foreground truncate">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground truncate">{hint}</div>}
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
