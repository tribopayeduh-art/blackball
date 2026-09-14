import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, Wallet, Swords, Settings, LogOut, Search, Shield,
  TrendingUp, ArrowUpRight, ArrowDownRight, Crown, Plus, Minus, Menu, X,
  DollarSign, Activity, UserPlus, Trophy, Megaphone, Power, Ban, CheckCircle2,
  Radio, AlertTriangle, Bot, Eye, RefreshCw, Save, ShoppingBag, Share2, Trash2,
  Webhook, Key, Copy, Code as CodeIcon,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — 8 Ball Cash" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPanel,
});

type Stats = {
  users_total: number; users_today: number; users_week: number; users_month: number;
  dau: number; wau: number; mau: number; online_now: number;
  matches_total: number; matches_today: number; matches_active: number;
  matches_won: number; matches_lost: number;
  balance_total: number; deposits_today: number; deposits_week: number;
  withdrawals_today: number; wagered_today: number; house_profit_today: number;
  banned_users: number;
};
type AdminUser = {
  id: string; email: string; username: string; balance: number;
  level: number; xp: number; created_at: string; last_sign_in: string | null; is_admin: boolean;
  banned?: boolean;
};
type Section = "dashboard" | "users" | "live" | "transactions" | "matches" | "shop" | "affiliates" | "api" | "broadcast" | "audit" | "settings";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

