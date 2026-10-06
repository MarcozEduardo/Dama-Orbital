// ─────────────────────────────────────────────────────────────
//  PULSO ÚNICO · um só canal para TUDO
//
//  Mover, selecionar, digitar, mandar rádio, desistir e sair são
//  a MESMA coisa: "o que este jogador está fazendo agora".
//
//  Cada jogador mantém um único nó `pulse/{uid}` e um único
//  listener escuta todos. Sem canais paralelos, sem guard que
//  segure sinal, sem caminho privilegiado.
//
//  Conflito se resolve por `at` (timestamp em ms): o pulso mais
//  recente é o mais verdadeiro.
// ─────────────────────────────────────────────────────────────
import { onValue, ref, set, update } from "firebase/database";
import { prepareRemoteDatabase } from "./firebase";
import type { MoveRecord, Unsubscribe } from "./types";

export type PulseAction =
  | "idle"
  | "selecting"
  | "moving"
  | "typing"
  | "surrendering"
  | "surrendered"
  | "left";

export interface Pulse {
  uid: string;
  /** milissegundos: o maior vence qualquer disputa */
  at: number;
  side: 1 | 2 | 0;
  nick: string;

  /** o que estou fazendo neste instante */
  action: PulseAction;

  /** peça na mão + rotas que estou enxergando */
  pick: [number, number] | null;
  options: [number, number][];
  caps: [number, number][];

  /**
   * Prévia lógica de UM salto. O rival usa isto somente para reproduzir
   * a animação; o state autoritativo continua sendo gravado no fim do turno.
   */
  moveId: number;
  moveBoard: string;
  moveTurn: 1 | 2;
  moveFrom: [number, number] | null;
  moveTo: [number, number] | null;
  moveJump: [number, number] | null;
  moveDeferFinal: boolean;

  /** aviso com prazo (nome, rádio ou desistência) */
  typingKind: "nick" | "radio" | "surrender" | null;
  typingUntil: number;

  /** rádio */
  radioId: number;
  radioText: string;

  /** estado do jogo publicado por este jogador */
  seq: number;
  board: string;
  turn: 1 | 2;
  lastMove: MoveRecord | null;
  winner: 1 | 2 | null;
  surrendered: 1 | 2 | null;
}

export const EMPTY_PULSE: Omit<Pulse, "uid" | "at"> = {
  side: 0,
  nick: "",
  action: "idle",
  pick: null,
  options: [],
  caps: [],
  moveId: 0,
  moveBoard: "",
  moveTurn: 1,
  moveFrom: null,
  moveTo: null,
  moveJump: null,
  moveDeferFinal: false,
  typingKind: null,
  typingUntil: 0,
  radioId: 0,
  radioText: "",
  seq: 0,
  board: "",
  turn: 1,
  lastMove: null,
  winner: null,
  surrendered: null,
};

export function resetPulse() {
  /* nada a limpar: cada pulso é enviado completo */
}

/**
 * Atualiza o meu pulso. Qualquer ação do jogador passa por aqui —
 * é literalmente a mesma função para selecionar, mover ou desistir.
 */
export async function pushPulse(matchId: string, patch: Partial<Pulse>): Promise<void> {
  const { database, user } = await prepareRemoteDatabase();
  // Sempre parte do vazio: nunca herda pick/radio de uma ação anterior.
  const pulse: Pulse = {
    ...EMPTY_PULSE,
    ...patch,
    uid: user.uid,
    at: Date.now(),
  } as Pulse;
  await set(ref(database, `matches/${matchId}/pulse/${user.uid}`), pulse);
}

/** Marca saída explícita. Usado pelos sensores de fechamento. */
export async function pushLeave(matchId: string, side: 1 | 2) {
  await pushPulse(matchId, { action: "left", side });
}

/**
 * Escuta o pulso de TODOS. Um listener, um caminho, tudo instantâneo.
 * Devolve sempre o pulso mais recente de cada jogador que não sou eu.
 */
export function subscribePulses(
  matchId: string,
  myUid: string,
  listener: (rival: Pulse | null, all: Pulse[]) => void,
): Unsubscribe {
  let active = true;
  let unsubscribe: Unsubscribe = () => undefined;

  void prepareRemoteDatabase()
    .then(({ database }) => {
      if (!active) return;
      unsubscribe = onValue(ref(database, `matches/${matchId}/pulse`), (snapshot) => {
        if (!active) return;
        const raw = (snapshot.val() || {}) as Record<string, Pulse>;
        const all = Object.values(raw).filter(Boolean);
        const others = all.filter((p) => p.uid !== myUid).sort((a, b) => b.at - a.at);
        listener(others[0] || null, all);
      });
    })
    .catch(() => undefined);

  return () => {
    active = false;
    unsubscribe();
  };
}

/** Espelha o resultado no documento oficial (para quem entrar depois). */
export async function mirrorToState(
  matchId: string,
  snapshot: { board: string; turn: 1 | 2; seq: number; winner: 1 | 2 | null; surrendered: 1 | 2 | null },
) {
  const { database } = await prepareRemoteDatabase();
  await update(ref(database, `matches/${matchId}`), {
    updatedAt: Date.now(),
    "state/board": snapshot.board,
    "state/turn": snapshot.turn,
    "state/seq": snapshot.seq,
    "state/winner": snapshot.winner,
    "state/surrendered": snapshot.surrendered,
    ...(snapshot.winner ? { status: "finished" } : {}),
  });
}
