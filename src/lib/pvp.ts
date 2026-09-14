// PvP helpers: serialize ball positions to/from the Phaser engine inside the iframe.

export type BallSnap = { i: number; x: number; y: number; a: 0 | 1 };
export type PvpState = { balls: BallSnap[]; cueInHand?: boolean };

export function getEngine(iframe: HTMLIFrameElement | null): any | null {
  try {
    const w = iframe?.contentWindow as any;
    if (!w?.playState?.gameInfo) return null;
    return w;
  } catch { return null; }
}

export function isReadyForInput(w: any): boolean {
  try {
    const info = w?.playState?.gameInfo;
    if (!info) return false;
    if (info.gameOver) return false;
    if (info.shotRunning || info.shotInProgress) return false;
    const balls = info.ballArray;
    if (Array.isArray(balls)) {
      const minV = Number(info.minVelocity ?? 2);
      if (balls.some((b: any) => Number(b?.velocity?.magnitude ?? 0) > minV)) return false;
    }
    return info.shotReset !== false;
  } catch { return false; }
}

export function isShotInProgress(w: any): boolean {
  try {
    const info = w?.playState?.gameInfo;
    if (!info) return false;
    if (info.shotRunning || info.shotInProgress) return true;
    const balls = info.ballArray;
    if (Array.isArray(balls)) {
      const minV = Number(info.minVelocity ?? 2);
      if (balls.some((b: any) => Number(b?.velocity?.magnitude ?? 0) > minV)) return true;
    }
    return false;
  } catch { return false; }
}

export function serializeBalls(w: any): PvpState {
  const info = w?.playState?.gameInfo;
  const balls = info?.ballArray ?? [];
  const snap: BallSnap[] = [];
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (!b?.position) continue;
    snap.push({
      i,
      x: Math.round(Number(b.position.x) || 0),
      y: Math.round(Number(b.position.y) || 0),
      a: b.active ? 1 : 0,
    });
  }
  return { balls: snap, cueInHand: !!info.cueBallInHand };
}

export function applyBalls(w: any, state: PvpState): void {
  try {
    const info = w?.playState?.gameInfo;
    if (!info || !Array.isArray(info.ballArray)) return;
    const V2D = (w as any).Vector2D;
    for (const s of state.balls) {
      const b = info.ballArray[s.i];
      if (!b) continue;
      if (V2D) {
        b.position = new V2D(s.x, s.y);
        b.velocity = new V2D(0, 0);
      } else if (b.position) {
        b.position.x = s.x; b.position.y = s.y;
        if (b.velocity) { b.velocity.x = 0; b.velocity.y = 0; b.velocity.magnitude = 0; }
      }
      b.active = s.a === 1;
      if (b.mc) b.mc.visible = b.active;
    }
    info.cueBallInHand = !!state.cueInHand;
    if (typeof w.renderScreen === "function") w.renderScreen();
  } catch {}
}

/** Force the local engine to think it's always p1's turn (the local user). */
export function forceLocalTurn(w: any): void {
  try {
    const info = w?.playState?.gameInfo;
    if (!info) return;
    info.turn = "p1";
    info.currentPlayer = "p1";
    info.gameRunning = true;
    info.shotRunning = false;
    info.shotComplete = false;
    info.rulingsApplied = false;
    info.ballPotted = false;
    info.fouled = false;
    info.scratched = false;
    info.shotReset = true;
    info.lockAim = false;
    info.preventAim = false;
    if (info.cueCanvas) { info.cueCanvas.alpha = 1; info.cueCanvas.visible = true; }
    if (info.turnArrow1) info.turnArrow1.frame = 1;
    if (info.turnArrow2) info.turnArrow2.frame = 0;
    if (typeof w.renderScreen === "function") w.renderScreen();
  } catch {}
}

/** Was the 8-ball pocketed (game over signal)? */
export function eightBallPocketed(w: any): boolean {
  try {
    const info = w?.playState?.gameInfo;
    const b8 = info?.ballArray?.[8];
    return !!b8 && b8.active === false;
  } catch { return false; }
}