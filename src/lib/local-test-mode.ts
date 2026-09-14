export const LOCAL_TEST_MODE = import.meta.env.VITE_LOCAL_TEST_MODE !== "false";

export const LOCAL_USER_ID = "local-player";
export const LOCAL_STORAGE_KEY = "black-ball:local-state";
export const LOCAL_CUE_STORAGE_KEY = "black-ball:cue-skin";
export const LOCAL_STATE_EVENT = "black-ball:local-state-changed";

export const LOCAL_USER = {
  id: LOCAL_USER_ID,
  email: "jogador@teste.local",
  aud: "authenticated",
  role: "authenticated",
  created_at: "2026-08-29T00:00:00.000Z",
  updated_at: "2026-08-29T00:00:00.000Z",
  app_metadata: { provider: "local", providers: ["local"] },
  user_metadata: { username: "Jogador Teste", local_test: true },
} as const;

export type LocalCueSlug = "starter" | "oak" | "crimson" | "emerald" | "obsidian" | "royal";

export type LocalCueSkin = {
  id: string;
  slug: LocalCueSlug;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  price: number;
  payout_multiplier: number;
  color: string;
  image_url: string;
  description: string;
  lore: string;
  active: boolean;
};

export const LOCAL_CUE_SKINS: LocalCueSkin[] = [
  {
    id: "cue-starter",
    slug: "starter",
    name: "Taco Iniciante",
    rarity: "common",
    price: 0,
    payout_multiplier: 1,
    color: "#9c7a45",
    image_url: "/game/assets/img/cues/starter.png",
    description: "Seu taco padrão. Sólido e confiável.",
    lore: "O primeiro taco de todo jogador. Simples, confiável e cheio de partidas memoráveis.",
    active: true,
  },
  {
    id: "cue-oak",
    slug: "oak",
    name: "Carvalho Clássico",
    rarity: "common",
    price: 10,
    payout_multiplier: 1.05,
    color: "#c08a4a",
    image_url: "/game/assets/img/cues/oak.png",
    description: "Madeira nobre com punho de couro.",
    lore: "Esculpido em carvalho centenário, conhecido por sua estabilidade e equilíbrio impecável.",
    active: true,
  },
  {
    id: "cue-crimson",
    slug: "crimson",
    name: "Crimson Edge",
    rarity: "rare",
    price: 20,
    payout_multiplier: 1.1,
    color: "#dc2626",
    image_url: "/game/assets/img/cues/crimson.png",
    description: "Vermelho intenso para tacadas agressivas.",
    lore: "Forjado para finais decisivas, sua ponta carmesim intimida antes mesmo da quebra.",
    active: true,
  },
  {
    id: "cue-emerald",
    slug: "emerald",
    name: "Esmeralda",
    rarity: "rare",
    price: 30,
    payout_multiplier: 1.15,
    color: "#10b981",
    image_url: "/game/assets/img/cues/emerald.png",
    description: "Detalhes verdes com acabamento de jade.",
    lore: "Inspirado nos campeões sul-americanos, brilha levemente sob a luz da mesa.",
    active: true,
  },
  {
    id: "cue-obsidian",
    slug: "obsidian",
    name: "Obsidiana",
    rarity: "epic",
    price: 40,
    payout_multiplier: 1.25,
    color: "#1f2937",
    image_url: "/game/assets/img/cues/obsidian.png",
    description: "Carbono escuro e equilíbrio cirúrgico.",
    lore: "Frio ao toque e preciso. Um taco feito para quem domina cada centímetro da mesa.",
    active: true,
  },
  {
    id: "cue-royal",
    slug: "royal",
    name: "Cetro Real",
    rarity: "legendary",
    price: 60,
    payout_multiplier: 1.5,
    color: "#f5c518",
    image_url: "/game/assets/img/cues/royal.png",
    description: "Acabamento dourado para os reis da mesa.",
    lore: "Um taco cerimonial banhado a ouro, reservado aos jogadores que não tremem na bola 8.",
    active: true,
  },
];

export type LocalProfile = {
  id: string;
  username: string;
  balance: number;
  xp: number;
  level: number;
  referral_code: string;
  referred_by: string | null;
  login_streak: number;
  last_login_date: string | null;
  last_seen_at: string;
  banned: boolean;
};

export type LocalTransaction = {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  created_at: string;
};

export type LocalMatch = {
  id: string;
  user_id: string;
  stake: number;
  payout: number;
  status: "active" | "won" | "lost" | "forfeit" | "cancelled";
  started_at: string;
  settled_at: string | null;
  skin_id: string | null;
};

export type LocalOwnedCue = {
  id: string;
  user_id: string;
  skin_id: string;
  equipped: boolean;
  acquired_at: string;
};

export type LocalGameState = {
  version: 1;
  profile: LocalProfile;
  transactions: LocalTransaction[];
  matches: LocalMatch[];
  activeMatch: LocalMatch | null;
  ownedCues: LocalOwnedCue[];
  dailyBonusClaimedAt: string | null;
  claimedMissions: string[];
};

