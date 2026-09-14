import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Menu, Plus, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { NotificationPopups } from "@/components/NotificationBell";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  /** Override balance (e.g. on Home which already keeps profile state). */
  balance?: number;
  coins?: number;
  hideBalance?: boolean;
  onMenu?: () => void;
  onWallet?: () => void;
  onDeposit?: () => void;
};

/**
 * Header compartilhado em todas as áreas (exceto /play).
 * Quando handlers não são fornecidos, os botões navegam para "/" e
 * gravam um marcador em sessionStorage para a Home abrir a aba certa.
 */
export function AppHeader({
  balance: balanceProp,
  coins: coinsProp,
  hideBalance = false,
  onMenu,
  onWallet,
  onDeposit,
}: Props = {}) {
  const navigate = useNavigate();
  const router = useRouter();
  const atHome = router.state.location.pathname === "/";
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [fetched, setFetched] = useState<number | null>(null);
  useEffect(() => {
    if (balanceProp != null || !userId) return;
    let on = true;
    supabase
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .single()
      .then(({ data }) => { if (on && data) setFetched(Number(data.balance)); });
    return () => { on = false; };
  }, [userId, balanceProp]);

  const balance = balanceProp ?? fetched ?? 0;
  const coins = coinsProp ?? Math.round(balance);

  const goTab = (tab: "profile" | "wallet") => {
    if (atHome) return;
    try { sessionStorage.setItem("bb:open-tab", tab); } catch {}
    navigate({ to: "/" });
  };

  const handleMenu = () => (onMenu ? onMenu() : goTab("profile"));
  const handleWallet = () => (onWallet ? onWallet() : goTab("wallet"));
  const handleDeposit = () => (onDeposit ? onDeposit() : goTab("wallet"));

  return (
    <header className="platform-header sticky top-0 z-30 px-2 sm:px-4 pt-2 sm:pt-3 bg-black">
      <div className="platform-header__frame max-w-3xl mx-auto">
        <div className="platform-header__bar h-14 rounded-2xl bg-[#0a0a0a] border border-white/[0.06] px-2 sm:px-2.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 sm:gap-2 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.9)]">
          {/* Esquerda: menu */}
          <button
            onClick={handleMenu}
            aria-label="Menu"
            className="h-9 w-9 rounded-xl border border-white/10 bg-[#111] inline-flex items-center justify-center text-foreground hover:border-white/25 transition"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Centro: logo */}
          <Link
            to="/"
            className="platform-brand min-w-0 h-10 flex items-center justify-center select-none"
            aria-label="Início"
          >
            <img src="/brand/black-ball-logo-v2.svg" alt="Black Ball" width="175" height="40" className="platform-brand__logo" />
          </Link>

          {/* Direita: saldo + depositar */}
          <div className="platform-balance flex items-center gap-1.5 sm:gap-2">
            <div className="h-9 rounded-xl border border-white/10 bg-[#111] px-2 inline-flex items-center gap-1.5">
              <span className="font-bold text-foreground text-[11px] leading-none tabular-nums">
                {hideBalance
                  ? "R$ ••••"
                  : `R$ ${balance.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </span>
              <button
                onClick={handleWallet}
                aria-label="Adicionar saldo"
                className="h-5 w-5 rounded-md bg-emerald-500 text-white inline-flex items-center justify-center hover:bg-emerald-400 transition"
              >
                <Plus className="h-3 w-3" strokeWidth={3.5} />
              </button>
            </div>

            <button
              onClick={handleDeposit}
              aria-label="Depositar"
              className="h-9 px-2.5 sm:px-3 rounded-xl bg-gradient-to-b from-amber-300 via-[var(--gold)] to-amber-600 text-black font-black text-[10px] tracking-[0.12em] uppercase inline-flex items-center gap-1 hover:brightness-110 transition shadow-[0_4px_14px_-4px_rgba(212,175,55,0.7)] border border-amber-300/60"
            >
              <Wallet className="h-3.5 w-3.5" strokeWidth={2.5} />
              <span className="hidden xs:inline sm:inline">Depositar</span>
            </button>
          </div>

          <NotificationPopups userId={userId} />
        </div>
        {/* moedas (linha secundária) */}
        {!hideBalance && coins > 0 && (
          <div className="mt-1 flex justify-end pr-1">
            <div className="inline-flex items-center gap-1 text-[9px] font-bold text-[var(--gold)]/90">
              <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 ring-1 ring-amber-700/60 inline-flex items-center justify-center text-[6px] font-black text-amber-900">
                $
              </span>
              <span className="tabular-nums">{coins.toLocaleString("pt-BR")}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
