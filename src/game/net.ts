// ─────────────────────────────────────────────────────────────
//  REDE · "Chave Diplomática"
//
//  Transporte em cadeia de fallback, do mais rápido ao mais teimoso:
//    1. BroadcastChannel  → instantâneo entre abas/janelas
//    2. evento 'storage'  → funciona onde BroadcastChannel não existe
//    3. polling 400ms     → última linha de defesa, sempre funciona
//
//  A sala inteira vive em localStorage sob `damas-room-{CHAVE}`, com um
//  formato propositalmente próximo de um documento Firestore. Trocar por
//  Firebase é reimplementar `readRoom`/`writeRoom` e assinar onSnapshot —
//  o resto do jogo não muda.
//
//  ⚠️ Hoje isto conecta abas do MESMO navegador. Para dois aparelhos de
//  verdade, seguir docs/MULTIPLAYER-HANDOFF.md: Firebase RTDB mantém
//  sala/estado/presença e funciona como fallback quente; WebRTC/Trystero
//  vira o canal direto. Não confundir este protótipo com rede pública.
// ─────────────────────────────────────────────────────────────

// Infraestrutura remota preparada para a próxima integração. Os exports
// atuais abaixo continuam alimentando o protótipo local sem credenciais.
export * from "./network";
import { firebaseReadiness } from "../config/firebase";

export type Seat = "host" | "guest" | "observer";

export interface RoomPlayer {
  device: string;
  nick: string;
  at: number;
}

export interface RoomState {
  /** tabuleiro serializado em 64 chars */
  board: string;
  turn: 1 | 2;
  /** contador de lances: resolve conflito de ordem */
  seq: number;
  lastMove: { from: [number, number]; to: [number, number]; jumps: [number, number][] } | null;
  winner: 1 | 2 | null;
  surrendered: 1 | 2 | null;
}

export interface Room {
  key: string;
  createdAt: number;
  host: RoomPlayer;
  guest: RoomPlayer | null;
  observers: RoomPlayer[];
  state: RoomState;
  /** rádio: mensagens curtas entre os jogadores */
  radio: { id: number; from: Seat; nick: string; text: string; at: number }[];
  updatedAt: number;
}

const ROOM_PREFIX = "damas-room-";
const DEVICE_KEY = "damas-device-id";
const NICK_KEY = "damas-nick";

/** alfabeto sem 0/O/1/I/L pra ninguém errar ditando por telefone */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** identidade do APARELHO: compartilhada por todas as abas.
 *  É isto que impede alguém de entrar na própria sala como oponente. */
export function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = Array.from({ length: 12 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function getNick(fallback = ""): string {
  return localStorage.getItem(NICK_KEY) || fallback;
}
export function setNick(n: string) {
  localStorage.setItem(NICK_KEY, n.slice(0, 14));
}

/** Chave curta e legível. Verifica colisão antes de devolver. */
export function generateKey(): string {
  for (let tentativa = 0; tentativa < 40; tentativa++) {
    const k = Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
    if (!localStorage.getItem(ROOM_PREFIX + k)) return k;
  }
  // praticamente impossível chegar aqui (31^6 ≈ 887 milhões)
  return "BOBBY" + Math.floor(Math.random() * 9);
}

export function normalizeKey(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .slice(0, 6);
}

export function readRoom(key: string): Room | null {
  try {
    const raw = localStorage.getItem(ROOM_PREFIX + key);
    return raw ? (JSON.parse(raw) as Room) : null;
  } catch {
    return null;
  }
}

function writeRoom(room: Room) {
  room.updatedAt = Date.now();
  try {
    localStorage.setItem(ROOM_PREFIX + room.key, JSON.stringify(room));
  } catch {
    /* quota: a sala segue só em memória nesta aba */
  }
  channels.get(room.key)?.postMessage({ t: "sync", at: room.updatedAt });
}

const channels = new Map<string, BroadcastChannel>();
function channelFor(key: string): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  let ch = channels.get(key);
  if (!ch) {
    try {
      ch = new BroadcastChannel("damas-" + key);
      channels.set(key, ch);
    } catch {
      return null;
    }
  }
  return ch;
}

// ── serialização do tabuleiro (64 chars, ~200 bytes por lance) ──
const CH: Record<string, string> = { "1p": "b", "1k": "B", "2p": "s", "2k": "S" };

export function encodeBoard(board: ({ player: 1 | 2; king: boolean } | null)[][]): string {
  let out = "";
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      out += p ? CH[`${p.player}${p.king ? "k" : "p"}`] : ".";
    }
  return out;
}

export function decodeBoard(s: string): ({ player: 1 | 2; king: boolean } | null)[][] {
  const out: ({ player: 1 | 2; king: boolean } | null)[][] = [];
  for (let r = 0; r < 8; r++) {
    const row: ({ player: 1 | 2; king: boolean } | null)[] = [];
    for (let c = 0; c < 8; c++) {
      const ch = s[r * 8 + c] ?? ".";
      row.push(
        ch === "." ? null : { player: ch === "b" || ch === "B" ? 1 : 2, king: ch === "B" || ch === "S" },
      );
    }
    out.push(row);
  }
  return out;
}

export const EMPTY_STATE: RoomState = {
  board: "",
  turn: 1,
  seq: 0,
  lastMove: null,
  winner: null,
  surrendered: null,
};