const DEFAULT_DATE = "2026-08-29T00:00:00.000Z";

function defaultState(): LocalGameState {
  return {
    version: 1,
    profile: {
      id: LOCAL_USER_ID,
      username: "Jogador Teste",
      balance: 1000,
      xp: 0,
      level: 1,
      referral_code: "LOCAL8BALL",
      referred_by: null,
      login_streak: 1,
      last_login_date: null,
      last_seen_at: DEFAULT_DATE,
      banned: false,
    },
    transactions: [],
    matches: [],
    activeMatch: null,
    ownedCues: LOCAL_CUE_SKINS.map((skin) => ({
      id: `owned-${skin.slug}`,
      user_id: LOCAL_USER_ID,
      skin_id: skin.id,
      equipped: skin.slug === "starter",
      acquired_at: DEFAULT_DATE,
    })),
    dailyBonusClaimedAt: null,
    claimedMissions: [],
  };
}

function hasBrowserStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function cueFromStorage(): LocalCueSlug | null {
  if (!hasBrowserStorage()) return null;
  try {
    const value = window.localStorage.getItem(LOCAL_CUE_STORAGE_KEY) as LocalCueSlug | null;
    return LOCAL_CUE_SKINS.some((skin) => skin.slug === value) ? value : null;
  } catch {
    return null;
  }
}

function normalizeState(value: Partial<LocalGameState> | null): LocalGameState {
  const base = defaultState();
  const selectedCue = cueFromStorage();
  const state: LocalGameState = {
    ...base,
    ...value,
    version: 1,
    profile: { ...base.profile, ...(value?.profile ?? {}) },
    transactions: Array.isArray(value?.transactions) ? value.transactions : base.transactions,
    matches: Array.isArray(value?.matches) ? value.matches : base.matches,
    activeMatch: value?.activeMatch ?? null,
    claimedMissions: Array.isArray(value?.claimedMissions) ? value.claimedMissions : [],
    ownedCues: LOCAL_CUE_SKINS.map((skin) => {
      const stored = value?.ownedCues?.find((row) => row.skin_id === skin.id);
      return (
        stored ?? {
          id: `owned-${skin.slug}`,
          user_id: LOCAL_USER_ID,
          skin_id: skin.id,
          equipped: skin.slug === "starter",
          acquired_at: DEFAULT_DATE,
        }
      );
    }),
  };

  if (selectedCue) {
    state.ownedCues = state.ownedCues.map((row) => ({
      ...row,
      equipped: LOCAL_CUE_SKINS.find((skin) => skin.id === row.skin_id)?.slug === selectedCue,
    }));
  }

  if (!state.ownedCues.some((row) => row.equipped)) {
    state.ownedCues[0] = { ...state.ownedCues[0], equipped: true };
  }
  return state;
}

export function readLocalGameState(): LocalGameState {
  if (!hasBrowserStorage()) return defaultState();
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      const initial = defaultState();
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initial));
      window.localStorage.setItem(LOCAL_CUE_STORAGE_KEY, "starter");
      return initial;
    }
    return normalizeState(JSON.parse(raw) as Partial<LocalGameState>);
  } catch {
    return defaultState();
  }
}

export function writeLocalGameState(next: LocalGameState): LocalGameState {
  const normalized = normalizeState(next);
  if (hasBrowserStorage()) {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent(LOCAL_STATE_EVENT, { detail: normalized }));
    } catch {
      // Alguns navegadores podem bloquear o armazenamento local.
    }
  }
  return normalized;
}

export function updateLocalGameState(
  updater: (current: LocalGameState) => LocalGameState,
): LocalGameState {
  return writeLocalGameState(updater(readLocalGameState()));
}

function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function addTransaction(
  state: LocalGameState,
  type: string,
  amount: number,
  description: string,
): LocalTransaction {
  const transaction: LocalTransaction = {
    id: makeId("tx"),
    user_id: LOCAL_USER_ID,
    type,
    amount: Math.round(amount * 100) / 100,
    balance_after: Math.round(state.profile.balance * 100) / 100,
    description,
    created_at: new Date().toISOString(),
  };
  state.transactions = [transaction, ...state.transactions].slice(0, 100);
  return transaction;
}

export function applyLocalWallet(
  type: "deposit" | "withdraw" | "refund",
  amount: number,
  description?: string,
): LocalTransaction {
  const safeAmount = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) throw new Error("Valor inválido");
  let result: LocalTransaction | null = null;
  updateLocalGameState((state) => {
    if (type === "withdraw" && state.profile.balance < safeAmount) {
      throw new Error("Saldo insuficiente");
    }
    state.profile.balance =
      Math.round((state.profile.balance + (type === "withdraw" ? -safeAmount : safeAmount)) * 100) /
      100;
    result = addTransaction(
      state,
      type,
      safeAmount,
      description ??
        (type === "deposit"
          ? "Crédito de teste"
          : type === "refund"
            ? "Reembolso"
            : "Saque de teste"),
    );
    return state;
  });
  return result!;
}

