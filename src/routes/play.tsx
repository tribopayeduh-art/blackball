import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";
import { cueGameUrl, getEquippedCueSlug, type ArenaTheme, type CueSkinSlug } from "@/lib/cue-skins";
import { playWin, playLoss, playLevelUp } from "@/lib/feedback";
import {
  ArrowLeft,
  Plus,
  Target,
  Trophy,
  Check,
  Home,
  Swords,
  BarChart3,
  User as UserIcon,
  X,
  Clock3,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import escolhaApostaBanner from "@/assets/escolha-aposta-banner.png.asset.json";
import mesaLoadingBanner from "@/assets/mesa-loading.png.asset.json";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [{ title: "Mesa — 8 Ball Cash" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    stake: typeof s.stake === "number" ? s.stake : s.stake != null ? Number(s.stake) : undefined,
  }),
  component: PlayPage,
});

const STAKES = [1, 5, 10, 25, 50, 100];
const SHOT_CLOCK_SECONDS = 30;
const SHOT_CLOCK_MS = SHOT_CLOCK_SECONDS * 1000;
type MatchResult = {
  outcome: "win" | "loss";
  stake: number;
  amount: number;
};
type DeviceOrientation = "portrait" | "landscape";
type GameNotice = {
  kind: "turn" | "opponent" | "warning" | "success";
  title: string;
  message: string;
};

function hashText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1)
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

function botCueForMatch(matchId: string | null, playerCue: CueSkinSlug): CueSkinSlug {
  const seed = hashText(matchId || "black-ball-lobby");
  const availableCues = (
    ["starter", "oak", "crimson", "emerald", "obsidian", "royal"] as CueSkinSlug[]
  ).filter((slug) => slug !== playerCue);
  return (
    availableCues[seed % availableCues.length] || (playerCue === "starter" ? "oak" : "starter")
  );
}

function botNameForMatch(matchId: string | null): string {
  const names = ["Rafael", "Bruno", "Caio", "Matheus", "Lucas", "André"];
  return names[hashText(matchId || "black-ball-rival") % names.length];
}

function arenaThemeForMatch(matchId: string | null): ArenaTheme {
  const themes: ArenaTheme[] = ["ruby", "london", "vegas"];
  return themes[hashText(matchId || "black-ball-arena") % themes.length];
}

function PlayPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const search = Route.useSearch();
  const [balance, setBalance] = useState<number | null>(null);
  const [stake, setStake] = useState<number | null>(null);
  const [matchActive, setMatchActive] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [gameLoaded, setGameLoaded] = useState(false);
  const [tableReady, setTableReady] = useState(false);
  const [gameFrameKey, setGameFrameKey] = useState(0);
  const [cueSlug, setCueSlug] = useState<CueSkinSlug>("starter");
  const [launchMessage, setLaunchMessage] = useState("Preparando a mesa...");
  const [busy, setBusy] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [deviceOrientation, setDeviceOrientation] = useState<DeviceOrientation>("landscape");
  const [showOrientationGate, setShowOrientationGate] = useState(false);
  const [gameNotice, setGameNotice] = useState<GameNotice | null>(null);
  const [resultSeconds, setResultSeconds] = useState(4);
  const [shotSeconds, setShotSeconds] = useState(30);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const settledRef = useRef(false);
  const stakeRef = useRef<number | null>(null);
  const matchIdRef = useRef<string | null>(null);
  const autoStartedRef = useRef(false);
  const launchTimerRef = useRef<number | null>(null);
  const launchRunRef = useRef(0);
  const orientationTimerRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const botThinkingTurnRef = useRef<string | null>(null);
  const botThinkingTimerRef = useRef<number | null>(null);
  const botCue = botCueForMatch(matchId, cueSlug);
  const botName = botNameForMatch(matchId);
  const arenaTheme = arenaThemeForMatch(matchId);
  useEffect(() => {
    stakeRef.current = stake;
  }, [stake]);
  useEffect(() => {
    matchIdRef.current = matchId;
  }, [matchId]);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [user, loading, nav]);

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

  function clearLaunchTimer() {
    if (launchTimerRef.current !== null) {
      window.clearTimeout(launchTimerRef.current);
      launchTimerRef.current = null;
    }
  }

  // On mobile, request fullscreen + lock landscape when the table opens
  useEffect(() => {
    if (!matchActive) return;
    const isMobile =
      typeof window !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (!isMobile) return;
    const lock = async () => {
      try {
        const el: any = document.documentElement;
        if (!document.fullscreenElement && el.requestFullscreen) {
          await el.requestFullscreen({ navigationUI: "hide" } as any).catch(() => {});
        }
        const orient: any = (screen as any).orientation;
        if (orient && typeof orient.lock === "function") {
          await orient.lock("landscape").catch(() => {});
        }
      } catch {}
    };
    lock();
    const onTouch = () => {
      lock();
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("click", onTouch);
    };
    window.addEventListener("touchstart", onTouch, { once: true });
    window.addEventListener("click", onTouch, { once: true });
    return () => {
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("click", onTouch);
      try {
        const orient: any = (screen as any).orientation;
        if (orient && typeof orient.unlock === "function") orient.unlock();
        if (document.fullscreenElement && document.exitFullscreen)
          document.exitFullscreen().catch(() => {});
      } catch {}
    };
  }, [matchActive]);

  // Traduz os principais estados internos da mesa em avisos visuais consistentes.
  useEffect(() => {
    if (!matchActive || !tableReady) return;
    let previousTurn = "";
    let previousFoulKey = "";
    const id = window.setInterval(() => {
      try {
        const w = iframeRef.current?.contentWindow as any;
        const info = w?.playState?.gameInfo;
        if (!info || info.gameOver) return;
        const turn = String(info.turn ?? info.currentPlayer ?? "");
        if ((turn === "p1" || turn === "p2") && turn !== previousTurn) {
          previousTurn = turn;
          presentGameNotice(
            turn === "p1"
              ? { kind: "turn", title: "Sua vez", message: "Ajuste a mira e faça sua tacada." }
              : {
                  kind: "opponent",
                  title: "Vez do oponente",
                  message: "Acompanhe a jogada de perto.",
                },
            1450,
          );
        }

        const foulActive = Boolean(info.fouled || info.foulWindow?.visible);
        const foulKey = `${turn}:${Number(info.shotNum ?? info.shotCount ?? 0)}`;
        if (foulActive && foulKey !== previousFoulKey) {
          previousFoulKey = foulKey;
          presentGameNotice(
            {
              kind: "warning",
              title: turn === "p1" ? "Falta cometida" : "Falta do oponente",
              message:
                turn === "p1" ? "A vez passa para o adversário." : "Você ganhou a vez da mesa.",
            },
            2100,
          );
        }
      } catch {}
    }, 300);
    return () => window.clearInterval(id);
  }, [matchActive, tableReady]);

  // Humaniza o adversário: ele observa a mesa antes de jogar e varia
  // levemente a confiança entre as tacadas, mantendo jogadas competitivas.
  useEffect(() => {
    if (!matchActive || !tableReady) return;
    const interval = window.setInterval(() => {
      try {
        const w = iframeRef.current?.contentWindow as any;
        const info = w?.playState?.gameInfo;
        if (!info || info.gameOver) return;
        const turn = String(info.turn ?? info.currentPlayer ?? "");
        const shot = Number(info.shotNum ?? info.shotCount ?? 0);
        const moving = Boolean(info.shotRunning || info.shotInProgress || info.ballsMoving);
        const turnKey = `${turn}:${shot}:${info.cueBallInHand ? "hand" : "table"}`;

        if (turn !== "p2") {
          botThinkingTurnRef.current = null;
          return;
        }
        if (moving || info.trial || info.foulWindow?.visible || botThinkingTurnRef.current === turnKey) return;

        botThinkingTurnRef.current = turnKey;
        const seed = hashText(`${matchIdRef.current ?? "match"}:${turnKey}`);
        // Entre 2,8 s e 6,2 s: oponente observa, decide e só então libera a IA.
        const reactionMs = 2800 + (seed % 3400);
        const confidence = 3.15 + ((seed >>> 4) % 145) / 100;

        // Pausa curta somente antes do cálculo da tacada: simula leitura da mesa.
        if (w.game && !w.game.paused) w.game.paused = true;
        presentGameNotice(
          {
            kind: "opponent",
            title: `${botName} está pensando`,
            message: seed % 3 === 0 ? "Analisando uma jogada de tabela…" : seed % 3 === 1 ? "Ajustando força e direção…" : "Escolhendo a melhor bola…",
          },
          Math.min(reactionMs, 4600),
        );
        if (botThinkingTimerRef.current !== null) window.clearTimeout(botThinkingTimerRef.current);
        botThinkingTimerRef.current = window.setTimeout(() => {
          try {
            if (w.projectInfo) w.projectInfo.aiRating = confidence;
            if (w.game) w.game.paused = false;
          } catch {}
          botThinkingTimerRef.current = null;
        }, reactionMs);
      } catch {}
    }, 180);

    return () => {
      window.clearInterval(interval);
      if (botThinkingTimerRef.current !== null) window.clearTimeout(botThinkingTimerRef.current);
      botThinkingTimerRef.current = null;
      botThinkingTurnRef.current = null;
      try {
        const w = iframeRef.current?.contentWindow as any;
        if (w?.game) w.game.paused = false;
      } catch {}
    };
  }, [botName, matchActive, tableReady]);

  useEffect(() => () => clearLaunchTimer(), []);

  useEffect(
    () => () => {
      if (orientationTimerRef.current !== null) window.clearTimeout(orientationTimerRef.current);
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    },
    [],
  );

  // Mantém o resultado tempo suficiente para leitura e retorna sozinho à seleção de apostas.
  useEffect(() => {
    if (!matchResult || busy) return;
    setResultSeconds(4);
    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      const remaining = Math.max(0, 4 - Math.floor((Date.now() - startedAt) / 1000));
      setResultSeconds(remaining);
    }, 250);
    const timeoutId = window.setTimeout(() => {
      setMatchResult(null);
      setResultSeconds(4);
    }, 4000);
    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [matchResult, busy]);

  function presentGameNotice(notice: GameNotice, duration = 1800) {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    setGameNotice(notice);
    noticeTimerRef.current = window.setTimeout(() => {
      setGameNotice(null);
      noticeTimerRef.current = null;
    }, duration);
  }

  // Confere a posição do celular assim que a aposta é aceita e acompanha rotações posteriores.
  useEffect(() => {
    if (!matchActive) {
      setShowOrientationGate(false);
      return;
    }

    const syncOrientation = () => {
      const next: DeviceOrientation =
        window.innerWidth >= window.innerHeight ? "landscape" : "portrait";
      const mobileLike =
        window.matchMedia("(pointer: coarse)").matches ||
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      setDeviceOrientation(next);
      if (!mobileLike) {
        setShowOrientationGate(false);
        return;
      }
      if (orientationTimerRef.current !== null) window.clearTimeout(orientationTimerRef.current);
      if (next === "portrait") {
        setShowOrientationGate(true);
      } else {
        setShowOrientationGate(true);
        orientationTimerRef.current = window.setTimeout(() => {
          setShowOrientationGate(false);
          orientationTimerRef.current = null;
        }, 850);
      }
    };

    syncOrientation();
    window.addEventListener("resize", syncOrientation);
    window.addEventListener("orientationchange", syncOrientation);
    return () => {
      window.removeEventListener("resize", syncOrientation);
      window.removeEventListener("orientationchange", syncOrientation);
      if (orientationTimerRef.current !== null) window.clearTimeout(orientationTimerRef.current);
    };
  }, [matchActive]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: m }] = await Promise.all([
        supabase.from("profiles").select("balance").eq("id", user.id).single(),
        supabase.rpc("current_active_match"),
      ]);
      setBalance(Number(p?.balance ?? 0));
      // Resume any active match the backend still has open
      const active: any = Array.isArray(m) ? m[0] : m;
      if (active && active.id) {
        setMatchId(active.id);
        setStake(Number(active.stake));
        settledRef.current = false;
        setTableReady(false);
        setLaunchMessage("Retomando sua mesa...");
        setMatchActive(true);
      }
    })();
  }, [user]);

  async function startMatch(amount: number) {
    setMatchResult(null);
    setBusy(true);
    const { data, error } = await supabase.rpc("match_start", { _stake: amount });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const m: any = data;
    setMatchId(m.id);
    setStake(amount);
    settledRef.current = false;
    try {
      const w = iframeRef.current?.contentWindow as any;
      if (w?.playState?.gameInfo) {
        w.playState.gameInfo.gameOver = false;
        w.playState.gameInfo.winner = null;
      }
    } catch {}
    setTableReady(false);
    setLaunchMessage("Abrindo sua mesa...");
    setMatchActive(true);
    // Atualiza saldo em paralelo; não segura a abertura da mesa.
    void supabase
      .from("profiles")
      .select("balance")
      .eq("id", user!.id)
      .single()
      .then(({ data: p }) => {
        if (p) setBalance(Number(p.balance));
      });
    toast.success(`Aposta R$ ${amount}. Boa sorte!`);
  }

  function autoLaunchVsPlayer() {
    const runId = launchRunRef.current + 1;
    launchRunRef.current = runId;
    clearLaunchTimer();
    setTableReady(false);
    setLaunchMessage("Carregando mesa profissional...");
    const startedAt = Date.now();
    let startRequested = false;

    const tryLaunch = () => {
      if (launchRunRef.current !== runId) return;
      try {
        const w = iframeRef.current?.contentWindow as any;
        const currentState = w?.game?.state?.current;

        if (currentState === "play" && w?.playState?.gameInfo) {
          setTableReady(true);
          setLaunchMessage("Mesa pronta");
          clearLaunchTimer();
          return;
        }

        const menuInfo = w?.menuState?.menuInfo;
        const menuReady =
          w?.game?.state &&
          w?.game?.time?.events &&
          w?.projectInfo &&
          currentState === "mainMenu" &&
          menuInfo?.menuCanvas;

        if (menuReady && !startRequested) {
          startRequested = true;
          setLaunchMessage("Selecionando modo contra player...");

          const startTable = () => {
            if (launchRunRef.current !== runId) return;
            try {
              // Joga contra o computador (AI), mas mascarado como player humano.
              w.projectInfo.mode = 1;
              w.projectInfo.aiRating = Math.random() < 0.72 ? 4 : 5;
              w.projectInfo.levelName = `1player_${w.projectInfo.aiRating}`;
              w.projectInfo.tutorial = false;
              w.projectInfo.tutorialPlayed = true;
              w.projectInfo.clickedHelpButton = false;
              w.projectInfo.lastBreaker = "none";
              w.famobi?.localStorage?.setItem?.("showTutorial", false);
              w.famobi?.localStorage?.setItem?.("aiRating", w.projectInfo.aiRating);
              // Disfarça o ícone do oponente: usa o sprite "humanIcon" no lugar do "aiIcon".
              try {
                const cache: any = w.game?.cache?._cache?.image;
                if (cache && cache.humanIcon) cache.aiIcon = cache.humanIcon;
                const PIXI: any = w.PIXI;
                if (PIXI?.BaseTextureCache?.humanIcon)
                  PIXI.BaseTextureCache.aiIcon = PIXI.BaseTextureCache.humanIcon;
                if (PIXI?.TextureCache?.humanIcon)
                  PIXI.TextureCache.aiIcon = PIXI.TextureCache.humanIcon;
              } catch {}
              w.game.halt = false;
              w.game.paused = false;
              // Mantém o jogo rodando mesmo quando a aba perde foco
              try {
                if (w.game.stage) w.game.stage.disableVisibilityChange = true;
                w.game.lockRender = false;
              } catch {}
              if (menuInfo?.menuCanvas) {
                menuInfo.menuCanvas.visible = false;
                menuInfo.menuCanvas.alpha = 0;
              }
              w.game.state.start("play", true, false);
              window.requestAnimationFrame(() => {
                try {
                  if (launchRunRef.current === runId && w?.playState?.gameInfo) {
                    setTableReady(true);
                    setLaunchMessage("Mesa pronta");
                    clearLaunchTimer();
                  }
                } catch {}
              });
              setLaunchMessage("Entrando na mesa...");
            } catch {
              startRequested = false;
            }
          };

          w.game.time.events.add(1, startTable, w);
        }

        // Fallback para versões do jogo que não expõem o menu completo, mas já carregaram o estado.
        if (currentState === "mainMenu" && w?.game?.state && w?.projectInfo && !startRequested) {
          startRequested = true;
          w.projectInfo.mode = 1;
          w.projectInfo.aiRating = Math.random() < 0.72 ? 4 : 5;
          w.projectInfo.levelName = `1player_${w.projectInfo.aiRating}`;
          w.projectInfo.tutorial = false;
          w.projectInfo.tutorialPlayed = true;
          w.projectInfo.clickedHelpButton = false;
          w.projectInfo.lastBreaker = "none";
          w.famobi?.localStorage?.setItem?.("showTutorial", false);
          w.famobi?.localStorage?.setItem?.("aiRating", w.projectInfo.aiRating);
          try {
            const cache: any = w.game?.cache?._cache?.image;
            if (cache && cache.humanIcon) cache.aiIcon = cache.humanIcon;
            const PIXI: any = w.PIXI;
            if (PIXI?.BaseTextureCache?.humanIcon)
              PIXI.BaseTextureCache.aiIcon = PIXI.BaseTextureCache.humanIcon;
            if (PIXI?.TextureCache?.humanIcon)
              PIXI.TextureCache.aiIcon = PIXI.TextureCache.humanIcon;
          } catch {}
          window.setTimeout(() => {
            try {
              if (launchRunRef.current === runId) w.game.state.start("play", true, false);
            } catch {
              startRequested = false;
            }
          }, 100);
        }
      } catch {}
      if (Date.now() - startedAt < 30000) {
        launchTimerRef.current = window.setTimeout(tryLaunch, 60);
      } else {
        setLaunchMessage("A mesa demorou para responder. Tente novamente.");
        toast.error("Não foi possível abrir a mesa automaticamente. Tente novamente.");
      }
    };
    tryLaunch();
  }

  useEffect(() => {
    if (!matchActive) return;
    autoLaunchVsPlayer();
  }, [matchActive, gameFrameKey, gameLoaded, cueSlug]);

  // Timeout: se a mesa não carregar em 1 minuto, encerra a aposta e devolve o saldo
  useEffect(() => {
    if (!matchActive || tableReady) return;
    const timeoutId = window.setTimeout(() => {
      if (settledRef.current) return;
      if (tableReady) return;
      settledRef.current = true;
      toast.error("A mesa não carregou a tempo. Aposta cancelada e saldo devolvido.");
      // _won=true força reembolso integral (stake * 2 → equivalente a devolver a aposta + ganho 0)
      // Usamos refund manual via match_settle won=false forfeit=false não devolve;
      // melhor chamar via RPC dedicada — usamos endMatch(true) que paga stake*2 (devolve stake + premio).
      // Para apenas devolver o saldo: cancelamos como vitória sem multiplicador adicional.
      (async () => {
        const id = matchIdRef.current;
        const s = stakeRef.current;
        if (!id || !s) {
          setMatchActive(false);
          return;
        }
        // Devolve o saldo apostado
        await supabase.rpc("wallet_apply", {
          _type: "refund",
          _amount: s,
          _description: `Reembolso - mesa não carregou #${id.slice(0, 8)}`,
        });
        // Marca a partida como forfeit no servidor (sem novo débito, stake já foi cobrado)
        await supabase.rpc("match_settle", { _match_id: id, _won: false, _forfeit: true });
        const { data: p } = await supabase
          .from("profiles")
          .select("balance")
          .eq("id", user!.id)
          .single();
        if (p) setBalance(Number(p.balance));
        setMatchActive(false);
        setMatchId(null);
        setStake(null);
        setTableReady(false);
        clearLaunchTimer();
        launchRunRef.current += 1;
      })();
    }, 60000);
    return () => window.clearTimeout(timeoutId);
  }, [matchActive, tableReady, user]);

  // Auto-start ao chegar via /play?stake=NN (aceitar desafio na home)
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (!user || balance === null) return;
    if (matchActive || matchId) return;
    const s = search.stake;
    if (!s || s <= 0) return;
    if (balance < s) {
      toast.error("Saldo insuficiente para esse desafio");
      return;
    }
    autoStartedRef.current = true;
    startMatch(s);
  }, [search.stake, user, balance, matchActive, matchId]);

  async function endMatch(won: boolean, forfeit = false) {
    const id = matchIdRef.current;
    const s = stakeRef.current;
    if (!id || !s) return;
    setBusy(true);
    // Mostra o resultado no mesmo instante em que a mesa identifica o vencedor.
    if (!forfeit) {
      setMatchResult({
        outcome: won ? "win" : "loss",
        stake: s,
        amount: won ? s * 2 : s,
      });
    }
    // Snapshot pre-settle XP/level to detect level-up
    const { data: pre } = await supabase
      .from("profiles")
      .select("xp, level")
      .eq("id", user!.id)
      .single();
    const { error } = await supabase.rpc("match_settle", {
      _match_id: id,
      _won: won,
      _forfeit: forfeit,
    });
    if (error) {
      toast.error(error.message);
      setMatchResult(null);
      setBusy(false);
      return;
    }
    const { data: p } = await supabase
      .from("profiles")
      .select("balance, xp, level")
      .eq("id", user!.id)
      .single();
    if (p) setBalance(Number(p.balance));
    if (won) {
      toast.success(`🏆 Vitória! +R$ ${s * 2}`);
      playWin();
    } else if (forfeit) {
      toast.error(`Partida abandonada. -R$ ${s}`);
      playLoss();
    } else {
      toast.error("Derrota. Boa sorte na próxima!");
      playLoss();
    }
    // XP / level-up notifications
    if (pre && p) {
      const xpGain = Number(p.xp) - Number(pre.xp);
      if (xpGain > 0) toast(`+${xpGain} XP`, { description: `Total: ${p.xp} XP` });
      if (Number(p.level) > Number(pre.level)) {
        toast.success(`🎉 Nível ${p.level}!`, {
          description: `+R$ ${(Number(p.level) - Number(pre.level)) * 25} de bônus`,
        });
        playLevelUp();
      }
    }
    setBusy(false);
    setMatchActive(false);
    setMatchId(null);
    setStake(null);
    setTableReady(false);
    clearLaunchTimer();
    launchRunRef.current += 1;
  }

  // Detecção automática silenciosa
  useEffect(() => {
    if (!matchActive) return;
    const id = window.setInterval(() => {
      if (settledRef.current) return;
      try {
        const w = iframeRef.current?.contentWindow as any;
        const info = w?.playState?.gameInfo;
        if (!info || !info.gameOver || !info.winner) return;
        settledRef.current = true;
        endMatch(info.winner === "p1");
      } catch {}
    }, 600);
    return () => window.clearInterval(id);
  }, [matchActive]);

  // Mantém o jogo ativo quando a aba/janela perde foco
  useEffect(() => {
    if (!matchActive) return;
    const keepAlive = () => {
      try {
        const w = iframeRef.current?.contentWindow as any;
        if (w?.game) {
          if (w.game.stage) w.game.stage.disableVisibilityChange = true;
          w.game.paused = false;
          if (typeof w.game.lockRender !== "undefined") w.game.lockRender = false;
        }
      } catch {}
    };
    const onVis = () => keepAlive();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", keepAlive);
    window.addEventListener("focus", keepAlive);
    const id = window.setInterval(keepAlive, 500);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", keepAlive);
      window.removeEventListener("focus", keepAlive);
      window.clearInterval(id);
    };
  }, [matchActive]);

  // Cronômetro de 30s por tacada — reinicia quando a tacada termina e passa a vez se estourar
  useEffect(() => {
    if (!matchActive || !tableReady) {
      setShotSeconds(SHOT_CLOCK_SECONDS);
      return;
    }
    let lastReadyTurnKey: string | null = null;
    let wasShotInProgress = false;
    let deadline = Date.now() + SHOT_CLOCK_MS;
    let expiredTurnKey: string | null = null;

    const isBallMoving = (info: any) => {
      try {
        const balls = info?.ballArray;
        if (!Array.isArray(balls)) return false;
        const minVelocity = Number(info?.minVelocity ?? 2);
        return balls.some((ball: any) => Number(ball?.velocity?.magnitude ?? 0) > minVelocity);
      } catch {
        return false;
      }
    };

    const resetTurnState = (w: any, currentPlayer: string) => {
      try {
        const info = w?.playState?.gameInfo;
        if (!info) return;
        const nextPlayer = currentPlayer === "p1" ? "p2" : "p1";

        info.turn = nextPlayer;
        info.currentPlayer = nextPlayer;
        info.gameRunning = true;
        info.shotRunning = false;
        info.shotComplete = false;
        info.rulingsApplied = false;
        info.turnExtended = false;
        info.ballPotted = false;
        info.ballsPotted = 0;
        info.ballsPottedSameType = false;
        info.typesPotted = "";
        info.fouled = false;
        info.scratched = false;
        info.firstTouch = false;
        info.settingPower = false;
        info.executeStrike = false;
        info.beginStrike = false;
        info.cueTweenComplete = false;
        info.cueSet = false;
        info.lockAim = false;
        info.preventAim = false;
        info.preventSetPower = false;
        info.preventUpdateCue = false;
        info.drawGuide = true;
        info.moverMouseDown = false;
        info.moverMouseOver = false;
        info.placeFirstTimeMouseUp = false;
        info.trial = false;
        info.foundCalculatedShots = false;
        info.foundRandomShots = false;
        info.foulDisplayComplete = true;
        info.shotReset = true;
        info.initVars = false;

        if (info.turnArrow1) info.turnArrow1.frame = nextPlayer === "p1" ? 1 : 0;
        if (info.turnArrow2) info.turnArrow2.frame = nextPlayer === "p2" ? 1 : 0;
        if (info.foulWindow) {
          info.foulWindow.visible = false;
          info.foulWindow.alpha = 0;
        }
        if (info.cueCanvas) {
          info.cueCanvas.alpha = 1;
          info.cueCanvas.visible = nextPlayer === "p1" || w?.projectInfo?.mode === 2;
        }
        if (nextPlayer === "p2" && w?.projectInfo?.mode === 1) {
          if (info.guideCanvas) info.guideCanvas.visible = false;
          if (info.guide) info.guide.visible = false;
        }
        if (Array.isArray(info.ballArray)) {
          info.ballArray.forEach((ball: any) => {
            if (ball?.velocity) {
              ball.velocity.x = 0;
              ball.velocity.y = 0;
              ball.velocity.magnitude = 0;
            }
          });
        }
        if (typeof w.renderScreen === "function") w.renderScreen();
      } catch {}
    };

    const tick = () => {
      try {
        const w = iframeRef.current?.contentWindow as any;
        const ps = w?.playState;
        const info = ps?.gameInfo;
        if (!info) return;
        const player = String(info.turn ?? info.currentPlayer ?? "");
        if (player !== "p1" && player !== "p2") return;

        const shotInProgress = Boolean(
          info.shotRunning ||
          info.shotInProgress ||
          info.ballsMoving ||
          info.ballsInMotion ||
          isBallMoving(info) ||
          ps?.cueController?.shotInProgress ||
          ps?.ballController?.ballsMoving,
        );
        const shotEnded = wasShotInProgress && !shotInProgress;
        wasShotInProgress = shotInProgress;

        const turnReady = Boolean(
          !info.gameOver &&
          info.gameRunning !== false &&
          !info.trial &&
          !info.foulWindow?.visible &&
          !shotInProgress &&
          info.shotReset !== false,
        );

        if (!turnReady) {
          setShotSeconds(SHOT_CLOCK_SECONDS);
          return;
        }

        const readyTurnKey = [
          player,
          Number(info.shotNum ?? info.shotCount ?? info.shotsTaken ?? 0),
          info.cueBallInHand ? "hand" : "table",
        ].join(":");

        // Reinicia ao trocar jogador, ao concluir uma tacada ou ao começar um novo ciclo pronto para jogar.
        if (readyTurnKey !== lastReadyTurnKey || shotEnded) {
          lastReadyTurnKey = readyTurnKey;
          deadline = Date.now() + SHOT_CLOCK_MS;
          expiredTurnKey = null;
          setShotSeconds(SHOT_CLOCK_SECONDS);
        }

        const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        setShotSeconds(remaining);
        if (remaining === 0 && expiredTurnKey !== readyTurnKey) {
          expiredTurnKey = readyTurnKey;
          resetTurnState(w, player);
          if (player === "p1") toast.error("Tempo esgotado! Vez passada ao oponente.");
          else toast.success("Tempo do oponente esgotou. Sua vez!");
          presentGameNotice(
            player === "p1"
              ? {
                  kind: "warning",
                  title: "Tempo esgotado",
                  message: "Sua vez foi passada para o oponente.",
                }
              : {
                  kind: "success",
                  title: "Sua vez",
                  message: "O tempo do oponente terminou.",
                },
            2200,
          );
          lastReadyTurnKey = null;
          deadline = Date.now() + SHOT_CLOCK_MS;
          setShotSeconds(SHOT_CLOCK_SECONDS);
        }
      } catch {}
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [matchActive, tableReady]);

  // Intercepta voltar / fechar durante partida ativa
  useEffect(() => {
    if (!matchActive) return;
    window.history.pushState(null, "", window.location.href);
    const onPop = () => {
      window.history.pushState(null, "", window.location.href);
      setConfirmExit(true);
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [matchActive]);

  function requestExit() {
    if (matchActive) setConfirmExit(true);
    else nav({ to: "/" });
  }

  async function confirmForfeit() {
    setConfirmExit(false);
    if (matchActive) {
      settledRef.current = true;
      await endMatch(false, true);
    }
    nav({ to: "/" });
  }

  async function replayLastMatch() {
    if (!matchResult) return;
    const replayStake = matchResult.stake;
    if ((balance ?? 0) < replayStake) {
      toast.error("Saldo insuficiente para jogar novamente.");
      setMatchResult(null);
      return;
    }
    await startMatch(replayStake);
  }

  if (loading || !user) return null;

  return (
    <div
      className={`${matchActive ? `h-[100dvh] min-h-0 overflow-hidden match-shell is-${arenaTheme}` : "min-h-screen"} flex flex-col bg-background`}
    >
      {!matchActive && (
        <header className="sticky top-0 z-30 bg-black px-3 sm:px-4 pt-3">
          <div className="max-w-3xl mx-auto rounded-2xl bg-black/60 border border-white/5 px-3 py-2 flex items-center gap-3">
            <button
              onClick={requestExit}
              className="inline-flex items-center gap-1.5 text-foreground/90 text-sm font-bold px-2 py-1.5 rounded-lg hover:bg-white/5 transition"
              aria-label="Sair"
            >
              <ArrowLeft className="h-4 w-4" /> Sair
            </button>
            <Link to="/" className="flex-1 flex items-center justify-center gap-1.5 select-none">
              <span className="font-black italic tracking-tight text-base sm:text-xl bg-gradient-to-b from-white to-zinc-300 bg-clip-text text-transparent">
                BLACK
              </span>
              <span className="relative inline-flex items-center justify-center h-7 w-7 shrink-0">
                <span className="absolute inset-0 rounded-full bg-black shadow-[0_0_14px_2px_rgba(212,175,55,0.45)] ring-1 ring-[var(--gold)]/60" />
                <span className="relative font-black text-white text-[11px]">8</span>
              </span>
              <span className="font-black italic tracking-tight text-base sm:text-xl bg-gradient-to-b from-[var(--gold)] to-amber-600 bg-clip-text text-transparent">
                BALL
              </span>
            </Link>
            <div className="shrink-0 rounded-xl border border-white/10 bg-[#111] px-2.5 py-1 flex items-center gap-2">
              <div className="text-right leading-tight">
                <div className="text-[8px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
                  Saldo
                </div>
                <div className="font-black text-[11px] sm:text-xs text-white tabular-nums">
                  R${" "}
                  {(balance ?? 0).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
              <button
                onClick={() => nav({ to: "/" })}
                aria-label="Depositar"
                className="h-6 w-6 rounded-md bg-gradient-to-br from-[var(--gold)] to-amber-600 text-black inline-flex items-center justify-center hover:brightness-110 transition"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={3.5} />
              </button>
            </div>
          </div>
        </header>
      )}

      <div className={`relative flex-1 flex flex-col ${matchActive ? "match-arena min-h-0" : ""}`}>
        {matchActive && (
          <MatchArenaHud
            botName={botName}
            theme={arenaTheme}
            prize={(stake ?? 0) * 2}
            seconds={shotSeconds}
            ready={tableReady}
            onExit={requestExit}
          />
        )}

        <iframe
          key={`${gameFrameKey}:${cueSlug}:${botCue}:${arenaTheme}`}
          ref={iframeRef}
          src={cueGameUrl(cueSlug, botCue, arenaTheme)}
          title="8 Ball Pool"
          loading="eager"
          onLoad={() => {
            setGameLoaded(true);
            if (matchActive && !tableReady) setLaunchMessage("Mesa carregada. Entrando direto...");
          }}
          className={
            matchActive
              ? "match-arena__game flex-1 w-full min-h-0 border-0 bg-background"
              : "absolute inset-0 w-full h-full border-0 opacity-0 pointer-events-none"
          }
          allow="autoplay; fullscreen"
        />

        {matchActive && !tableReady && (
          <div
            className="match-loading absolute inset-x-0 bottom-0 z-10 flex flex-col items-center justify-end"
            style={{
              backgroundImage: `url(${mesaLoadingBanner.url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          >
            <div className="relative z-10 mb-8 sm:mb-12 flex flex-col items-center gap-3 px-6 text-center">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[var(--gold)] animate-pulse" />
                <div className="h-2 w-2 rounded-full bg-[var(--gold)] animate-pulse [animation-delay:150ms]" />
                <div className="h-2 w-2 rounded-full bg-[var(--gold)] animate-pulse [animation-delay:300ms]" />
              </div>
              <p className="text-xs sm:text-sm font-black uppercase tracking-[0.3em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                Carregando
              </p>
              <p className="text-[10px] sm:text-xs font-semibold text-white/80 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                {launchMessage}
              </p>
            </div>
          </div>
        )}

        {matchActive && showOrientationGate && <OrientationPopup orientation={deviceOrientation} />}

        {matchActive && tableReady && gameNotice && <InGameNotice notice={gameNotice} />}

        {!matchActive && (
          <div className="flex-1 relative z-10 pb-28">
            <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 space-y-5">
              {/* Banner */}
              <div className="overflow-hidden rounded-2xl border border-[var(--gold)]/30 shadow-2xl shadow-black/50 relative">
                <img
                  src={escolhaApostaBanner.url}
                  alt="Escolha sua aposta"
                  width={1280}
                  height={604}
                  className="w-full h-auto block"
                />
                <div className="absolute bottom-2 left-3 sm:left-4 text-[10px] sm:text-[11px] font-bold">
                  {gameLoaded ? (
                    <span className="text-[#ff596d]">Mesa pronta ✓</span>
                  ) : (
                    <span className="text-muted-foreground">Carregando mesa…</span>
                  )}
                </div>
              </div>

              {/* Section title */}
              <div className="flex items-center gap-2 px-1">
                <Target className="h-4 w-4 text-[var(--gold)]" />
                <h2 className="text-xs sm:text-sm font-black tracking-[0.15em] text-foreground uppercase">
                  Selecione o valor da sua aposta
                </h2>
              </div>

              {/* Stakes grid */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                {STAKES.map((value, idx) => {
                  const selected = stake === value;
                  const disabled = busy || (balance ?? 0) < value;
                  return (
                    <button
                      key={value}
                      onClick={() => !disabled && setStake(value)}
                      disabled={disabled}
                      className={`relative overflow-hidden aspect-[5/6] rounded-2xl border-2 p-3 flex flex-col items-center justify-center transition-all ${
                        selected
                          ? "border-[#ef233c] bg-gradient-to-br from-[#ef233c]/25 to-[#650012]/20 shadow-[0_0_30px_-5px_rgba(239,35,60,0.58)]"
                          : disabled
                            ? "border-white/5 bg-[#0c0c0c] opacity-40 cursor-not-allowed"
                            : "border-white/10 bg-[#111] hover:border-white/25"
                      }`}
                    >
                      {selected && (
                        <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-[#ef233c] text-white inline-flex items-center justify-center">
                          <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
                        </span>
                      )}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute -bottom-3 left-1/2 -translate-x-1/2 h-16 w-16 rounded-full bg-gradient-to-br from-zinc-700 to-black opacity-25 flex items-center justify-center text-xl font-black text-white"
                      >
                        8
                      </span>
                      <span
                        className={`relative text-[10px] sm:text-[11px] font-bold tracking-wider uppercase ${selected ? "text-[#ff8b99]" : "text-muted-foreground"}`}
                      >
                        apostar
                      </span>
                      <span
                        className={`relative font-black text-xl sm:text-2xl mt-1 tabular-nums ${selected ? "text-white" : "text-foreground"}`}
                      >
                        R$ {value}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Boa sorte card */}
              <div className="relative overflow-hidden rounded-2xl border border-[var(--gold)]/25 bg-gradient-to-r from-card to-background p-3.5 flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br from-[var(--gold)]/25 to-amber-900/10 border border-[var(--gold)]/30 flex items-center justify-center">
                  <Trophy className="h-6 w-6 text-[var(--gold)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-black text-[var(--gold)] text-sm tracking-wide">
                    BOA SORTE!
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Mostre quem é o rei da sinuca e leve sua vitória.
                  </p>
                </div>
                <div className="hidden sm:flex h-10 w-10 rounded-full bg-black border border-white/10 items-center justify-center font-black text-white text-sm shrink-0">
                  8
                </div>
              </div>

              {/* Confirm */}
              <button
                onClick={() => stake && startMatch(stake)}
                disabled={busy || !stake || (balance ?? 0) < (stake ?? 0)}
                className="w-full h-14 rounded-2xl border border-white/20 bg-gradient-to-b from-[#ef233c] to-[#a3001d] text-white font-black text-sm tracking-[0.18em] uppercase shadow-[0_10px_30px_-10px_rgba(239,35,60,0.72)] hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar aposta
              </button>

              {(balance ?? 0) === 0 && (
                <p className="text-center text-xs text-amber-400">
                  Saldo zerado — faça um depósito no painel.
                </p>
              )}
            </main>

            {/* Bottom nav */}
            <nav className="fixed bottom-0 inset-x-0 z-40 bg-black/95 backdrop-blur border-t border-white/5">
              <div className="max-w-2xl mx-auto grid grid-cols-5 items-end px-2 pt-2 pb-3 relative">
                <PlayNavItem
                  icon={<Home className="h-5 w-5" />}
                  label="Início"
                  onClick={() => nav({ to: "/" })}
                />
                <PlayNavItem
                  icon={<Swords className="h-5 w-5" />}
                  label="Desafios"
                  onClick={() => nav({ to: "/desafios" })}
                />
                <div className="flex flex-col items-center -mt-7">
                  <div className="h-14 w-14 rounded-full border-2 border-[var(--gold)] bg-black flex items-center justify-center shadow-[0_0_20px_-2px_rgba(212,175,55,0.6)]">
                    <Plus className="h-6 w-6 text-[var(--gold)]" strokeWidth={3} />
                  </div>
                  <span className="mt-1 text-[9px] font-black tracking-[0.15em] text-[var(--gold)] uppercase">
                    Criar aposta
                  </span>
                </div>
                <PlayNavItem
                  icon={<BarChart3 className="h-5 w-5" />}
                  label="Ranking"
                  onClick={() => toast("Em breve")}
                />
                <PlayNavItem
                  icon={<UserIcon className="h-5 w-5" />}
                  label="Perfil"
                  onClick={() => nav({ to: "/" })}
                />
              </div>
            </nav>
          </div>
        )}
      </div>

      {matchResult && (
        <MatchResultPopup
          result={matchResult}
          seconds={resultSeconds}
          busy={busy}
          onReplay={() => void replayLastMatch()}
          onHome={() => {
            setMatchResult(null);
            nav({ to: "/" });
          }}
        />
      )}

      <Dialog open={confirmExit} onOpenChange={setConfirmExit}>
        <DialogContent className="game-dialog game-dialog--warning">
          <DialogHeader>
            <img className="game-dialog__asset" src="/game/ui/status-warning.png" alt="" />
            <div className="game-dialog__eyebrow">Partida em andamento</div>
            <DialogTitle className="text-center text-2xl font-black">Sair da partida?</DialogTitle>
            <DialogDescription className="text-center text-white/65">
              Se você sair agora, vai{" "}
              <span className="font-black text-[#ff596d]">perder R$ {stake}</span> da sua aposta. A
              partida será marcada como derrota.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="game-dialog__actions grid grid-cols-2 gap-2 sm:grid-cols-2">
            <Button className="game-dialog__continue" onClick={() => setConfirmExit(false)}>
              Continuar jogando
            </Button>
            <Button className="game-dialog__leave" onClick={confirmForfeit}>
              Sair e perder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrientationPopup({ orientation }: { orientation: DeviceOrientation }) {
  const ready = orientation === "landscape";
  return (
    <div className={`orientation-popup ${ready ? "is-ready" : "is-portrait"}`} role="status">
      <div className="orientation-popup__backdrop" />
      <section className="orientation-popup__card">
        <img src="/game/ui/orientation-phone.png" alt="" />
        <div className="orientation-popup__eyebrow">Ajuste automático</div>
        <h2>{ready ? "TELA PRONTA!" : "GIRE O CELULAR"}</h2>
        <p>
          {ready
            ? "Modo paisagem identificado. A mesa será exibida por completo."
            : "Para jogar melhor e visualizar toda a mesa, use o celular deitado."}
        </p>
        <div className="orientation-popup__status">
          <i /> {ready ? "Paisagem identificada" : "Aguardando rotação"}
        </div>
      </section>
    </div>
  );
}

function InGameNotice({ notice }: { notice: GameNotice }) {
  const warning = notice.kind === "warning";
  return (
    <div className={`game-notice is-${notice.kind}`} role="status" aria-live="polite">
      <img src={warning ? "/game/ui/status-warning.png" : "/game/ui/status-turn.png"} alt="" />
      <div>
        <strong>{notice.title}</strong>
        <span>{notice.message}</span>
      </div>
      <i className="game-notice__timer" />
    </div>
  );
}

function MatchResultPopup({
  result,
  seconds,
  busy,
  onReplay,
  onHome,
}: {
  result: MatchResult;
  seconds: number;
  busy: boolean;
  onReplay: () => void;
  onHome: () => void;
}) {
  const won = result.outcome === "win";

  return (
    <div className={`result-popup ${won ? "is-win" : "is-loss"}`} role="dialog" aria-modal="true">
      <div className="result-popup__backdrop" />
      <section className="result-popup__card" aria-labelledby="match-result-title">
        <div className="result-popup__glow" aria-hidden />
        <img
          className="result-popup__emblem"
          src={won ? "/game/ui/result-win-v2.png" : "/game/ui/result-loss-v2.png"}
          alt=""
        />
        <div className="result-popup__eyebrow">Resultado da partida</div>
        <h2 id="match-result-title">{won ? "VOCÊ GANHOU!" : "NÃO FOI DESSA VEZ"}</h2>
        <p className="result-popup__message">
          {won
            ? "Você dominou a mesa e levou o prêmio."
            : "Boa partida. Prepare o taco para a revanche!"}
        </p>
        <div className="result-popup__amount">
          <span>{won ? "Prêmio recebido" : "Valor perdido"}</span>
          <strong>
            {won ? "+" : "−"} R$ {result.amount.toFixed(2).replace(".", ",")}
          </strong>
        </div>
        <div className="result-popup__actions">
          <button className="result-popup__primary" onClick={onReplay} disabled={busy}>
            {busy ? "Preparando..." : "Jogar novamente"}
          </button>
          <button className="result-popup__secondary" onClick={onHome} disabled={busy}>
            Voltar ao início
          </button>
        </div>
        <div className="result-popup__return">
          Voltando para as apostas em <strong>{seconds}s</strong>
          <i />
        </div>
      </section>
    </div>
  );
}

function MatchArenaHud({
  botName,
  theme,
  prize,
  seconds,
  ready,
  onExit,
}: {
  botName: string;
  theme: ArenaTheme;
  prize: number;
  seconds: number;
  ready: boolean;
  onExit: () => void;
}) {
  const timeClass = seconds <= 5 ? "is-danger" : seconds <= 10 ? "is-warning" : "is-normal";
  const themeLabel =
    theme === "london" ? "London Night" : theme === "vegas" ? "Vegas Neon" : "Ruby Arena";

  return (
    <section className={`arena-hud is-${theme}`} aria-label="Informações da partida">
      <div className={`arena-theme-badge is-${theme}`} aria-label={`Arena ${themeLabel}`}>
        <i /> {themeLabel}
      </div>
      <div className="arena-hud__inner">
        <button className="arena-exit" onClick={onExit} aria-label="Sair da partida">
          <X aria-hidden className="h-4 w-4" strokeWidth={3} />
        </button>

        <div className="arena-player arena-player--you">
          <div className="arena-player__portrait">
            <img src="/game/ui/player-avatar.png" alt="" className="arena-player__avatar" />
            <span className="arena-player__level">1</span>
          </div>
          <div className="arena-player__copy">
            <span className="arena-player__eyebrow">Jogador</span>
            <strong>VOCÊ</strong>
            <span className="arena-player__status">
              <i className={ready ? "is-online" : ""} /> {ready ? "Na mesa" : "Entrando"}
            </span>
          </div>
          <span className="arena-player__rail" aria-hidden />
        </div>

        <div className="arena-versus" aria-label="Contra">
          <span>8</span>
          <small>VS</small>
          <i aria-hidden />
        </div>

        <div className="arena-player arena-player--rival">
          <div className="arena-player__portrait">
            <img src="/game/ui/rival-avatar.png" alt="" className="arena-player__avatar" />
            <span className="arena-player__level">4</span>
          </div>
          <div className="arena-player__copy">
            <span className="arena-player__eyebrow">Oponente</span>
            <strong>{botName}</strong>
            <span className="arena-player__status">
              <i className={ready ? "is-online" : ""} /> {ready ? "Na mesa" : "Entrando"}
            </span>
          </div>
          <span className="arena-player__rail" aria-hidden />
        </div>

        <div className="arena-clock-stack">
          <div
            className={`arena-clock ${timeClass}`}
            aria-label={`${seconds} segundos para a tacada`}
          >
            <Clock3 aria-hidden className="h-3 w-3" />
            <strong>{ready ? String(seconds).padStart(2, "0") : "--"}</strong>
          </div>
          <div className="arena-prize">
            <span>Prêmio</span>
            <strong>R$ {prize.toFixed(0)}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlayNavItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition py-1"
    >
      {icon}
      <span className="text-[9px] font-black tracking-[0.15em] uppercase">{label}</span>
    </button>
  );
}
