## Objetivo

Implementar partidas reais 1v1 online entre amigos, com turnos sincronizados via Realtime, pote dobrado (5% de taxa da casa) e tolerância a queda de conexão (pausa até 2 min).

## Banco de dados (Supabase)

Nova tabela `pvp_matches`:
- `host_id`, `guest_id` (uuid → profiles)
- `stake` (numeric), `pot` (stake*2), `fee_pct` (default 0.05)
- `status`: `pending` | `active` | `finished` | `cancelled` | `expired`
- `turn_user_id` (de quem é a vez), `turn_started_at`
- `winner_id`, `loser_id`
- `host_balls_remaining`, `guest_balls_remaining` (8/9 ball state)
- `last_state` jsonb (posições das bolas após última tacada)
- `host_seen_at`, `guest_seen_at` (heartbeat reconexão)
- timestamps

RPCs (security definer):
- `pvp_create_invite(_guest_id uuid, _stake numeric)` — cria `pending`, debita stake do host.
- `pvp_accept_invite(_match_id uuid)` — debita stake do guest, marca `active`, sorteia quem começa.
- `pvp_decline_invite(_match_id uuid)` — devolve stake ao host.
- `pvp_submit_turn(_match_id uuid, _state jsonb, _potted int[], _foul bool)` — valida que é a vez do user, atualiza `last_state`, decide próximo turno (se enca­çapou e não foi falta, mantém; senão passa), atualiza contagem.
- `pvp_settle(_match_id uuid, _winner uuid)` — credita pote (menos 5%) ao vencedor, fecha partida, registra wallet_tx, XP/missões.
- `pvp_heartbeat(_match_id uuid)` — atualiza `*_seen_at`.
- `pvp_claim_walkover(_match_id uuid)` — se oponente sem heartbeat > 120s, declara vitória.

RLS: jogadores só leem/escrevem em partidas onde são host ou guest. Realtime habilitado em `pvp_matches`.

## Frontend

### Convite (`src/routes/social.tsx`)
- Botão "Desafiar" já existe. Trocar a lógica para chamar `pvp_create_invite` e enviar no chat um card com `match_id`.
- Recipient vê "Aceitar" / "Recusar" → chama RPC e navega para `/play?pvp=<match_id>`.

### Sala PvP (`src/routes/play.tsx`)
- Detectar query `?pvp=<id>` → entrar em modo PvP em vez de PvE.
- Assinar canal Realtime `pvp:<match_id>`:
  - on `postgres_changes` UPDATE → aplicar `last_state` no engine se foi tacada do oponente.
- Heartbeat a cada 10s via `pvp_heartbeat`.
- UI:
  - Header com avatares dos 2 jogadores, pote (R$ stake*2), bolas restantes.
  - Indicador "Sua vez" / "Vez do oponente" + shot clock 30s (já existe, reaproveitar).
  - Quando é vez do oponente: input bloqueado; mesa renderiza estado recebido.
  - Banner "Oponente desconectado — aguardando reconexão (Xs)" + botão "Reivindicar vitória" após 120s.
- Após tacada local: serializar posições das bolas + bolas enca­çapadas + foul, chamar `pvp_submit_turn`.
- Detectar fim de jogo (8 enca­çapada legalmente) → `pvp_settle`.

### Helper
- `src/lib/pvp.functions.ts` — wrappers tipados das RPCs (chamadas direto do client via `supabase.rpc` é suficiente; sem necessidade de serverFn).

## Detalhes técnicos

- Serialização de estado: array `[{id, x, y, pocketed}]` extraído de `playState.gameInfo.ballArray`.
- Aplicar estado remoto: setar `position` e `active` de cada ball, zerar `velocity`, marcar turno.
- Pote: `pot = stake*2`, vencedor recebe `pot * 0.95`, 5% vai pra casa (registrado em `wallet_transactions` como `fee`).
- Reconexão: ao montar `/play?pvp=`, se status `active` e user é participante, reassina canal e renderiza último `last_state`.
- Timeout shot clock: se expira na vez do jogador local, auto-submit turno como "foul/pass".

## Fora de escopo (não vou fazer agora)

- Matchmaking aleatório (só convite direto entre amigos).
- Espectadores.
- Replay/histórico visual da partida PvP.
- Validação anti-cheat server-side da física (confiamos no client; mitigação via reputação/ban manual no admin).

## Arquivos afetados

- Migração nova (tabela + RPCs + RLS + realtime).
- `src/routes/social.tsx` — trocar fluxo do convite.
- `src/routes/play.tsx` — modo PvP, realtime, sincronização.
- `src/lib/pvp.ts` (novo) — helpers de serialização/aplicação de estado.