// Sound + haptic feedback helpers. No external assets — uses Web Audio API.

function soundEnabled() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("bb.sound") !== "0";
}

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.15, delay = 0) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try { navigator.vibrate(pattern); } catch { /* noop */ }
}

export function playWin() {
  if (soundEnabled()) {
    tone(523.25, 0.15, "triangle", 0.18, 0);    // C5
    tone(659.25, 0.15, "triangle", 0.18, 0.12); // E5
    tone(783.99, 0.25, "triangle", 0.2, 0.24);  // G5
    tone(1046.5, 0.4, "triangle", 0.22, 0.4);   // C6
  }
  vibrate([60, 40, 120]);
}

export function playLoss() {
  if (soundEnabled()) {
    tone(220, 0.2, "sawtooth", 0.15, 0);
    tone(164.81, 0.4, "sawtooth", 0.15, 0.18);
  }
  vibrate(200);
}

export function playClick() {
  if (soundEnabled()) tone(800, 0.05, "square", 0.08);
  vibrate(15);
}

export function playReward() {
  if (soundEnabled()) {
    tone(880, 0.1, "sine", 0.18, 0);
    tone(1318.5, 0.2, "sine", 0.2, 0.1);
  }
  vibrate([30, 30, 30]);
}

export function playLevelUp() {
  if (soundEnabled()) {
    tone(523.25, 0.1, "triangle", 0.2, 0);
    tone(659.25, 0.1, "triangle", 0.2, 0.1);
    tone(783.99, 0.1, "triangle", 0.2, 0.2);
    tone(1046.5, 0.3, "triangle", 0.25, 0.3);
  }
  vibrate([40, 30, 40, 30, 80]);
}