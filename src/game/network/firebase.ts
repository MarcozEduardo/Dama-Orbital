import {
  get,
  onChildAdded,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
  type Database,
} from "firebase/database";
import { ensureFirebaseSession } from "../../config/firebase";
import type { Player } from "../engine";
import { hashMatchState } from "./hash";
import type {
  ChannelStatus,
  CommitResult,
  ConnectionIdentity,
  EventChannel,
  MatchEvent,
  MatchSeat,
  MatchStateSnapshot,
  RemoteMatch,
  RemotePlayer,
  Unsubscribe,
} from "./types";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const WAITING_TTL = 15 * 60 * 1000;
const MATCH_TTL = 2 * 60 * 60 * 1000;
const TURN_MS = 30_000;

export type JoinIntent = "play" | "observe";

export interface RemoteMatchProbe {
  code: string;
  matchId: string;
  uid: string;
  match: RemoteMatch;
}

export interface RemoteRadioMessage {
  id: string;
  uid: string;
  nick: string;
  text: string;
  createdAt: number;
}

export class RemoteMatchError extends Error {
  constructor(
    public readonly code:
      | "NOT_CONFIGURED"
      | "NOT_FOUND"
      | "EXPIRED"
      | "SAME_USER"
      | "RESERVATION_FAILED"
      | "AUTH_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "RemoteMatchError";
  }
}

function randomCode() {
  return Array.from(
    { length: 6 },
    () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)],
  ).join("");
}

function cleanNick(nick: string, fallback: string) {
  const cleaned = nick.replace(/[<>\n\r]/g, "").trim().slice(0, 14);
  return cleaned || fallback;
}

async function serverNow(database: Database) {
  try {
    const snapshot = await get(ref(database, ".info/serverTimeOffset"));
    return Date.now() + (Number(snapshot.val()) || 0);
  } catch {
    return Date.now();
  }
}

function player(uid: string, nick: string, now: number): RemotePlayer {
  return { uid, nick, joinedAt: now, lastSeen: now };
}

function normalizeState(raw: Partial<MatchStateSnapshot> | undefined): MatchStateSnapshot {
  const board = raw?.board || "";
  const turn = raw?.turn === 2 ? 2 : 1;
  const seq = Number(raw?.seq) || 0;
  return {
    board,
    turn,
    seq,
    lastMove: raw?.lastMove ?? null,
    winner: raw?.winner === 1 || raw?.winner === 2 ? raw.winner : null,
    surrendered:
      raw?.surrendered === 1 || raw?.surrendered === 2 ? raw.surrendered : null,
    deadlineAt: Number(raw?.deadlineAt) || 0,
    selected: raw?.selected ?? null,
    stateHash: raw?.stateHash ||
      hashMatchState({ board, turn, seq, winner: raw?.winner, surrendered: raw?.surrendered }),
    lastEventId: raw?.lastEventId || null,
  };
}

function normalizeMatch(raw: RemoteMatch): RemoteMatch {
  return {
    ...raw,
    observers: raw.observers || {},
    state: normalizeState(raw.state),
  };
}

async function reserveCode(database: Database, matchId: string, uid: string, now: number) {
  for (let attempt = 0; attempt < 64; attempt++) {
    const code = randomCode();
    const result = await runTransaction(
      ref(database, `keys/${code}`),
      (current) =>
        current === null
          ? {
              matchId,
              ownerUid: uid,
              createdAt: now,
              expiresAt: now + MATCH_TTL,
              status: "reserved",
            }
          : undefined,
      { applyLocally: false },
    );
    if (result.committed) return code;
  }
  throw new RemoteMatchError(
    "RESERVATION_FAILED",
    "Não foi possível reservar uma Chave Diplomática única.",
  );
}

