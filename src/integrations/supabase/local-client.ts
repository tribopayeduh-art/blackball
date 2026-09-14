/* eslint-disable @typescript-eslint/no-explicit-any -- o adaptador local replica a API dinâmica do cliente Supabase */
import {
  LOCAL_CUE_SKINS,
  LOCAL_USER,
  LOCAL_USER_ID,
  applyLocalWallet,
  equipLocalCue,
  readLocalGameState,
  refundLocalMatch,
  settleLocalMatch,
  startLocalMatch,
  updateLocalGameState,
  updateLocalProfile,
} from "@/lib/local-test-mode";

type Filter =
  | { kind: "eq"; column: string; value: unknown }
  | { kind: "neq"; column: string; value: unknown }
  | { kind: "in"; column: string; value: unknown[] };

type Operation = "select" | "insert" | "update" | "upsert" | "delete";

function valueAt(row: Record<string, unknown>, column: string): unknown {
  return column.split(".").reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[key];
  }, row);
}

function rowsForTable(table: string): Record<string, unknown>[] {
  const state = readLocalGameState();
  switch (table) {
    case "profiles":
      return [state.profile as unknown as Record<string, unknown>];
    case "wallet_transactions":
      return state.transactions as unknown as Record<string, unknown>[];
    case "matches":
      return [state.activeMatch, ...state.matches].filter(Boolean) as unknown as Record<
        string,
        unknown
      >[];
    case "cue_skins":
      return LOCAL_CUE_SKINS as unknown as Record<string, unknown>[];
    case "user_cues":
      return state.ownedCues.map((row) => ({
        ...row,
        cue_skins: LOCAL_CUE_SKINS.find((skin) => skin.id === row.skin_id) ?? null,
      }));
    case "notifications":
    case "friendships":
    case "chat_messages":
    case "pvp_matches":
    case "pix_deposits":
    case "admin_audit_log":
      return [];
    default:
      return [];
  }
}

function matchesFilters(row: Record<string, unknown>, filters: Filter[]): boolean {
  return filters.every((filter) => {
    const current = valueAt(row, filter.column);
    if (filter.kind === "eq") return current === filter.value;
    if (filter.kind === "neq") return current !== filter.value;
    return filter.value.includes(current);
  });
}

