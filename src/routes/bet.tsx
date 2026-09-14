import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Target, Trophy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/bet")({
  head: () => ({
    meta: [
      { title: "Escolha sua aposta — Black 8 Ball" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BetPage,
});

const STAKES = [1, 5, 10, 25, 50, 100];

function BetPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [stake, setStake] = useState<number>(1);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("balance").eq("id", user.id).single()
      .then(({ data }) => { if (data) setBalance(Number(data.balance)); });
  }, [user]);

  function confirm() {
    if (stake > balance) {
      toast.error("Saldo insuficiente para essa aposta.");
      return;
    }
    nav({ to: "/play", search: { stake } });
  }

  return (
    <div className="platform-bet-page min-h-screen pb-24 bg-background relative overflow-hidden page-enter">
      <AppHeader balance={balance} />
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[var(--gold)]/10 blur-3xl" />

      <main className="platform-bet-layout max-w-2xl mx-auto px-3 sm:px-4 py-4 space-y-5">
        {/* Banner */}
        <div className="platform-wide-banner overflow-hidden rounded-2xl border border-primary/40 shadow-2xl shadow-black/50">
          <img
            src="/platform/banners/challenges-v2.png"
            alt="Escolha sua aposta"
            width={1280}
            height={604}
            className="platform-banner-image w-full block"
          />
          <span className="platform-banner-shade" />
          <span className="platform-banner-copy is-centered"><small>DUELO VALENDO PRÊMIO</small><strong>ESCOLHA SUA <em>APOSTA</em></strong></span>
        </div>

        {/* Section title */}
        <div className="flex items-center gap-2 px-1">
          <Target className="h-4 w-4 text-[var(--gold)]" />
          <h2 className="text-xs sm:text-sm font-black tracking-[0.15em] text-foreground uppercase">
            Selecione o valor da sua aposta
          </h2>
        </div>

        {/* Stakes grid */}
        <div className="platform-stakes-grid grid grid-cols-3 gap-2.5 sm:gap-3">
          {STAKES.map((value) => {
            const selected = stake === value;
            const disabled = value > balance;
            return (
              <button
                key={value}
                onClick={() => !disabled && setStake(value)}
                disabled={disabled}
                className={`clean-stake-card relative overflow-hidden aspect-[5/6] rounded-2xl border p-3 flex flex-col items-center justify-center transition-all ${
                  selected
                    ? "border-emerald-400 bg-gradient-to-br from-emerald-500/20 to-emerald-900/10 shadow-[0_0_30px_-5px_rgba(16,185,129,0.55)]"
                    : disabled
                      ? "border-white/5 bg-[#0c0c0c] opacity-40 cursor-not-allowed"
                      : "border-white/10 bg-[#111] hover:border-white/25"
                }`}
              >
                {selected && (
                  <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-emerald-500 text-black inline-flex items-center justify-center">
                    <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
                  </span>
                )}
                <span aria-hidden className="pointer-events-none absolute -bottom-3 left-1/2 -translate-x-1/2 h-16 w-16 rounded-full bg-gradient-to-br from-zinc-700 to-black opacity-25 flex items-center justify-center text-xl font-black">
                  8
                </span>
                <span className={`relative text-[10px] sm:text-[11px] font-bold tracking-wider uppercase ${selected ? "text-emerald-300" : "text-muted-foreground"}`}>
                  apostar
                </span>
                <span className={`relative font-black text-xl sm:text-2xl mt-1 tabular-nums ${selected ? "text-emerald-300" : "text-foreground"}`}>
                  R$ {value}
                </span>
              </button>
            );
          })}
        </div>

        {/* Good luck card */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--gold)]/25 bg-gradient-to-r from-card to-background p-3.5 flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br from-[var(--gold)]/25 to-amber-900/10 border border-[var(--gold)]/30 flex items-center justify-center">
            <Trophy className="h-6 w-6 text-[var(--gold)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-black text-[var(--gold)] text-sm tracking-wide">BOA SORTE!</div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Mostre quem é o rei da sinuca e leve sua vitória.
            </p>
          </div>
          <div className="hidden sm:flex h-10 w-10 rounded-full bg-black border border-white/10 items-center justify-center font-black text-white text-sm shrink-0">
            8
          </div>
        </div>

        {/* Confirm button */}
        <button
          onClick={confirm}
          disabled={stake > balance}
          className="w-full h-14 rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 text-black font-black text-sm tracking-[0.18em] uppercase shadow-[0_10px_30px_-10px_rgba(16,185,129,0.7)] hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Confirmar aposta
        </button>
      </main>

      <BottomNav />
    </div>
  );
}