export async function createRemoteMatch(
  nick: string,
  initialBoard: string,
): Promise<ConnectionIdentity> {
  const { database, user } = await ensureFirebaseSession();
  const now = await serverNow(database);
  const matchId = push(ref(database, "matches")).key;
  if (!matchId) {
    throw new RemoteMatchError("RESERVATION_FAILED", "O Firebase não gerou um ID de partida.");
  }

  const code = await reserveCode(database, matchId, user.uid, now);
  const state: MatchStateSnapshot = {
    board: initialBoard,
    turn: 1,
    seq: 0,
    lastMove: null,
    winner: null,
    surrendered: null,
    deadlineAt: 0,
    stateHash: hashMatchState({ board: initialBoard, turn: 1, seq: 0 }),
    lastEventId: null,
  };
  const match: RemoteMatch = {
    version: 1,
    code,
    status: "waiting",
    createdAt: now,
    expiresAt: now + WAITING_TTL,
    updatedAt: now,
    players: {
      p1: player(user.uid, cleanNick(nick, "ALIANÇA BOBBY"), now),
    },
    observers: {},
    state,
  };

  try {
    await set(ref(database, `matches/${matchId}`), match);
    await update(ref(database), {
      [`keys/${code}/status`]: "waiting",
      [`keys/${code}/matchId`]: matchId,
    });
  } catch (error) {
    // A chave permanece como tombstone para cumprir a regra de não reutilização.
    await update(ref(database, `keys/${code}`), { status: "failed" }).catch(() => undefined);
    throw error;
  }

  await attachPresence(matchId, "host");
  return { matchId, code, uid: user.uid, seat: "host", match };
}

export async function joinRemoteMatch(
  rawCode: string,
  nick: string,
  _intent: JoinIntent = "play",
): Promise<ConnectionIdentity> {
  const code = rawCode.trim().toUpperCase();
  const { database, user } = await ensureFirebaseSession();
  const now = await serverNow(database);
  const keySnapshot = await get(ref(database, `keys/${code}`));
  const keyData = keySnapshot.val() as { matchId?: string; expiresAt?: number } | null;
  if (!keyData?.matchId) {
    throw new RemoteMatchError("NOT_FOUND", "Chave Diplomática não encontrada.");
  }

  const matchRef = ref(database, `matches/${keyData.matchId}`);
  const initialSnapshot = await get(matchRef);
  if (!initialSnapshot.exists()) {
    throw new RemoteMatchError("NOT_FOUND", "Partida não encontrada.");
  }
  const initial = normalizeMatch(initialSnapshot.val() as RemoteMatch);
  if (initial.status === "finished" || initial.status === "expired" || initial.expiresAt < now) {
    throw new RemoteMatchError("EXPIRED", "Esta partida já terminou ou expirou.");
  }
  if (initial.players.p1.uid === user.uid) {
    throw new RemoteMatchError(
      "SAME_USER",
      "Essa chave foi gerada neste navegador. Abra o QR em outro aparelho.",
    );
  }

  let seat: MatchSeat = "observer";
  // Claim atômico apenas da cadeira P2. Isso deixa as Security Rules
  // estreitas e impede dois convidados de sentarem ao mesmo tempo.
  const p2Result = await runTransaction(
    ref(database, `matches/${keyData.matchId}/players/p2`),
    (current: RemotePlayer | null) => {
      if (current?.uid === user.uid) return current;
      if (current !== null) return undefined;
      return player(user.uid, cleanNick(nick, "COMANDANTE"), now);
    },
    { applyLocally: false },
  );

  if (p2Result.committed && (p2Result.snapshot.val() as RemotePlayer | null)?.uid === user.uid) {
    seat = "guest";
    await update(matchRef, {
      status: "playing",
      expiresAt: now + MATCH_TTL,
      updatedAt: now,
      "state/deadlineAt": now + TURN_MS,
    });
  } else {
    await set(
      ref(database, `matches/${keyData.matchId}/observers/${user.uid}`),
      player(user.uid, cleanNick(nick, "OBSERVADOR"), now),
    );
    seat = "observer";
  }

  const finalSnapshot = await get(matchRef);
  const match = normalizeMatch(finalSnapshot.val() as RemoteMatch);

  await attachPresence(keyData.matchId, seat);
  return { matchId: keyData.matchId, code, uid: user.uid, seat, match };
}

/**
 * Valida Auth, chave e sala sem ocupar P2. Usado pela janela especial do QR:
 * a luz fica verde antes do OK, mas o host só inicia quando o usuário confirma.
 */
export async function probeRemoteMatch(rawCode: string): Promise<RemoteMatchProbe> {
  const code = rawCode.trim().toUpperCase();
  const { database, user } = await ensureFirebaseSession();
  const now = await serverNow(database);
  const keySnapshot = await get(ref(database, `keys/${code}`));
  const keyData = keySnapshot.val() as { matchId?: string } | null;
  if (!keyData?.matchId) {
    throw new RemoteMatchError("NOT_FOUND", "Chave Diplomática não encontrada.");
  }

  const matchSnapshot = await get(ref(database, `matches/${keyData.matchId}`));
  if (!matchSnapshot.exists()) {
    throw new RemoteMatchError("NOT_FOUND", "Partida não encontrada.");
  }
  const match = normalizeMatch(matchSnapshot.val() as RemoteMatch);
  if (match.status === "finished" || match.status === "expired" || match.expiresAt < now) {
    throw new RemoteMatchError("EXPIRED", "Esta partida já terminou ou expirou.");
  }
  if (match.players.p1.uid === user.uid) {
    throw new RemoteMatchError(
      "SAME_USER",
      "Essa chave foi gerada neste navegador. Abra o QR em outro aparelho.",
    );
  }
  return { code, matchId: keyData.matchId, uid: user.uid, match };
}