function createQueryBuilder(table: string) {
  let operation: Operation = "select";
  let payload: unknown = null;
  const filters: Filter[] = [];
  let orderBy: { column: string; ascending: boolean } | null = null;
  let rowLimit: number | null = null;
  let head = false;

  const execute = async (single = false) => {
    let affected: Record<string, unknown>[] | null = null;

    if ((operation === "insert" || operation === "upsert") && table === "profiles") {
      const first = Array.isArray(payload) ? payload[0] : payload;
      if (first && typeof first === "object") {
        affected = [
          updateLocalProfile(first as Record<string, unknown>) as unknown as Record<
            string,
            unknown
          >,
        ];
      }
    } else if (operation === "update" && table === "profiles") {
      const values =
        payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
      affected = [updateLocalProfile(values) as unknown as Record<string, unknown>];
    } else if (operation === "update" && table === "user_cues") {
      const row = rowsForTable(table).find((item) => matchesFilters(item, filters));
      if (row?.skin_id && (payload as Record<string, unknown> | null)?.equipped === true) {
        equipLocalCue(String(row.skin_id));
      }
      affected = row ? [row] : [];
    } else if (operation === "delete") {
      affected = [];
    } else if (operation === "insert" || operation === "upsert" || operation === "update") {
      affected = (Array.isArray(payload) ? payload : payload ? [payload] : []) as Record<
        string,
        unknown
      >[];
    }

    let rows = affected ?? rowsForTable(table);
    rows = rows.filter((row) => matchesFilters(row, filters));
    if (orderBy) {
      const { column, ascending } = orderBy;
      rows = [...rows].sort((a, b) => {
        const av = valueAt(a, column);
        const bv = valueAt(b, column);
        if (av === bv) return 0;
        return (av ?? "") > (bv ?? "") ? (ascending ? 1 : -1) : ascending ? -1 : 1;
      });
    }
    if (rowLimit !== null) rows = rows.slice(0, rowLimit);
    return {
      data: head ? null : single ? (rows[0] ?? null) : rows,
      error: null,
      count: rows.length,
      status: 200,
      statusText: "OK",
    };
  };

  const builder: any = {
    select(_columns?: string, options?: { head?: boolean }) {
      if (operation === "select") operation = "select";
      head = options?.head === true;
      return builder;
    },
    insert(values: unknown) {
      operation = "insert";
      payload = values;
      return builder;
    },
    upsert(values: unknown) {
      operation = "upsert";
      payload = values;
      return builder;
    },
    update(values: unknown) {
      operation = "update";
      payload = values;
      return builder;
    },
    delete() {
      operation = "delete";
      return builder;
    },
    eq(column: string, value: unknown) {
      filters.push({ kind: "eq", column, value });
      return builder;
    },
    neq(column: string, value: unknown) {
      filters.push({ kind: "neq", column, value });
      return builder;
    },
    in(column: string, value: unknown[]) {
      filters.push({ kind: "in", column, value });
      return builder;
    },
    is(column: string, value: unknown) {
      filters.push({ kind: "eq", column, value });
      return builder;
    },
    or(_expression: string) {
      // As tabelas sociais locais começam vazias; manter a cadeia é suficiente.
      return builder;
    },
    order(column: string, options?: { ascending?: boolean }) {
      orderBy = { column, ascending: options?.ascending !== false };
      return builder;
    },
    limit(value: number) {
      rowLimit = value;
      return builder;
    },
    range(from: number, to: number) {
      const previousLimit = rowLimit;
      rowLimit = to - from + 1;
      void previousLimit;
      return builder;
    },
    maybeSingle() {
      return execute(true);
    },
    single() {
      return execute(true);
    },
    then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
      return execute(false).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

function dailyMissions() {
  const state = readLocalGameState();
  const settled = state.matches.filter((match) => match.status !== "active");
  const wagered = settled.reduce((sum, match) => sum + match.stake, 0);
  const won = settled.filter((match) => match.status === "won").length;
  return [
    {
      id: "local-mission-play",
      kind: "play",
      target: 3,
      progress: settled.length,
      reward: 3,
      claimed: state.claimedMissions.includes("local-mission-play"),
    },
    {
      id: "local-mission-win",
      kind: "win",
      target: 1,
      progress: won,
      reward: 5,
      claimed: state.claimedMissions.includes("local-mission-win"),
    },
    {
      id: "local-mission-wager",
      kind: "wager",
      target: 50,
      progress: wagered,
      reward: 7,
      claimed: state.claimedMissions.includes("local-mission-wager"),
    },
  ];
}

function cueStats() {
  const state = readLocalGameState();
  return LOCAL_CUE_SKINS.map((skin) => {
    const matches = state.matches.filter((match) => match.skin_id === skin.id);
    return {
      skin_id: skin.id,
      total_wins: matches.filter((match) => match.status === "won").length,
      total_profit: matches.reduce(
        (sum, match) => sum + (match.status === "won" ? match.payout - match.stake : -match.stake),
        0,
      ),
    };
  });
}

function claimMission(id: string) {
  const mission = dailyMissions().find((item) => item.id === id);
  if (!mission) return { data: null, error: { message: "Missão não encontrada" } };
  if (mission.claimed) return { data: mission, error: null };
  if (mission.progress < mission.target)
    return { data: null, error: { message: "Missão ainda não concluída" } };
  updateLocalGameState((state) => {
    state.claimedMissions = [...new Set([...state.claimedMissions, id])];
    return state;
  });
  applyLocalWallet("deposit", mission.reward, "Recompensa de missão local");
  return { data: { ...mission, claimed: true }, error: null };
}

function rpc(name: string, args: Record<string, any> = {}) {
  try {
    switch (name) {
      case "has_role":
        return Promise.resolve({ data: false, error: null });
      case "touch_last_seen":
        updateLocalProfile({ last_seen_at: new Date().toISOString() });
        return Promise.resolve({ data: null, error: null });
      case "current_active_match":
        return Promise.resolve({ data: readLocalGameState().activeMatch, error: null });
      case "match_start":
        return Promise.resolve({ data: startLocalMatch(Number(args._stake)), error: null });
      case "match_settle":
        return Promise.resolve({
          data: settleLocalMatch(
            String(args._match_id),
            Boolean(args._won),
            Boolean(args._forfeit),
          ),
          error: null,
        });
      case "wallet_apply":
        return Promise.resolve({
          data: applyLocalWallet(args._type, Number(args._amount), args._description),
          error: null,
        });
      case "purchase_cue":
        return Promise.resolve({
          data: { skin_id: String(args._skin_id), unlocked_for_test: true },
          error: null,
        });
      case "equip_cue":
        return Promise.resolve({ data: equipLocalCue(String(args._skin_id)), error: null });
      case "cue_skin_stats":
        return Promise.resolve({ data: cueStats(), error: null });
      case "ensure_daily_missions":
        return Promise.resolve({ data: dailyMissions(), error: null });
      case "weekly_leaderboard": {
        const profile = readLocalGameState().profile;
        const wins = readLocalGameState().matches.filter((match) => match.status === "won").length;
        return Promise.resolve({
          data: [
            {
              user_id: LOCAL_USER_ID,
              username: profile.username,
              wins,
              profit: 0,
              level: profile.level,
            },
          ],
          error: null,
        });
      }
      case "claim_mission":
        return Promise.resolve(claimMission(String(args._mission_id)));
      case "online_players":
      case "live_pvp_matches":
        return Promise.resolve({ data: [], error: null });
      case "apply_referral_code":
        return Promise.resolve({ data: { applied: false, local_mode: true }, error: null });
      case "pvp_create_invite":
      case "pvp_accept_invite":
      case "pvp_decline_invite":
      case "pvp_submit_turn":
      case "pvp_heartbeat":
      case "pvp_settle":
        return Promise.resolve({
          data: null,
          error: { message: "Multiplayer indisponível no modo local sem banco de dados." },
        });
      case "match_refund":
        return Promise.resolve({ data: refundLocalMatch(String(args._match_id)), error: null });
      default:
        return Promise.resolve({ data: [], error: null });
    }
  } catch (error) {
    return Promise.resolve({
      data: null,
      error: { message: error instanceof Error ? error.message : "Erro no modo local" },
    });
  }
}

const localSession = {
  access_token: "local-test-token",
  refresh_token: "local-test-refresh-token",
  expires_in: 31_536_000,
  expires_at: 4_102_444_800,
  token_type: "bearer",
  user: LOCAL_USER,
};

function createChannel(name: string) {
  const channel: any = {
    topic: name,
    on() {
      return channel;
    },
    subscribe(callback?: (status: string) => void) {
      Promise.resolve().then(() => callback?.("SUBSCRIBED"));
      return channel;
    },
    unsubscribe() {
      return Promise.resolve("ok");
    },
    send() {
      return Promise.resolve("ok");
    },
  };
  return channel;
}

export function createLocalSupabaseClient() {
  return {
    auth: {
      onAuthStateChange(callback: (event: string, session: typeof localSession) => void) {
        Promise.resolve().then(() => callback("SIGNED_IN", localSession));
        return { data: { subscription: { unsubscribe() {} } } };
      },
      getSession: () => Promise.resolve({ data: { session: localSession }, error: null }),
      getUser: () => Promise.resolve({ data: { user: LOCAL_USER }, error: null }),
      signInWithPassword: () =>
        Promise.resolve({ data: { user: LOCAL_USER, session: localSession }, error: null }),
      signUp: () =>
        Promise.resolve({ data: { user: LOCAL_USER, session: localSession }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      resetPasswordForEmail: () => Promise.resolve({ data: {}, error: null }),
    },
    from: (table: string) => createQueryBuilder(table),
    rpc,
    channel: createChannel,
    removeChannel: () => Promise.resolve("ok"),
    removeAllChannels: () => Promise.resolve([]),
    getChannels: () => [],
    functions: {
      invoke: () =>
        Promise.resolve({
          data: null,
          error: { message: "Funções externas desativadas no modo local." },
        }),
    },
  };
}
