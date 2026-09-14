import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Trophy, X, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/historico")({
  head: () => ({
    meta: [
      { title: "Histórico — Black 8 Ball" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HistoricoPage,
});

type Match = {
  id: string;
  stake: number;
  payout: number;
  status: "active" | "won" | "lost" | "forfeit";
  started_at: string;
  settled_at: string | null;
};

function HistoricoPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [load, setLoad] = useState(true);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoad(true);
      const { data } = await supabase
        .from("matches")
        .select("id, stake, payout, status, started_at, settled_at")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(50);
      setMatches((data as Match[]) ?? []);
      setLoad(false);
    })();
  }, [user]);

  const stats = useMemo(() => {
    const settled = matches.filter(m => m.status !== "active");
    const wins = settled.filter(m => m.status === "won").length;
    const total = settled.length;
    const profit = settled.reduce((s, m) => s + (m.status === "won" ? Number(m.payout) - Number(m.stake) : -Number(m.stake)), 0);
    const wagered = settled.reduce((s, m) => s + Number(m.stake), 0);
    return { wins, total, profit, wagered, winrate: total ? Math.round((wins / total) * 100) : 0 };
  }, [matches]);

  // Build cumulative profit series, oldest -> newest
  const series = useMemo(() => {
    const chronological = [...matches].filter(m => m.status !== "active").reverse();
    let acc = 0;
    return chronological.map(m => {
      const delta = m.status === "won" ? Number(m.payout) - Number(m.stake) : -Number(m.stake);
      acc += delta;
      return { x: m.started_at, y: acc };
    });
  }, [matches]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 page-enter">
      <AppHeader />
      <div className="max-w-md mx-auto px-4 pt-4">
        <h1 className="font-black tracking-tight text-base">Histórico de partidas</h1>
      </div>

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3 bg-card/70 border-border/60">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Vitórias</div>
            <div className="font-mono text-lg font-black tabular-nums">{stats.wins}/{stats.total}</div>
          </Card>
          <Card className="p-3 bg-card/70 border-border/60">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Win rate</div>
            <div className="font-mono text-lg font-black tabular-nums">{stats.winrate}%</div>
          </Card>
          <Card className={`p-3 border-border/60 ${stats.profit >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Lucro</div>
            <div className={`font-mono text-lg font-black tabular-nums ${stats.profit >= 0 ? "text-primary" : "text-destructive"}`}>
              {stats.profit >= 0 ? "+" : ""}R$ {stats.profit.toFixed(0)}
            </div>
          </Card>
        </div>

        {/* Chart */}
        <Card className="p-4 bg-card/70 border-border/60">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Desempenho acumulado
            </h2>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Últimas {series.length}</span>
          </div>
          <ProfitChart data={series} />
        </Card>

        {/* List */}
        <Card className="p-2 bg-card/70 border-border/60 divide-y divide-border/60">
          {load ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : matches.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma partida ainda.</div>
          ) : matches.map(m => {
            const won = m.status === "won";
            const forfeit = m.status === "forfeit";
            const delta = won ? Number(m.payout) - Number(m.stake) : -Number(m.stake);
            const date = new Date(m.started_at);
            return (
              <div key={m.id} className="flex items-center gap-3 px-3 py-3">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                  won ? "bg-primary/15 text-primary" : forfeit ? "bg-muted text-muted-foreground" : "bg-destructive/15 text-destructive"
                }`}>
                  {won ? <Trophy className="h-4 w-4" /> : forfeit ? <Clock className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold capitalize">
                    {won ? "Vitória" : forfeit ? "Abandono" : m.status === "active" ? "Em andamento" : "Derrota"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {date.toLocaleDateString("pt-BR")} · {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · aposta R$ {Number(m.stake).toFixed(0)}
                  </div>
                </div>
                {m.status !== "active" && (
                  <div className={`font-mono text-sm font-black tabular-nums shrink-0 ${
                    delta > 0 ? "text-primary" : "text-destructive"
                  }`}>
                    {delta > 0 ? "+" : ""}R$ {delta.toFixed(0)}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      </main>
      <BottomNav />
    </div>
  );
}

function ProfitChart({ data }: { data: { x: string; y: number }[] }) {
  if (data.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">
        Jogue mais partidas para ver seu gráfico
      </div>
    );
  }
  const w = 320, h = 120, pad = 6;
  const ys = data.map(d => d.y);
  const min = Math.min(0, ...ys);
  const max = Math.max(0, ...ys);
  const range = max - min || 1;
  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((d.y - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${path} L ${pts[pts.length - 1][0].toFixed(1)} ${h - pad} L ${pts[0][0].toFixed(1)} ${h - pad} Z`;
  const zeroY = h - pad - ((0 - min) / range) * (h - pad * 2);
  const last = data[data.length - 1].y;
  const positive = last >= 0;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32">
        <defs>
          <linearGradient id="profitGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={positive ? "hsl(var(--primary))" : "hsl(var(--destructive))"} stopOpacity="0.35" />
            <stop offset="100%" stopColor={positive ? "hsl(var(--primary))" : "hsl(var(--destructive))"} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={pad} x2={w - pad} y1={zeroY} y2={zeroY} stroke="currentColor" strokeOpacity="0.15" strokeDasharray="3 3" />
        <path d={area} fill="url(#profitGrad)" />
        <path d={path} fill="none" stroke={positive ? "hsl(var(--primary))" : "hsl(var(--destructive))"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className={`absolute top-1 right-2 text-[11px] font-black tabular-nums inline-flex items-center gap-1 ${positive ? "text-primary" : "text-destructive"}`}>
        {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {positive ? "+" : ""}R$ {last.toFixed(0)}
      </div>
    </div>
  );
}