export function subscribeRemoteMatch(
  matchId: string,
  listener: (match: RemoteMatch | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  let active = true;
  let unsubscribe: Unsubscribe = () => undefined;
  void prepareRemoteDatabase()
    .then(({ database }) => {
      if (!active) return;
      unsubscribe = onValue(
        ref(database, `matches/${matchId}`),
        (snapshot) => {
          if (!active) return;
          listener(snapshot.exists() ? normalizeMatch(snapshot.val() as RemoteMatch) : null);
        },
        (error) => onError?.(error),
      );
    })
    .catch((error: unknown) => {
      if (active) onError?.(error instanceof Error ? error : new Error(String(error)));
    });
  return () => {
    active = false;
    unsubscribe();
  };
}

export async function prepareRemoteDatabase() {
  return ensureFirebaseSession();
}

export async function attachPresence(matchId: string, seat: MatchSeat): Promise<Unsubscribe> {
  const { database, user } = await prepareRemoteDatabase();
  const connectionId = push(ref(database, `presence/${matchId}/${user.uid}`)).key;
  if (!connectionId) return () => undefined;

  const connectionRef = ref(database, `presence/${matchId}/${user.uid}/${connectionId}`);
  const lastSeenRef = ref(database, `presenceMeta/${matchId}/${user.uid}/lastSeen`);

  // Nunca declarar vencedor no onDisconnect: celular bloqueado, troca de
  // rede e suspensão do navegador também derrubam o socket temporariamente.
  // O servidor limpa somente a presença; a janela de 5 minutos decide abandono.
  await onDisconnect(connectionRef).remove();
  await onDisconnect(lastSeenRef).set(serverTimestamp());
  await set(connectionRef, { seat, connectedAt: serverTimestamp() });
  await set(lastSeenRef, serverTimestamp());

  return () => {
    void remove(connectionRef);
  };
}

export async function commitRemoteState(
  matchId: string,
  actorUid: string,
  expectedSeq: number,
  nextState: Omit<MatchStateSnapshot, "seq" | "stateHash" | "lastEventId">,
  eventId: string,
): Promise<CommitResult> {
  const { database } = await prepareRemoteDatabase();
  let rejection: CommitResult["reason"];
  const matchRef = ref(database, `matches/${matchId}`);
  const matchSnapshot = await get(matchRef);
  if (!matchSnapshot.exists()) return { committed: false, reason: "missing" };
  const match = normalizeMatch(matchSnapshot.val() as RemoteMatch);
  if (match.status !== "playing") return { committed: false, reason: "match-closed", state: match.state };
  const seat = match.players.p1.uid === actorUid ? 1 : match.players.p2?.uid === actorUid ? 2 : 0;
  if (!seat) return { committed: false, reason: "not-player", state: match.state };

  const result = await runTransaction(
    ref(database, `matches/${matchId}/state`),
    (current: MatchStateSnapshot | null) => {
      if (!current) {
        rejection = "missing";
        return undefined;
      }
      if (current.seq !== expectedSeq) {
        rejection = "stale-seq";
        return undefined;
      }
      if (current.turn !== seat) {
        rejection = "wrong-turn";
        return undefined;
      }

      const seq = expectedSeq + 1;
      const state: MatchStateSnapshot = {
        ...nextState,
        seq,
        lastEventId: eventId,
        stateHash: hashMatchState({
          board: nextState.board,
          turn: nextState.turn,
          seq,
          winner: nextState.winner,
          surrendered: nextState.surrendered,
        }),
      };
      return state;
    },
    { applyLocally: false },
  );

  if (!result.committed) {
    const latest = await get(ref(database, `matches/${matchId}/state`));
    return {
      committed: false,
      reason: rejection || "stale-seq",
      state: latest.exists() ? normalizeState(latest.val() as MatchStateSnapshot) : match.state,
    };
  }
  const state = normalizeState(result.snapshot.val() as MatchStateSnapshot);
  await update(matchRef, {
    updatedAt: Date.now(),
    ...(state.winner ? { status: "finished" } : {}),
  });
  return { committed: true, state };
}

/**
 * Qualquer um dos dois jogadores pode confirmar que o deadline expirou.
 * A transação no state garante que apenas um cliente troca o turno.
 * Isso continua funcionando quando o celular da vez está com a tela suspensa.
 */
export async function commitRemoteTimeout(
  matchId: string,
  expectedSeq: number,
): Promise<CommitResult> {
  const { database, user } = await prepareRemoteDatabase();
  const matchSnapshot = await get(ref(database, `matches/${matchId}`));
  if (!matchSnapshot.exists()) return { committed: false, reason: "missing" };

  const match = normalizeMatch(matchSnapshot.val() as RemoteMatch);
  const isPlayer = match.players.p1.uid === user.uid || match.players.p2?.uid === user.uid;
  if (!isPlayer) return { committed: false, reason: "not-player", state: match.state };
  if (match.status !== "playing") return { committed: false, reason: "match-closed", state: match.state };
  const now = await serverNow(database);

  const result = await runTransaction(
    ref(database, `matches/${matchId}/state`),
    (current: MatchStateSnapshot | null) => {
      if (!current || current.winner || current.seq !== expectedSeq) return undefined;
      if (!current.deadlineAt || current.deadlineAt > now) return undefined;

      const seq = current.seq + 1;
      const turn: Player = current.turn === 1 ? 2 : 1;
      return {
        ...current,
        seq,
        turn,
        selected: null,
        lastMove: null,
        deadlineAt: now + TURN_MS,
        stateHash: hashMatchState({
          board: current.board,
          turn,
          seq,
          winner: null,
          surrendered: current.surrendered,
        }),
        lastEventId: `timeout-${seq}`,
      };
    },
    { applyLocally: false },
  );

  if (!result.committed) {
    const latest = await get(ref(database, `matches/${matchId}/state`));
    return {
      committed: false,
      reason: "stale-seq",
      state: latest.exists() ? normalizeState(latest.val() as MatchStateSnapshot) : match.state,
    };
  }

  const state = normalizeState(result.snapshot.val() as MatchStateSnapshot);
  await update(ref(database, `matches/${matchId}`), { updatedAt: now }).catch(() => undefined);
  return { committed: true, state };
}

/** Acrescenta ao deadline o período de uma interação de 15s. */
export async function extendRemoteDeadline(matchId: string, busyUntil: number) {
  const { database } = await prepareRemoteDatabase();
  const now = await serverNow(database);
  await runTransaction(
    ref(database, `matches/${matchId}/state`),
    (current: MatchStateSnapshot | null) => {
      if (!current || current.winner || busyUntil <= now) return current;
      const remaining = Math.max(0, (current.deadlineAt || now) - now);
      return {
        ...current,
        deadlineAt: Math.max(current.deadlineAt || 0, busyUntil + remaining),
      };
    },
    { applyLocally: false },
  );
}

/** Observa quem está de fato conectado na sala. */
export function subscribeRemotePresence(
  matchId: string,
  listener: (uids: string[]) => void,
): Unsubscribe {
  let active = true;
  let unsubscribe: Unsubscribe = () => undefined;
  void prepareRemoteDatabase()
    .then(({ database }) => {
      if (!active) return;
      unsubscribe = onValue(ref(database, `presence/${matchId}`), (snapshot) => {
        if (!active) return;
        const raw = (snapshot.val() || {}) as Record<string, Record<string, unknown>>;
        listener(Object.keys(raw).filter((uid) => Object.keys(raw[uid] || {}).length > 0));
      });
    })
    .catch(() => undefined);
  return () => {
    active = false;
    unsubscribe();
  };
}

/**
 * Encerra a partida declarando vencedor.
 * TRANSAÇÃO: o primeiro a gravar vence. O segundo lê o resultado já feito.
 * Isso impede que os dois clientes se declarem vencedores.
 */
export async function declareRemoteWinner(
  matchId: string,
  winner: 1 | 2,
  reason: string,
): Promise<1 | 2 | null> {
  const { database } = await prepareRemoteDatabase();
  const result = await runTransaction(
    ref(database, `matches/${matchId}/state/winner`),
    (current: 1 | 2 | null) => (current === null || current === undefined ? winner : undefined),
    { applyLocally: false },
  );

  const official = (result.snapshot.val() as 1 | 2 | null) ?? null;
  if (result.committed) {
    await update(ref(database, `matches/${matchId}`), {
      status: "finished",
      updatedAt: Date.now(),
      "state/endReason": reason,
    }).catch(() => undefined);
  }
  return official;
}

export interface LiveSignal {
  uid: string;
  /** peça selecionada agora */
  pick: [number, number] | null;
  /** destinos possíveis, calculados por quem selecionou */
  options: [number, number][];
  /** capturas entre os destinos */
  caps: [number, number][];
  at: number;
}

/**
 * Eco ao vivo: seleção e rotas. Vive em `live/{matchId}/{uid}`, FORA do
 * state versionado — assim nenhum guard de seq pode segurá-lo.
 */
export async function pushLiveSignal(
  matchId: string,
  pick: [number, number] | null,
  options: [number, number][] = [],
  caps: [number, number][] = [],
) {
  const { database, user } = await prepareRemoteDatabase();
  await set(ref(database, `live/${matchId}/${user.uid}`), {
    uid: user.uid,
    pick,
    options,
    caps,
    at: Date.now(),
  } satisfies LiveSignal);
}

/** Escuta os sinais ao vivo do adversário. Listener separado e minúsculo. */
export function subscribeLiveSignals(
  matchId: string,
  myUid: string,
  listener: (signal: LiveSignal | null) => void,
): Unsubscribe {
  let active = true;
  let unsubscribe: Unsubscribe = () => undefined;
  void prepareRemoteDatabase()
    .then(({ database }) => {
      if (!active) return;
      unsubscribe = onValue(ref(database, `live/${matchId}`), (snapshot) => {
        if (!active) return;
        const all = (snapshot.val() || {}) as Record<string, LiveSignal>;
        const rival = Object.values(all).find((sig) => sig && sig.uid !== myUid);
        listener(rival?.pick ? rival : null);
      });
    })
    .catch(() => undefined);
  return () => {
    active = false;
    unsubscribe();
  };
}

/** Aviso de "estou digitando/pensando" com prazo. Pausa o relógio dos dois. */
/** Heartbeat: prova de vida gravada periodicamente. */
export async function beatRemotePresence(matchId: string) {
  const { database, user } = await prepareRemoteDatabase();
  await set(ref(database, `presenceMeta/${matchId}/${user.uid}/lastSeen`), Date.now());
}

/** Última prova de vida do adversário (sensor C). */
export function subscribeRemoteHeartbeat(
  matchId: string,
  rivalUid: string,
  listener: (lastSeen: number) => void,
): Unsubscribe {
  let active = true;
  let unsubscribe: Unsubscribe = () => undefined;
  void prepareRemoteDatabase()
    .then(({ database }) => {
      if (!active) return;
      unsubscribe = onValue(ref(database, `presenceMeta/${matchId}/${rivalUid}/lastSeen`), (snap) => {
        if (active) listener(Number(snap.val()) || 0);
      });
    })
    .catch(() => undefined);
  return () => {
    active = false;
    unsubscribe();
  };
}

export async function pushRemoteTyping(
  matchId: string,
  kind: "nick" | "radio" | "surrender" | null,
  who: string,
) {
  const { database, user } = await prepareRemoteDatabase();
  await set(
    ref(database, `matches/${matchId}/typing`),
    kind ? { kind, who, uid: user.uid, until: Date.now() + 15_000 } : null,
  );
}

/** Rendição publicada sem depender do turno (o turno pode virar enquanto decide). */
/**
 * ETAPA 1 · levanta a bandeira. NÃO define vencedor ainda.
 * Sem isso o listener veria `winner` e pularia direto para a tela final,
 * engolindo toda a animação de rendição.
 */
export async function declareRemoteSurrender(matchId: string, loser: 1 | 2) {
  const { database } = await prepareRemoteDatabase();
  const result = await runTransaction(
    ref(database, `matches/${matchId}/state`),
    (current: MatchStateSnapshot | null) => {
      if (!current) return undefined;
      if (current.winner || current.surrendered) return undefined;
      return { ...current, surrendered: loser };
    },
    { applyLocally: false },
  );
  return result.committed;
}

/**
 * ETAPA 2 · o espetáculo acabou dos dois lados: agora sim, vencedor.
 * Chamada só por quem se rendeu, depois que a barragem termina.
 */
export async function finishRemoteSurrender(matchId: string, loser: 1 | 2, finalBoard: string) {
  const { database } = await prepareRemoteDatabase();
  const result = await runTransaction(
    ref(database, `matches/${matchId}/state`),
    (current: MatchStateSnapshot | null) => {
      if (!current || current.winner) return undefined;
      return {
        ...current,
        seq: (Number(current.seq) || 0) + 1,
        board: finalBoard,
        surrendered: loser,
        winner: loser === 1 ? 2 : 1,
      };
    },
    { applyLocally: false },
  );
  if (result.committed) {
    await update(ref(database, `matches/${matchId}`), {
      status: "finished",
      updatedAt: Date.now(),
    }).catch(() => undefined);
  }
  return result.committed;
}

export async function updateRemoteNick(matchId: string, seat: MatchSeat, nick: string) {
  if (seat === "observer") return;
  const { database, user } = await prepareRemoteDatabase();
  const slot = seat === "host" ? "p1" : "p2";
  const playerRef = ref(database, `matches/${matchId}/players/${slot}`);
  const snapshot = await get(playerRef);
  const current = snapshot.val() as RemotePlayer | null;
  if (!current || current.uid !== user.uid) return;
  await update(playerRef, { nick: cleanNick(nick, current.nick), lastSeen: Date.now() });
}

export async function sendRemoteRadio(matchId: string, nick: string, text: string) {
  const { database, user } = await prepareRemoteDatabase();
  const messageRef = push(ref(database, `matches/${matchId}/radio`));
  if (!messageRef.key) throw new Error("Não foi possível gerar o ID da mensagem.");
  const message: RemoteRadioMessage = {
    id: messageRef.key,
    uid: user.uid,
    nick: cleanNick(nick, "COMANDANTE"),
    text: text.trim().slice(0, 40),
    createdAt: Date.now(),
  };
  await set(messageRef, message);
  return message;
}

export function subscribeRemoteRadio(
  matchId: string,
  listener: (message: RemoteRadioMessage) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  let active = true;
  let unsubscribe: Unsubscribe = () => undefined;
  // Ignora histórico antigo quando o jogador volta para a partida.
  const openedAt = Date.now() - 10_000;

  void prepareRemoteDatabase()
    .then(({ database }) => {
      if (!active) return;
      unsubscribe = onChildAdded(
        ref(database, `matches/${matchId}/radio`),
        (snapshot) => {
          const raw = snapshot.val() as Omit<RemoteRadioMessage, "id"> | null;
          if (!active || !raw || Number(raw.createdAt) < openedAt) return;
          listener({ ...raw, id: snapshot.key || String(raw.createdAt) });
        },
        (error) => onError?.(error),
      );
    })
    .catch((error: unknown) => {
      if (active) onError?.(error instanceof Error ? error : new Error(String(error)));
    });

  return () => {
    active = false;
    unsubscribe();
  };
}

export class FirebaseEventChannel implements EventChannel {
  readonly name = "firebase-rtdb";
  private listeners = new Set<(event: MatchEvent) => void>();
  private statusListeners = new Set<(status: ChannelStatus) => void>();
  private cleanups: Unsubscribe[] = [];
  private database: Database | null = null;
  private status: ChannelStatus = {
    state: "CONNECTING",
    peers: 0,
    latencyMs: null,
    detail: "Inicializando Firebase",
  };

  constructor(private readonly matchId: string) {}

  async connect() {
    const { database } = await prepareRemoteDatabase();
    this.database = database;

    this.cleanups.push(
      onValue(ref(database, ".info/connected"), (snapshot) => {
        this.setStatus(
          snapshot.val() === true
            ? { state: "DATABASE", peers: 0, latencyMs: null, detail: "RTDB conectada" }
            : { state: "RECONNECTING", peers: 0, latencyMs: null, detail: "RTDB reconectando" },
        );
      }),
    );
    this.cleanups.push(
      onChildAdded(ref(database, `matches/${this.matchId}/events`), (snapshot) => {
        const event = snapshot.val() as MatchEvent | null;
        if (!event?.eventId) return;
        this.listeners.forEach((listener) => listener(event));
      }),
    );
  }

  async send(event: MatchEvent) {
    if (!this.database) await this.connect();
    await set(ref(this.database!, `matches/${this.matchId}/events/${event.eventId}`), event);
  }

  subscribe(listener: (event: MatchEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeStatus(listener: (status: ChannelStatus) => void) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  close() {
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
    this.listeners.clear();
    this.statusListeners.clear();
    this.status = { state: "CLOSED", peers: 0, latencyMs: null };
  }

  private setStatus(status: ChannelStatus) {
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }
}