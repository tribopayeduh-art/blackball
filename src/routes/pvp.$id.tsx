import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { cueGameUrl, getEquippedCueSlug, type CueSkinSlug } from "@/lib/cue-skins";
import { toast } from "sonner";
import { ArrowLeft, Swords, Trophy, WifiOff, Clock } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getEngine, isShotInProgress, isReadyForInput, serializeBalls, applyBalls,
  forceLocalTurn, eightBallPocketed, type PvpState,
} from "@/lib/pvp";
import { LOCAL_TEST_MODE } from "@/lib/local-test-mode";

export const Route = createFileRoute("/pvp/$id")({
  head: () => ({ meta: [{ title: "Mesa PvP — Black 8 Ball" }, { name: "robots", content: "noindex" }] }),
  component: PvpRoom,
});

type Match = {
  id: string; host_id: string; guest_id: string;
  stake: number; pot: number; fee_pct: number;
  status: "pending" | "active" | "finished" | "cancelled" | "expired";
  turn_user_id: string | null;
  shot_num: number;
  last_state: PvpState | null;
  winner_id: string | null;
  host_seen_at: string; guest_seen_at: string;
};

const SHOT_CLOCK = 30;

function PvpRoom() {
  if (LOCAL_TEST_MODE) {
    return (
      <div className="min-h-screen bg-black text-white grid place-items-center px-5">
        <div className="max-w-sm text-center rounded-2xl border border-white/10 bg-zinc-950 p-6">
          <WifiOff className="mx-auto h-10 w-10 text-[var(--gold)]" />
          <h1 className="mt-4 text-xl font-black">Multiplayer pausado</h1>
          <p className="mt-2 text-sm text-zinc-400">
            O PvP precisa de banco e sincronização em tempo real. No modo local, teste a partida completa contra o computador.
          </p>
          <Link to="/play" search={{ stake: undefined }} className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[var(--gold)] px-5 font-black text-black">
            Jogar localmente
          </Link>
        </div>
      </div>
    );
  }
  return <PvpRoomOnline />;
}