export function startLocalMatch(stake: number): LocalMatch {
  const safeStake = Math.round(Number(stake) * 100) / 100;
  if (!Number.isFinite(safeStake) || safeStake <= 0) throw new Error("Aposta inválida");
  let created: LocalMatch | null = null;
  updateLocalGameState((state) => {
    if (state.activeMatch) return state;
    if (state.profile.balance < safeStake) throw new Error("Saldo insuficiente");
    state.profile.balance = Math.round((state.profile.balance - safeStake) * 100) / 100;
    addTransaction(state, "bet", safeStake, "Aposta em partida local");
    const cue = getLocalCueSlug();
    created = {
      id: makeId("match"),
      user_id: LOCAL_USER_ID,
      stake: safeStake,
      payout: 0,
      status: "active",
      started_at: new Date().toISOString(),
      settled_at: null,
      skin_id: LOCAL_CUE_SKINS.find((skin) => skin.slug === cue)?.id ?? null,
    };
    state.activeMatch = created;
    return state;
  });
  if (!created) {
    const active = readLocalGameState().activeMatch;
    if (active) return active;
    throw new Error("Não foi possível iniciar a partida");
  }
  return created;
}

export function settleLocalMatch(matchId: string, won: boolean, forfeit = false): LocalMatch {
  let settled: LocalMatch | null = null;
  updateLocalGameState((state) => {
    const active = state.activeMatch;
    if (!active || active.id !== matchId) throw new Error("Partida local não encontrada");
    const payout = won ? Math.round(active.stake * 2 * 100) / 100 : 0;
    if (payout > 0) {
      state.profile.balance = Math.round((state.profile.balance + payout) * 100) / 100;
      addTransaction(state, "win", payout, `Vitória local #${active.id.slice(-7)}`);
    }
    const xpGain = won ? 60 : 20;
    state.profile.xp += xpGain;
    state.profile.level = Math.max(1, Math.floor(Math.sqrt(state.profile.xp / 100)) + 1);
    settled = {
      ...active,
      payout,
      status: won ? "won" : forfeit ? "forfeit" : "lost",
      settled_at: new Date().toISOString(),
    };
    state.matches = [settled, ...state.matches].slice(0, 100);
    state.activeMatch = null;
    return state;
  });
  return settled!;
}

export function refundLocalMatch(
  matchId: string,
  description = "Reembolso de partida local",
): LocalMatch | null {
  let cancelled: LocalMatch | null = null;
  updateLocalGameState((state) => {
    const active = state.activeMatch;
    if (!active || active.id !== matchId) return state;
    state.profile.balance = Math.round((state.profile.balance + active.stake) * 100) / 100;
    addTransaction(state, "refund", active.stake, description);
    cancelled = {
      ...active,
      payout: active.stake,
      status: "cancelled",
      settled_at: new Date().toISOString(),
    };
    state.matches = [cancelled, ...state.matches].slice(0, 100);
    state.activeMatch = null;
    return state;
  });
  return cancelled;
}

export function getLocalCueSlug(): LocalCueSlug {
  const fromStorage = cueFromStorage();
  if (fromStorage) return fromStorage;
  const state = readLocalGameState();
  const equipped = state.ownedCues.find((row) => row.equipped);
  return LOCAL_CUE_SKINS.find((skin) => skin.id === equipped?.skin_id)?.slug ?? "starter";
}

export function equipLocalCue(skinIdOrSlug: string): LocalCueSkin {
  const skin = LOCAL_CUE_SKINS.find(
    (item) => item.id === skinIdOrSlug || item.slug === skinIdOrSlug,
  );
  if (!skin) throw new Error("Taco não encontrado");
  updateLocalGameState((state) => {
    state.ownedCues = state.ownedCues.map((row) => ({ ...row, equipped: row.skin_id === skin.id }));
    return state;
  });
  if (hasBrowserStorage()) {
    try {
      window.localStorage.setItem(LOCAL_CUE_STORAGE_KEY, skin.slug);
    } catch {
      // A seleção continua válida em memória quando o storage está indisponível.
    }
  }
  return skin;
}

export function updateLocalProfile(values: Partial<LocalProfile>): LocalProfile {
  let profile = readLocalGameState().profile;
  updateLocalGameState((state) => {
    state.profile = { ...state.profile, ...values, id: LOCAL_USER_ID };
    profile = state.profile;
    return state;
  });
  return profile;
}

export function resetLocalGameState(): LocalGameState {
  const initial = defaultState();
  if (hasBrowserStorage()) {
    try {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      window.localStorage.setItem(LOCAL_CUE_STORAGE_KEY, "starter");
    } catch {
      // A redefinição ainda retorna o estado inicial em memória.
    }
  }
  return writeLocalGameState(initial);
}

export function subscribeLocalGameState(listener: (state: LocalGameState) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onChange = () => listener(readLocalGameState());
  window.addEventListener(LOCAL_STATE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LOCAL_STATE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