export interface JoinResult {
  ok: boolean;
  seat?: Seat;
  room?: Room;
  error?: "nao-existe" | "mesmo-aparelho" | "chave-invalida";
}

/** Cria a sala e senta como anfitrião (P1 · Aliança Bobby). */
export function hostRoom(nick: string, initialBoard: string): Room {
  const key = generateKey();
  const room: Room = {
    key,
    createdAt: Date.now(),
    host: { device: deviceId(), nick: nick || "ALIANÇA BOBBY", at: Date.now() },
    guest: null,
    observers: [],
    state: { ...EMPTY_STATE, board: initialBoard },
    radio: [],
    updatedAt: Date.now(),
  };
  writeRoom(room);
  return room;
}

/**
 * Entra numa sala existente.
 * Regra do Marcão: 1º = anfitrião, 2º = oponente, do 3º em diante = OBSERVADOR.
 * E o mesmo aparelho jamais senta na cadeira de oponente da própria sala.
 */
export function joinRoom(key: string, nick: string): JoinResult {
  if (key.length !== 6) return { ok: false, error: "chave-invalida" };
  const room = readRoom(key);
  if (!room) return { ok: false, error: "nao-existe" };

  const me = deviceId();
  if (room.host.device === me) return { ok: false, error: "mesmo-aparelho" };

  if (room.guest?.device === me) return { ok: true, seat: "guest", room };

  if (!room.guest) {
    room.guest = { device: me, nick: nick || "COMANDANTE", at: Date.now() };
    writeRoom(room);
    return { ok: true, seat: "guest", room };
  }

  // cadeiras ocupadas → observador
  if (!room.observers.some((o) => o.device === me)) {
    room.observers.push({ device: me, nick: nick || "OBSERVADOR", at: Date.now() });
    writeRoom(room);
  }
  return { ok: true, seat: "observer", room };
}

/** Observa uma sala sem tentar sentar como jogador. */
export function watchRoom(key: string, nick: string): JoinResult {
  if (key.length !== 6) return { ok: false, error: "chave-invalida" };
  const room = readRoom(key);
  if (!room) return { ok: false, error: "nao-existe" };
  const me = deviceId();
  if (room.host.device === me) return { ok: false, error: "mesmo-aparelho" };

  // Não existe partida para observar com apenas uma pessoa. Quem chega
  // primeiro ocupa P2; se já era P2, recupera a própria cadeira.
  if (!room.guest || room.guest.device === me) return joinRoom(key, nick);

  if (!room.observers.some((o) => o.device === me)) {
    room.observers.push({ device: me, nick: nick || "OBSERVADOR", at: Date.now() });
    writeRoom(room);
  }
  return { ok: true, seat: "observer", room };
}

export function pushState(key: string, patch: Partial<RoomState>) {
  const room = readRoom(key);
  if (!room) return;
  room.state = { ...room.state, ...patch };
  writeRoom(room);
}

export function pushNick(key: string, seat: Seat, nick: string) {
  const room = readRoom(key);
  if (!room) return;
  if (seat === "host") room.host.nick = nick;
  else if (seat === "guest" && room.guest) room.guest.nick = nick;
  writeRoom(room);
}

export function pushRadio(key: string, seat: Seat, nick: string, text: string) {
  const room = readRoom(key);
  if (!room) return;
  room.radio = [...room.radio.slice(-9), { id: Date.now(), from: seat, nick, text, at: Date.now() }];
  writeRoom(room);
}

/**
 * Assina mudanças da sala pelos 3 caminhos ao mesmo tempo.
 * Devolve a função de cancelamento.
 */
export function subscribeRoom(key: string, cb: (room: Room) => void): () => void {
  let lastSeen = 0;
  const emit = () => {
    const room = readRoom(key);
    if (room && room.updatedAt !== lastSeen) {
      lastSeen = room.updatedAt;
      cb(room);
    }
  };

  // 1. BroadcastChannel
  const ch = channelFor(key);
  const onMsg = () => emit();
  ch?.addEventListener("message", onMsg);

  // 2. evento storage (outras abas)
  const onStorage = (e: StorageEvent) => {
    if (e.key === ROOM_PREFIX + key) emit();
  };
  window.addEventListener("storage", onStorage);

  // 3. polling teimoso
  const timer = window.setInterval(emit, 400);

  emit();
  return () => {
    ch?.removeEventListener("message", onMsg);
    window.removeEventListener("storage", onStorage);
    clearInterval(timer);
  };
}

/** Diagnóstico mostrado na tela de conexão. */
export function transportInfo(): { name: string; ok: boolean }[] {
  let bc = false;
  try {
    bc = typeof BroadcastChannel !== "undefined";
  } catch {
    bc = false;
  }
  let ls = false;
  try {
    localStorage.setItem("damas-probe", "1");
    localStorage.removeItem("damas-probe");
    ls = true;
  } catch {
    ls = false;
  }
  const firebaseReady = firebaseReadiness().configured;
  return [
    { name: "CANAL LOCAL", ok: bc },
    { name: "MEMÓRIA LOCAL", ok: ls },
    { name: firebaseReady ? "FIREBASE PRONTO" : "FIREBASE PENDENTE", ok: firebaseReady },
  ];
}