function PvpRoomOnline() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();

  const [match, setMatch] = useState<Match | null>(null);
  const [opp, setOpp] = useState<{ id: string; username: string } | null>(null);
  const [me, setMe] = useState<{ id: string; username: string } | null>(null);
  const [tableReady, setTableReady] = useState(false);
  const [launchMsg, setLaunchMsg] = useState("Conectando…");
  const [shotSeconds, setShotSeconds] = useState(SHOT_CLOCK);
  const [cueSlug, setCueSlug] = useState<CueSkinSlug>("starter");
  const [oppOffline, setOppOffline] = useState(false);
  const [oppOfflineSec, setOppOfflineSec] = useState(0);
  const [endDialog, setEndDialog] = useState<null | "win" | "loss">(null);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const matchRef = useRef<Match | null>(null);
  const settledRef = useRef(false);
  const lastShotRef = useRef(0);
  const wasShootingRef = useRef(false);
  const launchRunRef = useRef(0);

  useEffect(() => { matchRef.current = match; }, [match]);
  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void getEquippedCueSlug(user.id).then((slug) => {
      if (!cancelled) setCueSlug(slug);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isMyTurn = !!(match && user && match.turn_user_id === user.id && match.status === "active");

  // Load match + opponent profile
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const { data: m, error } = await supabase.from("pvp_matches").select("*").eq("id", id).maybeSingle();
      if (!alive) return;
      if (error || !m) { toast.error("Partida não encontrada"); nav({ to: "/" }); return; }
      if (m.host_id !== user.id && m.guest_id !== user.id) { toast.error("Acesso negado"); nav({ to: "/" }); return; }
      if (m.status === "pending") { toast.error("Aguardando aceite do convite"); nav({ to: "/social" }); return; }
      if (m.status !== "active") { toast.error("Partida encerrada"); nav({ to: "/" }); return; }
      setMatch(m as Match);
      lastShotRef.current = m.shot_num;
      const oppId = m.host_id === user.id ? m.guest_id : m.host_id;
      const { data: profs } = await supabase.from("profiles").select("id,username").in("id", [user.id, oppId]);
      if (!alive || !profs) return;
      const myP = profs.find((p: any) => p.id === user.id);
      const oppP = profs.find((p: any) => p.id === oppId);
      setMe(myP ?? { id: user.id, username: "Você" });
      setOpp(oppP ?? { id: oppId, username: "Oponente" });
    })();
    return () => { alive = false; };
  }, [id, user, nav]);

  // Realtime subscription for match state updates
  useEffect(() => {
    if (!match || !user) return;
    const ch = supabase.channel(`pvp:${match.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "pvp_matches", filter: `id=eq.${match.id}` },
        (payload) => {
          const next = payload.new as Match;
          setMatch(next);
          // Apply opponent's submitted state if it's a new shot AND it was the opponent's move (now my turn)
          if (next.shot_num > lastShotRef.current && next.last_state && next.turn_user_id === user.id) {
            const w = getEngine(iframeRef.current);
            if (w) {
              applyBalls(w, next.last_state);
              forceLocalTurn(w);
            }
            lastShotRef.current = next.shot_num;
            // Check end: opponent's shot pocketed the 8-ball
            if (next.last_state.balls.some(b => b.i === 8 && b.a === 0)) {
              void doSettle(user.id); // opponent pocketed 8 last — current rules: opponent wins if they pocketed legally; simplified, we treat as opponent victory
            }
          } else if (next.shot_num > lastShotRef.current) {
            lastShotRef.current = next.shot_num;
          }
          if (next.status === "finished") {
            setEndDialog(next.winner_id === user.id ? "win" : "loss");
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id, user?.id]);

  // Launch engine in single-player vs ghost AI mode (we'll suppress AI by forcing turn=p1 after each shot)
  useEffect(() => {
    if (!match) return;
    const runId = launchRunRef.current + 1;
    launchRunRef.current = runId;
    let stop = false;
    setTableReady(false);
    setLaunchMsg("Carregando mesa profissional…");
    const tryLaunch = () => {
      if (stop || launchRunRef.current !== runId) return;
      try {
        const w = iframeRef.current?.contentWindow as any;
        const cur = w?.game?.state?.current;
        if (cur === "play" && w?.playState?.gameInfo) {
          // Apply last_state if exists, force local turn
          if (matchRef.current?.last_state) applyBalls(w, matchRef.current.last_state);
          forceLocalTurn(w);
          if (w.game?.stage) w.game.stage.disableVisibilityChange = true;
          setTableReady(true);
          setLaunchMsg("Mesa pronta");
          return;
        }
        if (cur === "mainMenu" && w?.projectInfo && w?.game?.state) {
          w.projectInfo.mode = 1;
          w.projectInfo.aiRating = 5;
          w.projectInfo.levelName = "1player_5";
          w.projectInfo.tutorial = false;
          w.projectInfo.tutorialPlayed = true;
          w.projectInfo.lastBreaker = "none";
          w.famobi?.localStorage?.setItem?.("showTutorial", false);
          try {
            const cache: any = w.game?.cache?._cache?.image;
            if (cache?.humanIcon) cache.aiIcon = cache.humanIcon;
          } catch {}
          w.game.state.start("play", true, false);
          setLaunchMsg("Entrando na mesa…");
        }
      } catch {}
      setTimeout(tryLaunch, 80);
    };
    tryLaunch();
    return () => { stop = true; };
  }, [match?.id, cueSlug]);

  // Suppress AI: every tick, force engine to think turn=p1 (the local user).
  // When NOT my turn, also force balls to be still — block input via overlay.
  useEffect(() => {
    if (!tableReady) return;
    const id = window.setInterval(() => {
      const w = getEngine(iframeRef.current);
      if (!w) return;
      const info = w.playState.gameInfo;
      // Always keep engine on p1 (local user view); we manage turn via DB
      if (info.turn !== "p1") forceLocalTurn(w);
      // Prevent AI from auto-shooting (mode 1 AI runs when turn becomes p2)
      if (info.aiShotInProgress || info.aiThinking) {
        info.aiShotInProgress = false;
        info.aiThinking = false;
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [tableReady]);

  // Detect shot completion on my turn → submit state
  useEffect(() => {
    if (!tableReady || !match || !user) return;
    const id = window.setInterval(async () => {
      if (settledRef.current) return;
      const w = getEngine(iframeRef.current);
      if (!w) return;
      const m = matchRef.current;
      if (!m || m.status !== "active") return;
      if (m.turn_user_id !== user.id) { wasShootingRef.current = false; return; }

      const shooting = isShotInProgress(w);
      if (shooting) { wasShootingRef.current = true; return; }

      if (wasShootingRef.current && isReadyForInput(w)) {
        wasShootingRef.current = false;
        // Submit: serialize and pass turn to opponent
        const state = serializeBalls(w);
        const oppId = m.host_id === user.id ? m.guest_id : m.host_id;
        settledRef.current = true;
        const { error } = await supabase.rpc("pvp_submit_turn", {
          _match_id: m.id, _state: state as any, _next_user: oppId,
        });
        settledRef.current = false;
        if (error) { toast.error(error.message); return; }
        lastShotRef.current = m.shot_num + 1;

        // If the 8-ball was pocketed, I win (legal pot assumed for simplicity)
        if (eightBallPocketed(w)) {
          await doSettle(user.id);
        }
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [tableReady, match, user]);

  // Shot clock — 30s per turn for whoever has the turn
  useEffect(() => {
    if (!match || match.status !== "active") return;
    setShotSeconds(SHOT_CLOCK);
    const start = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const left = Math.max(0, SHOT_CLOCK - elapsed);
      setShotSeconds(left);
      if (left === 0 && match.turn_user_id === user?.id && !settledRef.current) {
        settledRef.current = true;
        const oppId = match.host_id === user.id ? match.guest_id : match.host_id;
        const w = getEngine(iframeRef.current);
        const state = w ? serializeBalls(w) : { balls: [] };
        supabase.rpc("pvp_submit_turn", { _match_id: match.id, _state: state as any, _next_user: oppId })
          .then(() => { settledRef.current = false; toast.error("Tempo esgotado!"); });
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [match?.turn_user_id, match?.status, match?.id, user?.id]);

  // Heartbeat every 10s + opponent offline detection
  useEffect(() => {
    if (!match || match.status !== "active") return;
    const ping = () => supabase.rpc("pvp_heartbeat", { _match_id: match.id });
    ping();
    const h = setInterval(ping, 10_000);
    const check = setInterval(() => {
      const m = matchRef.current; if (!m || !user) return;
      const oppSeen = m.host_id === user.id ? m.guest_seen_at : m.host_seen_at;
      const ageSec = Math.floor((Date.now() - new Date(oppSeen).getTime()) / 1000);
      setOppOffline(ageSec > 30);
      setOppOfflineSec(ageSec);
    }, 2000);
    return () => { clearInterval(h); clearInterval(check); };
  }, [match?.id, match?.status, user?.id]);

  // Re-fetch periodically as a safety net (in case realtime drops)
  useEffect(() => {
    if (!match) return;
    const id = setInterval(async () => {
      const { data } = await supabase.from("pvp_matches").select("*").eq("id", match.id).maybeSingle();
      if (data) setMatch(data as Match);
    }, 8000);
    return () => clearInterval(id);
  }, [match?.id]);

  const doSettle = useCallback(async (winnerId: string) => {
    if (!matchRef.current) return;
    const { error } = await supabase.rpc("pvp_settle", { _match_id: matchRef.current.id, _winner_id: winnerId });
    if (error) toast.error(error.message);
  }, []);

  const claimWalkover = useCallback(async () => {
    const { error } = await supabase.rpc("pvp_claim_walkover", { _match_id: id });
    if (error) toast.error(error.message);
    else toast.success("Vitória por desconexão do oponente!");
  }, [id]);

  const forfeit = useCallback(async () => {
    if (!match || !user) return;
    const oppId = match.host_id === user.id ? match.guest_id : match.host_id;
    await doSettle(oppId);
    nav({ to: "/" });
  }, [match, user, doSettle, nav]);

  if (loading || !user || !match) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-zinc-400">
        Carregando partida…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-black px-3 sm:px-4 pt-3 pb-3 border-b border-border">
        <div className="max-w-4xl mx-auto rounded-2xl bg-black/60 border border-white/5 px-3 py-2 flex items-center gap-3">
          <button onClick={forfeit} className="inline-flex items-center gap-1.5 text-foreground/90 text-sm font-bold px-2 py-1.5 rounded-lg hover:bg-white/5 transition">
            <ArrowLeft className="h-4 w-4" /> Desistir
          </button>
          <div className="flex-1 flex items-center justify-center gap-3 text-xs">
            <div className="text-right">
              <div className="font-black text-white text-sm leading-none">{me?.username ?? "Você"}</div>
              <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">VOCÊ</div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-gradient-to-br from-[var(--gold)]/20 to-amber-900/10 border border-[var(--gold)]/40">
              <div className="text-[9px] uppercase tracking-widest text-[var(--gold)]/80 font-bold">Pote</div>
              <div className="font-black text-[var(--gold)] text-sm tabular-nums">R$ {Number(match.pot).toFixed(0)}</div>
            </div>
            <div className="text-left">
              <div className="font-black text-white text-sm leading-none">{opp?.username ?? "Oponente"}</div>
              <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">RIVAL</div>
            </div>
          </div>
          <div className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-black ${
            shotSeconds <= 5 ? "bg-destructive/20 border border-destructive/60 text-destructive animate-pulse"
            : shotSeconds <= 10 ? "bg-amber-500/20 border border-amber-500/60 text-amber-400"
            : "bg-white/5 border border-white/10 text-white"
          }`}>
            <Clock className="h-3.5 w-3.5" />
            <span className="tabular-nums">{String(shotSeconds).padStart(2, "0")}s</span>
          </div>
        </div>
      </header>

      <div className="relative flex-1 flex flex-col">
        <iframe
          ref={iframeRef}
          src={cueGameUrl(cueSlug)}
          title="PvP"
          loading="eager"
          onLoad={() => setLaunchMsg("Mesa carregada…")}
          className="flex-1 w-full border-0 bg-background"
          allow="autoplay; fullscreen"
        />

        {/* Turn indicator */}
        {tableReady && (
          <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-20">
            <div className={`inline-flex items-center gap-2 rounded-full backdrop-blur border px-4 py-1.5 text-xs font-black uppercase tracking-widest shadow-lg ${
              isMyTurn
                ? "bg-emerald-500/15 border-emerald-500/60 text-emerald-300"
                : "bg-amber-500/15 border-amber-500/60 text-amber-300"
            }`}>
              <Swords className="h-3.5 w-3.5" />
              {isMyTurn ? "Sua vez" : `Vez de ${opp?.username ?? "oponente"}`}
            </div>
          </div>
        )}

        {/* Lock input overlay when not my turn */}
        {tableReady && !isMyTurn && (
          <div className="absolute inset-0 z-10 bg-black/35 backdrop-blur-[1px] flex items-end justify-center pb-12 pointer-events-auto">
            <div className="px-6 py-3 rounded-2xl bg-black/80 border border-amber-500/40 text-center">
              <div className="text-amber-400 font-black text-sm uppercase tracking-widest">Aguardando jogada</div>
              <div className="text-zinc-400 text-xs mt-1">{opp?.username ?? "Oponente"} está jogando…</div>
            </div>
          </div>
        )}

        {/* Loading screen */}
        {!tableReady && (
          <div className="absolute inset-0 z-30 bg-black flex flex-col items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[var(--gold)] animate-pulse" />
              <div className="h-2 w-2 rounded-full bg-[var(--gold)] animate-pulse [animation-delay:150ms]" />
              <div className="h-2 w-2 rounded-full bg-[var(--gold)] animate-pulse [animation-delay:300ms]" />
            </div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-white">Carregando</p>
            <p className="text-[10px] font-semibold text-white/60">{launchMsg}</p>
          </div>
        )}

        {/* Opponent offline banner */}
        {oppOffline && match.status === "active" && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
            <div className="px-4 py-2.5 rounded-2xl bg-destructive/15 border border-destructive/40 backdrop-blur flex items-center gap-3 shadow-lg">
              <WifiOff className="h-4 w-4 text-destructive" />
              <div className="text-xs">
                <div className="font-black text-destructive uppercase tracking-wider">Oponente desconectado</div>
                <div className="text-[10px] text-zinc-400">{oppOfflineSec}s sem resposta</div>
              </div>
              {oppOfflineSec >= 120 && (
                <Button size="sm" onClick={claimWalkover} className="ml-2 h-7 text-[10px] font-black uppercase">
                  Reivindicar vitória
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!endDialog} onOpenChange={(v) => { if (!v) nav({ to: "/" }); }}>
        <DialogContent className="bg-card border-primary/40">
          <DialogHeader>
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/15 flex items-center justify-center mb-2">
              <Trophy className={`h-7 w-7 ${endDialog === "win" ? "text-[var(--gold)]" : "text-zinc-500"}`} />
            </div>
            <DialogTitle className="text-center text-xl">
              {endDialog === "win" ? "🏆 Vitória!" : "Derrota"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {endDialog === "win"
                ? `Você ganhou R$ ${(Number(match.pot) * (1 - Number(match.fee_pct))).toFixed(2)}`
                : `Mais sorte na próxima!`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => nav({ to: "/" })} className="w-full">Voltar ao início</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Link to="/" className="sr-only">home</Link>
    </div>
  );
}