function AdminPanel() {
  const nav = useNavigate();
  const { user, loading, isAdmin } = useAuth();
  const [section, setSection] = useState<Section>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    if (!isAdmin) { nav({ to: "/" }); }
  }, [user, loading, isAdmin, nav]);

  if (loading || !user || !isAdmin) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">Carregando painel…</div>;
  }

  const nav_items: { key: Section; label: string; icon: any }[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "users", label: "Usuários", icon: Users },
    { key: "live", label: "Ao vivo", icon: Radio },
    { key: "transactions", label: "Transações", icon: Wallet },
    { key: "matches", label: "Partidas", icon: Swords },
    { key: "shop", label: "Loja", icon: ShoppingBag },
    { key: "affiliates", label: "Afiliados", icon: Share2 },
    { key: "api", label: "API / Integrações", icon: Webhook },
    { key: "broadcast", label: "Avisos", icon: Megaphone },
    { key: "audit", label: "Auditoria", icon: Eye },
    { key: "settings", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="admin-shell min-h-screen bg-zinc-950 text-zinc-100">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4 py-3 lg:hidden">
        <button onClick={() => setSidebarOpen(true)} className="rounded-md p-2 hover:bg-zinc-800"><Menu className="h-5 w-5" /></button>
        <div className="flex items-center gap-2 font-bold"><Shield className="h-5 w-5 text-amber-400" />Admin</div>
        <div className="w-9" />
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? "fixed inset-y-0 left-0 z-50 w-64" : "hidden"} lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 flex-col border-r border-zinc-800 bg-zinc-900/80 backdrop-blur`}>
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-[0_0_20px_rgba(251,191,36,0.4)]">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold tracking-wide">Black Ball</div>
                <div className="text-[10px] uppercase tracking-widest text-amber-400/80">Admin Panel</div>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="rounded-md p-1 hover:bg-zinc-800 lg:hidden"><X className="h-4 w-4" /></button>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {nav_items.map((n) => {
              const active = section === n.key;
              return (
                <button
                  key={n.key}
                  onClick={() => { setSection(n.key); setSidebarOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-gradient-to-r from-amber-500/20 to-amber-500/5 text-amber-300 ring-1 ring-amber-500/30"
                      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
                  }`}
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-zinc-800 p-3">
            <Link to="/" className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100">
              <Activity className="h-4 w-4" /> Ver app público
            </Link>
            <button
              onClick={async () => { await supabase.auth.signOut(); nav({ to: "/auth" }); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </aside>

        {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-black/60 lg:hidden" />}

        {/* Main */}
        <main className="min-h-screen flex-1 p-4 lg:p-8">
          {section === "dashboard" && <DashboardView />}
          {section === "users" && <UsersView />}
          {section === "live" && <LiveMatchesView />}
          {section === "transactions" && <TransactionsView />}
          {section === "matches" && <MatchesView />}
          {section === "shop" && <ShopView />}
          {section === "affiliates" && <AffiliatesView />}
          {section === "api" && <ApiView />}
          {section === "broadcast" && <BroadcastView />}
          {section === "audit" && <AuditView />}
          {section === "settings" && <SettingsView />}
        </main>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent = "amber", delta }: { label: string; value: string; icon: any; accent?: "amber" | "emerald" | "rose" | "sky"; delta?: string }) {
  const tones: Record<string, string> = {
    amber: "from-amber-500/20 to-amber-500/0 text-amber-300 ring-amber-500/20",
    emerald: "from-emerald-500/20 to-emerald-500/0 text-emerald-300 ring-emerald-500/20",
    rose: "from-rose-500/20 to-rose-500/0 text-rose-300 ring-rose-500/20",
    sky: "from-sky-500/20 to-sky-500/0 text-sky-300 ring-sky-500/20",
  };
  return (
    <Card className="border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
          <div className="mt-2 text-2xl font-bold text-zinc-100">{value}</div>
          {delta && <div className="mt-1 text-xs text-zinc-400">{delta}</div>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${tones[accent]} ring-1`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function DashboardView() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_advanced_stats");
    if (error) { toast.error(error.message); return; }
    setStats(data as Stats);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    const debounced = (() => {
      let h: ReturnType<typeof setTimeout> | null = null;
      return () => { if (h) clearTimeout(h); h = setTimeout(load, 400); };
    })();
    const ch = supabase
      .channel("admin-dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_transactions" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, debounced)
      .subscribe();
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      supabase.removeChannel(ch);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  return (
    <div>
      <SectionHeader title="Dashboard" subtitle="Tempo real · eventos + refresh a cada 5s" />
      <div className="admin-command-grid">
        <button onClick={() => toast.info("Controles de margem disponíveis em Configurações")}><DollarSign /><span><small>MARGEM DA CASA</small><strong>Controle financeiro</strong></span></button>
        <button onClick={() => toast.info("Monitoramento de partidas ativo")}><Activity /><span><small>OPERAÇÃO</small><strong>Monitor em tempo real</strong></span></button>
        <button onClick={() => toast.info("Bots e matchmaking em Configurações")}><Bot /><span><small>INTELIGÊNCIA</small><strong>Bots humanizados</strong></span></button>
        <button onClick={() => toast.info("Auditoria de segurança disponível")}><Shield /><span><small>SEGURANÇA</small><strong>Riscos e auditoria</strong></span></button>
      </div>
      {loading || !stats ? (
        <div className="text-sm text-zinc-500">Carregando estatísticas…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Online agora" value={String(stats.online_now)} icon={Radio} accent="emerald" delta="últimos 5 min" />
            <StatCard label="DAU" value={String(stats.dau)} icon={Activity} accent="sky" delta={`WAU ${stats.wau} · MAU ${stats.mau}`} />
            <StatCard label="Partidas ativas" value={String(stats.matches_active)} icon={Swords} accent="amber" delta={`${stats.matches_today} hoje`} />
            <StatCard label="Lucro da casa (24h)" value={fmtMoney(stats.house_profit_today)} icon={TrendingUp} accent="emerald" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Usuários total" value={String(stats.users_total)} icon={Users} accent="sky" delta={`+${stats.users_today} hoje · +${stats.users_week} 7d`} />
            <StatCard label="Apostado (24h)" value={fmtMoney(stats.wagered_today)} icon={DollarSign} accent="amber" />
            <StatCard label="Saldo na casa" value={fmtMoney(stats.balance_total)} icon={Wallet} accent="emerald" />
            <StatCard label="Banidos" value={String(stats.banned_users)} icon={Ban} accent="rose" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="border-zinc-800 bg-zinc-900/60 p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Fluxo de caixa (24h)</div>
                  <div className="text-xs text-zinc-500">Depósitos vs Saques</div>
                </div>
                <TrendingUp className="h-5 w-5 text-amber-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-2 text-xs text-emerald-300"><ArrowDownRight className="h-4 w-4" /> Entradas</div>
                  <div className="mt-2 text-xl font-bold text-emerald-300">{fmtMoney(stats.deposits_today)}</div>
                  <div className="mt-1 text-[10px] text-zinc-500">7d: {fmtMoney(stats.deposits_week)}</div>
                </div>
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4">
                  <div className="flex items-center gap-2 text-xs text-rose-300"><ArrowUpRight className="h-4 w-4" /> Saídas</div>
                  <div className="mt-2 text-xl font-bold text-rose-300">{fmtMoney(stats.withdrawals_today)}</div>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Resultado líquido (24h)</span>
                  <span className={`font-bold ${stats.deposits_today - stats.withdrawals_today >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {fmtMoney(stats.deposits_today - stats.withdrawals_today)}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900/60 p-5">
              <div className="mb-4 text-sm font-semibold">Resumo de partidas</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 rounded-md border border-zinc-800 p-3"><Trophy className="h-4 w-4 text-emerald-300" /> Vitórias: <span className="ml-auto font-bold">{stats.matches_won}</span></div>
                <div className="flex items-center gap-2 rounded-md border border-zinc-800 p-3"><X className="h-4 w-4 text-rose-300" /> Derrotas: <span className="ml-auto font-bold">{stats.matches_lost}</span></div>
                <div className="flex items-center gap-2 rounded-md border border-zinc-800 p-3"><Activity className="h-4 w-4 text-amber-300" /> Em andamento: <span className="ml-auto font-bold">{stats.matches_active}</span></div>
                <div className="flex items-center gap-2 rounded-md border border-zinc-800 p-3"><UserPlus className="h-4 w-4 text-sky-300" /> Novos 30d: <span className="ml-auto font-bold">{stats.users_month}</span></div>
              </div>
              <Button onClick={load} className="mt-4 w-full bg-amber-500 text-black hover:bg-amber-400"><RefreshCw className="mr-1 h-4 w-4" />Atualizar</Button>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function UsersView() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [adjust, setAdjust] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users", { _limit: 200, _offset: 0, _search: (search || null) as any });
    if (error) toast.error(error.message); else setUsers((data as AdminUser[]) ?? []);
    setLoading(false);
  }, [search]);
  useEffect(() => { load(); }, [load]);

  async function applyAdjust(delta: number) {
    if (!selected) return;
    const v = Number(adjust.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) { toast.error("Valor inválido"); return; }
    const { data, error } = await supabase.rpc("admin_adjust_balance", { _user: selected.id, _delta: delta * v, _note: "ajuste pelo painel" });
    if (error) { toast.error(error.message); return; }
    toast.success(`Saldo atualizado: ${fmtMoney(Number(data))}`);
    setAdjust("");
    setSelected(null);
    load();
  }

  async function toggleAdmin(u: AdminUser) {
    const { error } = await supabase.rpc("admin_set_role", { _user: u.id, _role: "admin", _grant: !u.is_admin });
    if (error) { toast.error(error.message); return; }
    toast.success(u.is_admin ? "Admin removido" : "Admin concedido");
    load();
  }

  async function toggleBan(u: AdminUser) {
    const reason = u.banned ? null : prompt("Motivo do banimento:") || "sem motivo";
    const { error } = await supabase.rpc("admin_set_banned", { _user: u.id, _banned: !u.banned, _reason: reason ?? undefined });
    if (error) { toast.error(error.message); return; }
    toast.success(u.banned ? "Usuário desbanido" : "Usuário banido");
    load();
  }

  return (
    <div>
      <SectionHeader title="Usuários" subtitle={`${users.length} resultados`} />
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por email ou usuário…"
                 className="border-zinc-800 bg-zinc-900 pl-9 text-zinc-100" />
        </div>
        <Button onClick={load} className="bg-amber-500 text-black hover:bg-amber-400">Buscar</Button>
      </div>

      <Card className="overflow-hidden border-zinc-800 bg-zinc-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/80 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">Saldo</th>
                <th className="px-4 py-3">Nível</th>
                <th className="px-4 py-3 hidden md:table-cell">Criado</th>
                <th className="px-4 py-3 hidden lg:table-cell">Último login</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">Carregando…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">Nenhum usuário</td></tr>
              ) : users.map((u) => (
                <tr key={u.id} className="border-t border-zinc-800/70 hover:bg-zinc-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/30 to-amber-700/20 text-xs font-bold text-amber-200">
                        {(u.username || u.email)[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 font-medium text-zinc-100">
                          {u.username || "—"}
                          {u.is_admin && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">ADMIN</span>}
                        </div>
                        <div className="text-xs text-zinc-500">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-300">{fmtMoney(u.balance)}</td>
                  <td className="px-4 py-3">Nv {u.level} <span className="text-xs text-zinc-500">({u.xp} XP)</span></td>
                  <td className="px-4 py-3 hidden md:table-cell text-zinc-400">{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-zinc-400">{fmtDate(u.last_sign_in)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelected(u)} className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700">Saldo</Button>
                      <Button size="sm" variant="outline" onClick={() => toggleAdmin(u)} className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700">
                        {u.is_admin ? "Revogar" : "Tornar admin"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleBan(u)}
                        className={`border-zinc-700 ${u.banned ? "bg-emerald-600/30 hover:bg-emerald-600/50" : "bg-rose-600/30 hover:bg-rose-600/50"}`}>
                        {u.banned ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSelected(null)}>
          <Card className="w-full max-w-md border-zinc-800 bg-zinc-900 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 text-xs uppercase tracking-wider text-zinc-500">Ajustar saldo</div>
            <div className="mb-4 text-lg font-bold">{selected.username || selected.email}</div>
            <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-sm">
              Saldo atual: <span className="font-bold text-emerald-300">{fmtMoney(selected.balance)}</span>
            </div>
            <Input value={adjust} onChange={(e) => setAdjust(e.target.value)} placeholder="Valor (R$)" inputMode="decimal"
                   className="border-zinc-800 bg-zinc-950 text-zinc-100" />
            <div className="mt-4 flex gap-2">
              <Button onClick={() => applyAdjust(1)} className="flex-1 bg-emerald-500 text-black hover:bg-emerald-400"><Plus className="mr-1 h-4 w-4" /> Creditar</Button>
              <Button onClick={() => applyAdjust(-1)} className="flex-1 bg-rose-500 text-white hover:bg-rose-400"><Minus className="mr-1 h-4 w-4" /> Debitar</Button>
            </div>
            <Button variant="ghost" onClick={() => setSelected(null)} className="mt-2 w-full text-zinc-400">Cancelar</Button>
          </Card>
        </div>
      )}
    </div>
  );
}

function TransactionsView() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("wallet_transactions").select("*").order("created_at", { ascending: false }).limit(100);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);
  return (
    <div>
      <SectionHeader title="Transações" subtitle="Últimas 100 movimentações" />
      <Card className="overflow-hidden border-zinc-800 bg-zinc-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/80 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr><th className="px-4 py-3">Quando</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Saldo após</th><th className="px-4 py-3 hidden md:table-cell">Descrição</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Carregando…</td></tr> :
                rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Sem transações</td></tr> :
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-800/70 hover:bg-zinc-800/30">
                    <td className="px-4 py-3 text-zinc-400">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3"><span className="rounded bg-zinc-800 px-2 py-1 text-xs font-medium">{r.type}</span></td>
                    <td className={`px-4 py-3 font-bold ${Number(r.amount) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{fmtMoney(Number(r.amount))}</td>
                    <td className="px-4 py-3">{fmtMoney(Number(r.balance_after))}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-zinc-400">{r.description || "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function MatchesView() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("matches").select("*").order("created_at", { ascending: false }).limit(100);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);
  return (
    <div>
      <SectionHeader title="Partidas" subtitle="Últimas 100 partidas" />
      <Card className="overflow-hidden border-zinc-800 bg-zinc-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/80 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr><th className="px-4 py-3">ID</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Aposta</th><th className="px-4 py-3 hidden md:table-cell">Criada</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">Carregando…</td></tr> :
                rows.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">Nenhuma partida</td></tr> :
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-800/70 hover:bg-zinc-800/30">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">{String(r.id).slice(0, 8)}</td>
                    <td className="px-4 py-3"><span className="rounded bg-zinc-800 px-2 py-1 text-xs font-medium">{r.status ?? "—"}</span></td>
                    <td className="px-4 py-3 font-semibold text-amber-300">{fmtMoney(Number(r.stake ?? 0))}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-zinc-400">{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function LiveMatchesView() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_active_matches");
    if (error) toast.error(error.message); else setRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    const ch = supabase.channel("admin-matches")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .subscribe();
    return () => { clearInterval(t); supabase.removeChannel(ch); };
  }, [load]);

  async function forceEnd(id: string, refund: boolean) {
    if (!confirm(refund ? "Encerrar e reembolsar?" : "Encerrar SEM reembolso?")) return;
    const { error } = await supabase.rpc("admin_force_end_match", { _match: id, _refund: refund });
    if (error) toast.error(error.message); else { toast.success("Partida encerrada"); load(); }
  }

  return (
    <div>
      <SectionHeader title="Partidas ao vivo" subtitle={`${rows.length} em andamento · atualiza em tempo real`} />
      <Card className="overflow-hidden border-zinc-800 bg-zinc-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/80 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">Jogador</th>
                <th className="px-4 py-3">Aposta</th>
                <th className="px-4 py-3">Iniciada</th>
                <th className="px-4 py-3">Duração</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Carregando…</td></tr> :
                rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Nenhuma partida ativa</td></tr> :
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-800/70 hover:bg-zinc-800/30">
                    <td className="px-4 py-3 font-medium">{r.username}</td>
                    <td className="px-4 py-3 font-bold text-amber-300">{fmtMoney(Number(r.stake))}</td>
                    <td className="px-4 py-3 text-zinc-400">{fmtDate(r.started_at)}</td>
                    <td className="px-4 py-3"><span className={`rounded px-2 py-1 text-xs font-bold ${r.age_seconds > 600 ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"}`}>{Math.floor(r.age_seconds/60)}m {r.age_seconds%60}s</span></td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => forceEnd(r.id, true)} className="border-zinc-700 bg-emerald-600/20 hover:bg-emerald-600/40">Encerrar + reembolsar</Button>
                        <Button size="sm" variant="outline" onClick={() => forceEnd(r.id, false)} className="border-zinc-700 bg-rose-600/20 hover:bg-rose-600/40">Forçar fim</Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function BroadcastView() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"info" | "success" | "warning">("info");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("admin_notifications").select("*").order("created_at", { ascending: false }).limit(30);
    setHistory(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function send() {
    if (!title.trim() || !body.trim()) { toast.error("Preencha título e mensagem"); return; }
    setSending(true);
    const { error } = await supabase.rpc("admin_broadcast", { _title: title, _body: body, _kind: kind });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Aviso enviado para todos");
    setTitle(""); setBody("");
    load();
  }

  return (
    <div>
      <SectionHeader title="Avisos & Notificações" subtitle="Mensagem enviada em tempo real para todos os usuários online" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-900/60 p-5">
          <div className="space-y-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="border-zinc-800 bg-zinc-950 text-zinc-100" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Mensagem para todos os usuários…" rows={5}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500" />
            <div className="flex gap-2">
              {(["info", "success", "warning"] as const).map((k) => (
                <button key={k} onClick={() => setKind(k)}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-bold uppercase ${kind === k ? "border-amber-500 bg-amber-500/20 text-amber-300" : "border-zinc-800 text-zinc-500"}`}>
                  {k}
                </button>
              ))}
            </div>
            <Button onClick={send} disabled={sending} className="w-full bg-amber-500 text-black hover:bg-amber-400">
              <Megaphone className="mr-2 h-4 w-4" /> {sending ? "Enviando…" : "Enviar para todos"}
            </Button>
          </div>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-3 text-sm font-semibold">Últimos avisos</div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {history.length === 0 ? <div className="text-xs text-zinc-500">Nenhum aviso enviado.</div> :
              history.map((h) => (
                <div key={h.id} className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-zinc-100">{h.title}</div>
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] uppercase text-zinc-400">{h.kind}</span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">{h.body}</div>
                  <div className="mt-1 text-[10px] text-zinc-600">{fmtDate(h.created_at)}</div>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function AuditView() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("admin_audit").select("*").order("created_at", { ascending: false }).limit(200);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);
  return (
    <div>
      <SectionHeader title="Auditoria" subtitle="Registro de ações administrativas" />
      <Card className="overflow-hidden border-zinc-800 bg-zinc-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/80 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr><th className="px-4 py-3">Quando</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Alvo</th><th className="px-4 py-3 hidden md:table-cell">Detalhes</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">Carregando…</td></tr> :
                rows.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">Sem registros</td></tr> :
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-800/70 hover:bg-zinc-800/30">
                    <td className="px-4 py-3 text-zinc-400">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3"><span className="rounded bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-300">{r.action}</span></td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">{r.target_user ? String(r.target_user).slice(0, 8) : "—"}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-zinc-500">{r.details ? JSON.stringify(r.details) : "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-left hover:border-zinc-700">
      <div>
        <div className="text-sm font-medium text-zinc-100">{label}</div>
        {desc && <div className="text-xs text-zinc-500">{desc}</div>}
      </div>
      <div className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-amber-500" : "bg-zinc-700"}`}>
        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-5" : "left-0.5"}`} />
      </div>
    </button>
  );
}

function NumField({ label, value, onChange, step = "1", suffix }: { label: string; value: number; onChange: (n: number) => void; step?: string; suffix?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">{label}{suffix && <span className="ml-1 normal-case text-zinc-600">({suffix})</span>}</label>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="border-zinc-800 bg-zinc-950 text-zinc-100" />
    </div>
  );
}

function SettingsView() {
  return <SettingsViewInner />;
}

function ShopView() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_cue_skins");
    if (error) toast.error(error.message); else setRows(data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(id: string | null, patch: any) {
    const { error } = await supabase.rpc("admin_upsert_cue_skin", { _id: id as any, _patch: patch });
    if (error) { toast.error(error.message); return; }
    toast.success("Taco salvo");
    setEditing(null);
    load();
  }

  async function toggleActive(r: any) {
    await save(r.id, { active: !r.active });
  }

  async function del(r: any) {
    if (!confirm(`Excluir "${r.name}"?`)) return;
    const { error } = await supabase.rpc("admin_delete_cue_skin", { _id: r.id });
    if (error) toast.error(error.message); else { toast.success("Removido"); load(); }
  }

  return (
    <div>
      <SectionHeader title="Loja de tacos" subtitle={`${rows.length} itens · controle preço, multiplicador e disponibilidade`} />
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing({ id: null, name: "", slug: "", price: 0, payout_multiplier: 1.0, active: true })}
          className="bg-amber-500 text-black hover:bg-amber-400"><Plus className="mr-1 h-4 w-4" />Novo taco</Button>
      </div>
      <Card className="overflow-hidden border-zinc-800 bg-zinc-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/80 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Preço</th><th className="px-4 py-3">Mult.</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Carregando…</td></tr> :
                rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Sem tacos</td></tr> :
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-800/70 hover:bg-zinc-800/30">
                    <td className="px-4 py-3"><div className="font-medium">{r.name}</div><div className="text-xs text-zinc-500">{r.slug}</div></td>
                    <td className="px-4 py-3 font-semibold text-amber-300">{fmtMoney(Number(r.price))}</td>
                    <td className="px-4 py-3 font-mono">{Number(r.payout_multiplier).toFixed(2)}x</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-1 text-xs font-bold ${r.active ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-700 text-zinc-400"}`}>{r.active ? "Ativo" : "Oculto"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => toggleActive(r)} className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700">{r.active ? "Ocultar" : "Ativar"}</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditing(r)} className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700">Editar</Button>
                        <Button size="sm" variant="outline" onClick={() => del(r)} className="border-rose-700/40 bg-rose-600/20 hover:bg-rose-600/40"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setEditing(null)}>
          <Card className="w-full max-w-md border-zinc-800 bg-zinc-900 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 text-lg font-bold">{editing.id ? "Editar taco" : "Novo taco"}</div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Nome</label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="border-zinc-800 bg-zinc-950 text-zinc-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Slug</label>
                <Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="border-zinc-800 bg-zinc-950 text-zinc-100" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Preço (R$)" value={Number(editing.price) || 0} onChange={(n) => setEditing({ ...editing, price: n })} step="0.01" />
                <NumField label="Multiplicador" value={Number(editing.payout_multiplier) || 1} onChange={(n) => setEditing({ ...editing, payout_multiplier: n })} step="0.01" />
              </div>
              <Toggle label="Ativo na loja" checked={!!editing.active} onChange={(v) => setEditing({ ...editing, active: v })} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => save(editing.id, { name: editing.name, slug: editing.slug, price: editing.price, payout_multiplier: editing.payout_multiplier, active: editing.active })}
                className="flex-1 bg-amber-500 text-black hover:bg-amber-400"><Save className="mr-1 h-4 w-4" /> Salvar</Button>
              <Button variant="ghost" onClick={() => setEditing(null)} className="text-zinc-400">Cancelar</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function AffiliatesView() {
  const [top, setTop] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([
      supabase.rpc("admin_top_affiliates", { _limit: 50 }),
      supabase.rpc("admin_recent_referral_earnings", { _limit: 100 }),
    ]);
    if (a.error) toast.error(a.error.message); else setTop(a.data ?? []);
    if (b.error) toast.error(b.error.message); else setRecent(b.data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const totalCommission = useMemo(() => top.reduce((s, r) => s + Number(r.total_commission || 0), 0), [top]);
  const totalVolume = useMemo(() => top.reduce((s, r) => s + Number(r.total_volume || 0), 0), [top]);

  return (
    <div>
      <SectionHeader title="Afiliados & Indicações" subtitle="Comissão de 30% sobre cada depósito de indicado" />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Afiliados ativos" value={String(top.length)} icon={Share2} accent="sky" />
        <StatCard label="Comissão paga" value={fmtMoney(totalCommission)} icon={DollarSign} accent="emerald" />
        <StatCard label="Volume gerado" value={fmtMoney(totalVolume)} icon={TrendingUp} accent="amber" />
        <StatCard label="Lançamentos" value={String(recent.length)} icon={Activity} accent="amber" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden border-zinc-800 bg-zinc-900/60">
          <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold">Top afiliados</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/80 text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Indicados</th><th className="px-4 py-3">Volume</th><th className="px-4 py-3">Comissão</th></tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">Carregando…</td></tr> :
                  top.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">Nenhum afiliado</td></tr> :
                  top.map((r) => (
                    <tr key={r.referrer_id} className="border-t border-zinc-800/70 hover:bg-zinc-800/30">
                      <td className="px-4 py-3"><div className="font-medium">{r.username || "—"}</div><div className="text-xs text-zinc-500">{r.email}</div></td>
                      <td className="px-4 py-3 font-bold">{r.referred_count}</td>
                      <td className="px-4 py-3 text-zinc-300">{fmtMoney(Number(r.total_volume))}</td>
                      <td className="px-4 py-3 font-bold text-emerald-300">{fmtMoney(Number(r.total_commission))}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden border-zinc-800 bg-zinc-900/60">
          <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold">Comissões recentes</div>
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900/95 text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr><th className="px-4 py-3">Quando</th><th className="px-4 py-3">Quem</th><th className="px-4 py-3">Depósito</th><th className="px-4 py-3">Comissão</th></tr>
              </thead>
              <tbody>
                {recent.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">Nenhum registro</td></tr> :
                  recent.map((r) => (
                    <tr key={r.id} className="border-t border-zinc-800/70">
                      <td className="px-4 py-3 text-xs text-zinc-400">{fmtDate(r.created_at)}</td>
                      <td className="px-4 py-3"><div className="text-xs"><b className="text-amber-300">{r.referrer || "—"}</b> ← {r.referred || "—"}</div></td>
                      <td className="px-4 py-3 text-zinc-300">{fmtMoney(Number(r.deposit_amount))}</td>
                      <td className="px-4 py-3 font-bold text-emerald-300">{fmtMoney(Number(r.commission))}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SettingsViewInner() {
  const [s, setS] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_get_settings");
    if (error) toast.error(error.message); else setS(data);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(patch: any) {
    setSaving(true);
    const { data, error } = await supabase.rpc("admin_update_settings", { _patch: patch });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setS(data);
    toast.success("Configurações salvas");
  }

  if (!s) return <div className="text-sm text-zinc-500">Carregando configurações…</div>;

  return (
    <div>
      <SectionHeader title="Configurações da plataforma" subtitle="Controle completo do app em tempo real" />

      {s.maintenance_mode && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          <AlertTriangle className="h-5 w-5" /> Modo manutenção ATIVO — usuários comuns não conseguem usar o app.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold"><Power className="h-4 w-4 text-amber-400" /> Disponibilidade</div>
          <div className="space-y-2">
            <Toggle label="Modo manutenção" desc="Bloqueia o app inteiro" checked={s.maintenance_mode} onChange={(v) => save({ maintenance_mode: v })} />
            <Toggle label="Cadastros abertos" desc="Permite novos usuários" checked={s.signups_enabled} onChange={(v) => save({ signups_enabled: v })} />
            <Toggle label="Depósitos" checked={s.deposits_enabled} onChange={(v) => save({ deposits_enabled: v })} />
            <Toggle label="Saques" checked={s.withdrawals_enabled} onChange={(v) => save({ withdrawals_enabled: v })} />
            <Toggle label="Criação de partidas" checked={s.matches_enabled} onChange={(v) => save({ matches_enabled: v })} />
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Mensagem de manutenção</label>
            <textarea defaultValue={s.maintenance_message ?? ""} onBlur={(e) => e.target.value !== s.maintenance_message && save({ maintenance_message: e.target.value })}
              rows={2} className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-100" />
          </div>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold"><Bot className="h-4 w-4 text-amber-400" /> Tráfego & Bots</div>
          <Toggle label="Bots ativos no feed" desc="Mostrar partidas/desafios simulados" checked={s.bots_enabled} onChange={(v) => save({ bots_enabled: v })} />
          <SaveForm initial={{
            bot_creation_rate: s.bot_creation_rate,
            bot_min_stake: s.bot_min_stake,
            bot_max_stake: s.bot_max_stake,
          }} onSave={save} saving={saving}>
            {(state, set) => (
              <div className="mt-4 grid grid-cols-3 gap-3">
                <NumField label="Taxa criação" value={state.bot_creation_rate} onChange={(n) => set({ bot_creation_rate: n })} suffix="/min" />
                <NumField label="Aposta mín" value={state.bot_min_stake} onChange={(n) => set({ bot_min_stake: n })} step="0.01" suffix="R$" />
                <NumField label="Aposta máx" value={state.bot_max_stake} onChange={(n) => set({ bot_max_stake: n })} step="0.01" suffix="R$" />
              </div>
            )}
          </SaveForm>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold"><DollarSign className="h-4 w-4 text-amber-400" /> Limites & RTP</div>
          <SaveForm initial={{ min_stake: s.min_stake, max_stake: s.max_stake, global_rtp: s.global_rtp }} onSave={save} saving={saving}>
            {(state, set) => (
              <div className="grid grid-cols-3 gap-3">
                <NumField label="Aposta mín" value={state.min_stake} onChange={(n) => set({ min_stake: n })} step="0.01" suffix="R$" />
                <NumField label="Aposta máx" value={state.max_stake} onChange={(n) => set({ max_stake: n })} step="0.01" suffix="R$" />
                <NumField label="RTP global" value={state.global_rtp} onChange={(n) => set({ global_rtp: n })} step="0.01" suffix="0-1" />
              </div>
            )}
          </SaveForm>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Shield className="h-4 w-4 text-amber-400" /> Informações</div>
          <div className="space-y-1 text-xs text-zinc-400">
            <div>Última atualização: <span className="text-zinc-200">{fmtDate(s.updated_at)}</span></div>
            <div>Por: <span className="font-mono">{s.updated_by ? String(s.updated_by).slice(0, 8) : "—"}</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SaveForm<T extends Record<string, any>>({ initial, onSave, saving, children }: {
  initial: T; onSave: (patch: T) => void; saving: boolean;
  children: (state: T, set: (p: Partial<T>) => void) => any;
}) {
  const [state, setState] = useState<T>(initial);
  useEffect(() => { setState(initial); }, [JSON.stringify(initial)]);
  const dirty = JSON.stringify(state) !== JSON.stringify(initial);
  return (
    <div>
      {children(state, (p) => setState({ ...state, ...p }))}
      <Button disabled={!dirty || saving} onClick={() => onSave(state)} className="mt-3 w-full bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-40">
        <Save className="mr-2 h-4 w-4" /> {saving ? "Salvando…" : dirty ? "Salvar alterações" : "Sem alterações"}
      </Button>
    </div>
  );
}

function ApiView() {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCallback, setNewCallback] = useState("");

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_partners");
    if (error) toast.error(error.message);
    else {
      setPartners(data ?? []);
      if (selected) {
        const fresh = (data ?? []).find((p: any) => p.id === selected.id);
        if (fresh) setSelected(fresh);
      }
    }
    setLoading(false);
  }, [selected?.id]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = useCallback(async (p: any) => {
    setSelected(p);
    const [a, b] = await Promise.all([
      supabase.rpc("admin_partner_stats", { _id: p.id }),
      supabase.rpc("admin_recent_api_calls", { _partner: p.id, _limit: 50 }),
    ]);
    if (!a.error) setStats(a.data);
    if (!b.error) setCalls(b.data ?? []);
  }, []);

  async function createPartner() {
    if (!newName.trim()) { toast.error("Informe o nome do parceiro"); return; }
    setCreating(true);
    const { data, error } = await supabase.rpc("admin_create_partner", {
      _name: newName.trim(), _callback_url: newCallback.trim() || undefined,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Parceiro criado — copie o segredo, ele não aparece de novo");
    setNewName(""); setNewCallback("");
    await load();
    loadDetail(data);
  }

  async function toggleActive(p: any) {
    const { error } = await supabase.rpc("admin_update_partner", { _id: p.id, _patch: { active: !p.active } });
    if (error) toast.error(error.message); else { toast.success(p.active ? "Desativado" : "Ativado"); load(); }
  }

  async function adjustBalance(p: any) {
    const v = prompt(`Saldo atual: ${fmtMoney(Number(p.balance))}\nNovo saldo (R$):`, String(p.balance));
    if (v === null) return;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) { toast.error("Valor inválido"); return; }
    const { error } = await supabase.rpc("admin_update_partner", { _id: p.id, _patch: { balance: n } });
    if (error) toast.error(error.message); else { toast.success("Saldo atualizado"); load(); }
  }

  async function rotateSecret(p: any) {
    if (!confirm("Gerar novo segredo? O atual deixará de funcionar.")) return;
    const { data, error } = await supabase.rpc("admin_rotate_partner_secret", { _id: p.id });
    if (error) toast.error(error.message);
    else { toast.success("Segredo rotacionado"); await load(); if (data) setSelected(data); }
  }

  async function del(p: any) {
    if (!confirm(`Excluir parceiro "${p.name}"? Isso remove todas as rodadas e logs.`)) return;
    const { error } = await supabase.rpc("admin_delete_partner", { _id: p.id });
    if (error) toast.error(error.message);
    else { toast.success("Removido"); setSelected(null); load(); }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copiado`));
  }

  return (
    <div>
      <SectionHeader title="API / Integrações" subtitle="Conecte casas de aposta via REST: emita chaves, monitore chamadas e ajuste saldo do parceiro" />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-zinc-800 bg-zinc-900/60 p-5 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Plus className="h-4 w-4 text-amber-400" /> Novo parceiro</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input placeholder="Nome (ex: Casa Bet X)" value={newName} onChange={(e) => setNewName(e.target.value)} className="border-zinc-800 bg-zinc-950" />
            <Input placeholder="Callback URL (opcional)" value={newCallback} onChange={(e) => setNewCallback(e.target.value)} className="border-zinc-800 bg-zinc-950" />
          </div>
          <Button onClick={createPartner} disabled={creating} className="mt-3 bg-amber-500 text-black hover:bg-amber-400">
            <Key className="mr-1 h-4 w-4" /> {creating ? "Criando…" : "Emitir chaves"}
          </Button>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><CodeIcon className="h-4 w-4 text-amber-400" /> Base URL</div>
          <div className="rounded bg-zinc-950 p-2 font-mono text-xs text-amber-300 break-all">{baseUrl}/api/public/v1</div>
          <div className="mt-2 text-[11px] text-zinc-500">Endpoints: <span className="font-mono">/ping</span>, <span className="font-mono">/balance</span>, <span className="font-mono">/bet</span>, <span className="font-mono">/settle</span>, <span className="font-mono">/rollback</span></div>
        </Card>
      </div>

      <ApiDocs baseUrl={baseUrl} sampleKey={selected?.api_key} sampleSecret={selected?.api_secret} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="overflow-hidden border-zinc-800 bg-zinc-900/60 lg:col-span-2">
          <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold">Parceiros ({partners.length})</div>
          <div className="max-h-[500px] overflow-y-auto">
            {loading ? <div className="px-4 py-8 text-center text-zinc-500">Carregando…</div> :
              partners.length === 0 ? <div className="px-4 py-8 text-center text-zinc-500">Nenhum parceiro</div> :
              partners.map((p) => (
                <button key={p.id} onClick={() => loadDetail(p)}
                  className={`block w-full border-b border-zinc-800/70 px-4 py-3 text-left transition hover:bg-zinc-800/40 ${selected?.id === p.id ? "bg-amber-500/10" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{p.name}</div>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${p.active ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-700 text-zinc-400"}`}>{p.active ? "ATIVO" : "OFF"}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
                    <span className="font-mono">{p.api_key.slice(0, 18)}…</span>
                    <span className="font-bold text-amber-300">{fmtMoney(Number(p.balance))}</span>
                  </div>
                </button>
              ))}
          </div>
        </Card>

        <div className="lg:col-span-3">
          {!selected ? (
            <Card className="border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-500">Selecione um parceiro para ver detalhes</Card>
          ) : (
            <div className="space-y-4">
              <Card className="border-zinc-800 bg-zinc-900/60 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold">{selected.name}</div>
                    <div className="text-xs text-zinc-500">criado em {fmtDate(selected.created_at)}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => toggleActive(selected)} className="border-zinc-700 bg-zinc-800">{selected.active ? "Desativar" : "Ativar"}</Button>
                    <Button size="sm" variant="outline" onClick={() => adjustBalance(selected)} className="border-zinc-700 bg-zinc-800"><Wallet className="mr-1 h-3 w-3" />Saldo</Button>
                    <Button size="sm" variant="outline" onClick={() => rotateSecret(selected)} className="border-zinc-700 bg-zinc-800"><RefreshCw className="mr-1 h-3 w-3" />Rotacionar</Button>
                    <Button size="sm" variant="outline" onClick={() => del(selected)} className="border-rose-700/40 bg-rose-600/20"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <CredField label="API Key (x-api-key)" value={selected.api_key} onCopy={() => copy(selected.api_key, "API Key")} />
                  <CredField label="API Secret (HMAC)" value={selected.api_secret} onCopy={() => copy(selected.api_secret, "Secret")} secret />
                  {selected.callback_url && <CredField label="Callback URL" value={selected.callback_url} onCopy={() => copy(String(selected.callback_url ?? ""), "URL")} />}
                </div>
              </Card>

              {stats && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard label="Rodadas" value={String(stats.rounds_total ?? 0)} icon={Activity} accent="sky" />
                  <StatCard label="Apostado" value={fmtMoney(Number(stats.wagered_total || 0))} icon={TrendingUp} accent="amber" />
                  <StatCard label="Pago" value={fmtMoney(Number(stats.payout_total || 0))} icon={ArrowUpRight} accent="rose" />
                  <StatCard label="Lucro casa" value={fmtMoney(Number(stats.house_profit || 0))} icon={DollarSign} accent="emerald" />
                </div>
              )}

              <Card className="overflow-hidden border-zinc-800 bg-zinc-900/60">
                <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold">Últimas chamadas</div>
                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-zinc-900/95 text-left uppercase tracking-wider text-zinc-500">
                      <tr><th className="px-3 py-2">Quando</th><th className="px-3 py-2">Endpoint</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">IP</th></tr>
                    </thead>
                    <tbody>
                      {calls.length === 0 ? <tr><td colSpan={4} className="px-3 py-6 text-center text-zinc-500">Sem chamadas</td></tr> :
                        calls.map((c) => (
                          <tr key={c.id} className="border-t border-zinc-800/70">
                            <td className="px-3 py-2 text-zinc-400">{fmtDate(c.created_at)}</td>
                            <td className="px-3 py-2 font-mono">{c.endpoint}</td>
                            <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 font-bold ${c.status_code < 300 ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>{c.status_code}</span></td>
                            <td className="px-3 py-2 font-mono text-zinc-500">{c.ip || "—"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="border-zinc-800 bg-zinc-900/60 p-5">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><CodeIcon className="h-4 w-4 text-amber-400" /> Exemplo de chamada</div>
                <pre className="overflow-x-auto rounded bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-300">{`curl -X POST ${baseUrl}/api/public/v1/bet \\
  -H "content-type: application/json" \\
  -H "x-api-key: ${selected.api_key}" \\
  -d '{"round_id":"r-001","user_id":"player-42","stake":10}'`}</pre>
                <div className="mt-2 text-[11px] text-zinc-500">Assinatura HMAC opcional: header <span className="font-mono">x-timestamp</span> (ms) e <span className="font-mono">x-signature</span> = HMAC-SHA256(secret, <span className="font-mono">timestamp + "." + body</span>)</div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CredField({ label, value, onCopy, secret }: { label: string; value: string; onCopy: () => void; secret?: boolean }) {
  const [shown, setShown] = useState(!secret);
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="flex items-center gap-2 rounded bg-zinc-950 px-3 py-2">
        <code className="flex-1 truncate text-xs text-amber-300">{shown ? value : "•".repeat(Math.min(40, value.length))}</code>
        {secret && <button onClick={() => setShown(!shown)} className="text-zinc-400 hover:text-zinc-200"><Eye className="h-3.5 w-3.5" /></button>}
        <button onClick={onCopy} className="text-zinc-400 hover:text-amber-300"><Copy className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

function ApiDocs({ baseUrl, sampleKey, sampleSecret }: { baseUrl: string; sampleKey?: string; sampleSecret?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"overview" | "auth" | "endpoints" | "errors" | "webhooks" | "sdk">("overview");
  const key = sampleKey || "sk_live_xxxxxxxxxxxxxxxx";
  const secret = sampleSecret || "whsec_xxxxxxxxxxxxxxxx";
  const base = `${baseUrl}/api/public/v1`;

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "overview", label: "Visão geral" },
    { id: "auth", label: "Autenticação" },
    { id: "endpoints", label: "Endpoints" },
    { id: "errors", label: "Erros" },
    { id: "webhooks", label: "Webhooks" },
    { id: "sdk", label: "SDK / Exemplos" },
  ];

  return (
    <Card className="mb-6 overflow-hidden border-zinc-800 bg-zinc-900/60">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-zinc-800/30">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-500/10 p-2"><CodeIcon className="h-5 w-5 text-amber-400" /></div>
          <div>
            <div className="text-sm font-bold">Documentação da API</div>
            <div className="text-xs text-zinc-500">Referência completa para integrar casas de aposta — REST · JSON · HMAC</div>
          </div>
        </div>
        <div className="text-xs text-zinc-500">{open ? "Recolher ▲" : "Expandir ▼"}</div>
      </button>

      {open && (
        <div className="border-t border-zinc-800">
          <div className="flex flex-wrap gap-1 border-b border-zinc-800 bg-zinc-950/50 px-3 py-2">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition ${tab === t.id ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="space-y-4 p-5 text-sm text-zinc-300">
            {tab === "overview" && (
              <div className="space-y-3">
                <h3 className="text-base font-bold text-amber-300">Black 8 Ball Partner API v1</h3>
                <p>API RESTful para integração com casas de aposta e plataformas parceiras. Permite criar rodadas de jogo, debitar saldo do parceiro, registrar payouts e estornar transações.</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <DocBox title="Base URL"><code className="text-amber-300">{base}</code></DocBox>
                  <DocBox title="Formato">JSON · UTF-8</DocBox>
                  <DocBox title="Rate limit">600 req/min por parceiro</DocBox>
                </div>
                <h4 className="mt-4 font-semibold text-zinc-100">Fluxo típico</h4>
                <ol className="list-decimal space-y-1 pl-5 text-xs text-zinc-400">
                  <li><b>GET /balance</b> — confirme saldo prepago do parceiro.</li>
                  <li><b>POST /bet</b> — abra uma rodada (idempotente por <code>round_id</code>) debitando o stake.</li>
                  <li>Inicie a partida internamente; aguarde resultado.</li>
                  <li><b>POST /settle</b> — credite o payout ao parceiro e feche a rodada.</li>
                  <li><b>POST /rollback</b> — em caso de falha, estorne stake e reverta payout.</li>
                </ol>
              </div>
            )}

            {tab === "auth" && (
              <div className="space-y-3">
                <h3 className="text-base font-bold text-amber-300">Autenticação</h3>
                <p>Toda requisição exige o header <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-amber-300">x-api-key</code>. Para endpoints sensíveis (bet/settle/rollback) recomendamos também assinatura HMAC-SHA256.</p>
                <DocBox title="Headers obrigatórios">
                  <pre className="text-xs text-zinc-300">{`x-api-key: ${key}
content-type: application/json`}</pre>
                </DocBox>
                <DocBox title="Headers de assinatura (recomendado)">
                  <pre className="text-xs text-zinc-300">{`x-timestamp: 1719421200000        # epoch ms (tolerância ±5 min)
x-signature: <hex hmac-sha256>     # HMAC(secret, timestamp + "." + raw_body)`}</pre>
                </DocBox>
                <DocBox title="Como gerar a assinatura (Node.js)">
                  <pre className="overflow-x-auto text-xs text-zinc-300">{`import crypto from "crypto";
const ts = Date.now().toString();
const body = JSON.stringify(payload);
const sig = crypto
  .createHmac("sha256", "${secret}")
  .update(ts + "." + body)
  .digest("hex");`}</pre>
                </DocBox>
                <p className="text-xs text-zinc-500">⚠️ Nunca exponha o <code>api_secret</code> em frontend. Use-o apenas no backend do parceiro.</p>
              </div>
            )}

            {tab === "endpoints" && (
              <div className="space-y-5">
                <EndpointDoc method="GET" path="/ping" base={base} desc="Health-check. Retorna pong e timestamp do servidor."
                  response={`{ "ok": true, "pong": 1719421200000, "partner": "Casa Bet X" }`} />

                <EndpointDoc method="GET" path="/balance" base={base} desc="Consulta saldo prepago do parceiro."
                  response={`{ "ok": true, "balance": 12450.75, "currency": "BRL" }`} />

                <EndpointDoc method="POST" path="/bet" base={base}
                  desc="Abre uma rodada e debita o stake do saldo do parceiro. Idempotente: se o mesmo round_id for enviado novamente, retorna a rodada existente sem debitar de novo."
                  request={`{
  "round_id": "r-2026-0001",
  "user_id":  "player-42",
  "stake":    10.00,
  "game":     "8ball",
  "metadata": { "table": "vip-1" }
}`}
                  response={`{
  "ok": true,
  "round_id": "r-2026-0001",
  "status": "open",
  "stake": 10.00,
  "balance": 12440.75
}`} />

                <EndpointDoc method="POST" path="/settle" base={base}
                  desc="Liquida uma rodada aberta. Credita o payout ao parceiro e fecha o round. Idempotente por round_id."
                  request={`{
  "round_id": "r-2026-0001",
  "payout":   19.50,
  "result":   "win",
  "metadata": { "winner": "player-42" }
}`}
                  response={`{
  "ok": true,
  "round_id": "r-2026-0001",
  "status": "settled",
  "payout": 19.50,
  "balance": 12460.25
}`} />

                <EndpointDoc method="POST" path="/rollback" base={base}
                  desc="Estorna o stake e reverte qualquer payout creditado. Use em caso de falha técnica ou cancelamento."
                  request={`{ "round_id": "r-2026-0001", "reason": "timeout" }`}
                  response={`{
  "ok": true,
  "round_id": "r-2026-0001",
  "status": "rolled_back",
  "balance": 12450.75
}`} />
              </div>
            )}

            {tab === "errors" && (
              <div className="space-y-3">
                <h3 className="text-base font-bold text-amber-300">Códigos de erro</h3>
                <p>Erros seguem o padrão <code>{`{ "ok": false, "error": "<code>", "message": "<descrição>" }`}</code>.</p>
                <div className="overflow-hidden rounded border border-zinc-800">
                  <table className="w-full text-xs">
                    <thead className="bg-zinc-950 text-left uppercase tracking-wider text-zinc-500">
                      <tr><th className="px-3 py-2">HTTP</th><th className="px-3 py-2">Código</th><th className="px-3 py-2">Significado</th></tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      <ErrRow code="400" name="invalid_payload" desc="JSON inválido ou campos obrigatórios ausentes" />
                      <ErrRow code="401" name="invalid_api_key" desc="Header x-api-key ausente ou inválido" />
                      <ErrRow code="401" name="invalid_signature" desc="HMAC não confere ou timestamp fora da janela" />
                      <ErrRow code="402" name="insufficient_balance" desc="Saldo prepago do parceiro insuficiente" />
                      <ErrRow code="403" name="partner_disabled" desc="Parceiro desativado pelo admin" />
                      <ErrRow code="404" name="round_not_found" desc="round_id não existe" />
                      <ErrRow code="409" name="round_already_settled" desc="Tentativa de liquidar/estornar rodada já finalizada" />
                      <ErrRow code="422" name="invalid_stake" desc="Stake abaixo do mínimo ou acima do máximo" />
                      <ErrRow code="429" name="rate_limited" desc="Rate limit excedido — aguarde e tente novamente" />
                      <ErrRow code="500" name="internal_error" desc="Erro inesperado no servidor — contate o suporte" />
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === "webhooks" && (
              <div className="space-y-3">
                <h3 className="text-base font-bold text-amber-300">Webhooks</h3>
                <p>Se você configurar uma <b>Callback URL</b> no parceiro, enviaremos eventos em tempo real (POST JSON) para:</p>
                <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-400">
                  <li><code className="text-amber-300">round.opened</code> — quando uma rodada inicia</li>
                  <li><code className="text-amber-300">round.settled</code> — quando há resultado</li>
                  <li><code className="text-amber-300">round.rolled_back</code> — quando há estorno</li>
                  <li><code className="text-amber-300">balance.low</code> — saldo prepago abaixo do limite</li>
                </ul>
                <DocBox title="Exemplo de payload">
                  <pre className="overflow-x-auto text-xs text-zinc-300">{`POST <sua callback>
x-signature: <hex hmac>

{
  "event": "round.settled",
  "round_id": "r-2026-0001",
  "user_id": "player-42",
  "stake": 10.00,
  "payout": 19.50,
  "result": "win",
  "timestamp": 1719421250000
}`}</pre>
                </DocBox>
                <p className="text-xs text-zinc-500">Responda com HTTP 2xx em até 5s. Reentregamos até 5x com backoff exponencial.</p>
              </div>
            )}

            {tab === "sdk" && (
              <div className="space-y-3">
                <h3 className="text-base font-bold text-amber-300">Exemplos rápidos</h3>

                <DocBox title="cURL">
                  <pre className="overflow-x-auto text-xs text-zinc-300">{`curl -X POST ${base}/bet \\
  -H "content-type: application/json" \\
  -H "x-api-key: ${key}" \\
  -d '{"round_id":"r-001","user_id":"p-42","stake":10}'`}</pre>
                </DocBox>

                <DocBox title="Node.js (fetch)">
                  <pre className="overflow-x-auto text-xs text-zinc-300">{`const res = await fetch("${base}/bet", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": "${key}",
  },
  body: JSON.stringify({ round_id: "r-001", user_id: "p-42", stake: 10 }),
});
const data = await res.json();`}</pre>
                </DocBox>

                <DocBox title="PHP">
                  <pre className="overflow-x-auto text-xs text-zinc-300">{`$ch = curl_init("${base}/bet");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    "content-type: application/json",
    "x-api-key: ${key}",
  ],
  CURLOPT_POSTFIELDS => json_encode([
    "round_id" => "r-001",
    "user_id"  => "p-42",
    "stake"    => 10,
  ]),
]);
$response = json_decode(curl_exec($ch), true);`}</pre>
                </DocBox>

                <DocBox title="Python (requests)">
                  <pre className="overflow-x-auto text-xs text-zinc-300">{`import requests
r = requests.post(
  "${base}/bet",
  headers={"x-api-key": "${key}"},
  json={"round_id": "r-001", "user_id": "p-42", "stake": 10},
)
print(r.json())`}</pre>
                </DocBox>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function DocBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">{title}</div>
      <div className="text-xs text-zinc-300">{children}</div>
    </div>
  );
}

function EndpointDoc({ method, path, base, desc, request, response }: { method: string; path: string; base: string; desc: string; request?: string; response: string }) {
  const color = method === "GET" ? "bg-sky-500/20 text-sky-300" : method === "POST" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${color}`}>{method}</span>
        <code className="text-sm font-semibold text-amber-300">{path}</code>
        <span className="text-[10px] text-zinc-500">{base}{path}</span>
      </div>
      <p className="mb-3 text-xs text-zinc-400">{desc}</p>
      {request && (
        <div className="mb-2">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">Request body</div>
          <pre className="overflow-x-auto rounded bg-zinc-950 p-3 text-[11px] text-zinc-300">{request}</pre>
        </div>
      )}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">Response 200</div>
        <pre className="overflow-x-auto rounded bg-zinc-950 p-3 text-[11px] text-emerald-200">{response}</pre>
      </div>
    </div>
  );
}

function ErrRow({ code, name, desc }: { code: string; name: string; desc: string }) {
  return (
    <tr>
      <td className="px-3 py-2 font-mono text-rose-300">{code}</td>
      <td className="px-3 py-2 font-mono text-amber-300">{name}</td>
      <td className="px-3 py-2 text-zinc-400">{desc}</td>
    </tr>
  );
}
