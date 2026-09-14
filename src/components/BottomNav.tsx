import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Swords, Users, WalletCards, User } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const ITEMS = [
  { to: "/",            icon: Home,   label: "Início" },
  { to: "/desafios",    icon: Swords, label: "Desafios" },
  { to: "/shop",        icon: WalletCards, label: "Depositar", featured: true },
  { to: "/social",      icon: Users,  label: "Social" },
  { to: "/recompensas", icon: User,   label: "Perfil" },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const nav = (
    <nav
      aria-label="Navegação principal"
      className="platform-bottom-nav fixed bottom-0 inset-x-0 z-40 pb-[env(safe-area-inset-bottom)] bg-background/95 backdrop-blur-md border-t border-border/50 shadow-2xl shadow-black/60"
    >
      <ul className="platform-bottom-nav__list max-w-2xl mx-auto h-16 flex items-stretch justify-between px-1">
        {ITEMS.map((item) => (
          <Item key={item.to} {...item} active={pathname === item.to} featured={(item as any).featured} />
        ))}
      </ul>
    </nav>
  );
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(nav, document.body);
}

function Item({
  to,
  active,
  icon,
  label,
  featured,
}: {
  to: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  featured?: boolean;
}) {
  const Icon = icon;
  if (featured) {
    return (
      <li className="flex-1 flex justify-center">
        <Link
          to={to}
          preload="intent"
          aria-current={active ? "page" : undefined}
          aria-label={label}
          className="relative -mt-6 flex flex-col items-center group"
        >
          <span
            aria-hidden
            className="absolute inset-0 -m-1 rounded-full bg-[var(--gold)]/30 blur-xl opacity-70 group-hover:opacity-100 transition"
          />
          <span className="relative w-14 h-14 rounded-full bg-gradient-to-br from-[#F2D070] to-[#A87A1F] flex items-center justify-center shadow-[0_8px_24px_rgba(212,175,55,0.45)] ring-4 ring-background">
            <Icon className="h-6 w-6 text-black" />
          </span>
          <span className="relative mt-1 text-[9px] font-bold uppercase tracking-widest text-[var(--gold)]">
            {label}
          </span>
        </Link>
      </li>
    );
  }
  return (
    <li className="flex-1 flex">
      <Link
        to={to}
        preload="intent"
        aria-current={active ? "page" : undefined}
        className={`relative flex-1 flex flex-col items-center justify-center gap-1 transition-colors duration-200 ${
          active ? "text-[var(--gold)]" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {active && (
          <span
            aria-hidden
            className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-[var(--gold)] shadow-[0_0_10px_var(--gold)]"
          />
        )}
        <Icon className="h-5 w-5" />
        <span className="text-[9px] font-semibold tracking-tight leading-none">{label}</span>
      </Link>
    </li>
  );
}
