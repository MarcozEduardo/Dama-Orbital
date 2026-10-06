// ─────────────────────────────────────────────────────────────
//  IA · motor único, dois usos:
//   1. OBSERVADOR SILENCIOSO — avalia se uma facção está de fato
//      liquidada (e só então oferece rendição automática)
//   2. MODO MÁQUINA — escolhe o lance menos arriscado
//
//  Regra de ouro do Marcos: NÃO bagunçar o jogo.
//  Toda avaliação é feita em cópias do tabuleiro; nada aqui muta
//  estado de jogo. E a rendição automática exige provas pesadas.
// ─────────────────────────────────────────────────────────────
import {
  allMoves,
  cloneBoard,
  countPieces,
  movesFrom,
  type BoardState,
  type Move,
  type Player,
  type Pos,
} from "./engine";

const other = (p: Player): Player => (p === 1 ? 2 : 1);

/** aplica um lance completo (com toda a cadeia obrigatória) numa cópia */
export function applyFull(board: BoardState, from: Pos, move: Move): BoardState {
  let b = cloneBoard(board);
  let cur = from;
  let mv = move;
  for (;;) {
    const piece = b[cur.r][cur.c];
    if (!piece) break;
    b[cur.r][cur.c] = null;
    b[mv.to.r][mv.to.c] = piece;
    if (mv.jump) b[mv.jump.r][mv.jump.c] = null;

    if (!piece.king && ((piece.player === 1 && mv.to.r === 0) || (piece.player === 2 && mv.to.r === 7))) {
      piece.king = true;
      break; // coroou: a cadeia para
    }
    if (!mv.jump) break;
    const nexts = movesFrom(b, mv.to.r, mv.to.c, true);
    if (!nexts.length) break;
    // na simulação seguimos a cadeia mais gorda
    let best = nexts[0];
    let bestGain = -1;
    for (const n of nexts) {
      const gain = chainDepth(b, { r: mv.to.r, c: mv.to.c }, n, 0);
      if (gain > bestGain) {
        bestGain = gain;
        best = n;
      }
    }
    cur = { r: mv.to.r, c: mv.to.c };
    mv = best;
    b = cloneBoard(b);
  }
  return b;
}

/** quantas peças essa cadeia come no total */
function chainDepth(board: BoardState, from: Pos, move: Move, depth: number): number {
  if (depth > 6) return depth;
  const b = cloneBoard(board);
  const piece = b[from.r][from.c];
  if (!piece || !move.jump) return depth;
  b[from.r][from.c] = null;
  b[move.to.r][move.to.c] = piece;
  b[move.jump.r][move.jump.c] = null;
  const crowned = !piece.king && ((piece.player === 1 && move.to.r === 0) || (piece.player === 2 && move.to.r === 7));
  if (crowned) return depth + 1;
  const nexts = movesFrom(b, move.to.r, move.to.c, true);
  if (!nexts.length) return depth + 1;
  let best = depth + 1;
  for (const n of nexts) best = Math.max(best, chainDepth(b, { r: move.to.r, c: move.to.c }, n, depth + 1));
  return best;
}

/** quantas peças o adversário come na melhor resposta dele */
function bestOpponentGain(board: BoardState, opp: Player): number {
  let worst = 0;
  for (const { from, move } of allMoves(board, opp)) {
    if (!move.jump) continue;
    worst = Math.max(worst, chainDepth(board, from, move, 0));
  }
  return worst;
}

// ── AVALIAÇÃO POSICIONAL ─────────────────────────────────────
const KING_VALUE = 3.4;
const PAWN_VALUE = 1;

/** placar da posição do ponto de vista de `me` (positivo = bom pra mim) */
export function evaluate(board: BoardState, me: Player): number {
  let score = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const sign = p.player === me ? 1 : -1;
      let v = p.king ? KING_VALUE : PAWN_VALUE;

      if (!p.king) {
        // avanço rumo à coroação
        const adv = p.player === 1 ? 7 - r : r;
        v += adv * 0.09;
        // quase lá: vale muito
        if (adv >= 5) v += 0.28;
      }
      // centro é mais seguro que a borda
      const centro = 3.5 - Math.max(Math.abs(3.5 - c), Math.abs(3.5 - r));
      v += centro * 0.045;
      // encostado na parede lateral: não pode ser capturado por ali
      if (c === 0 || c === 7) v += 0.16;
      // guarda a última fileira: impede coroação inimiga
      if ((p.player === 1 && r === 7) || (p.player === 2 && r === 0)) v += 0.2;

      score += sign * v;
    }
  return score;
}

// ── BUSCA (minimax com poda alfa-beta) ───────────────────────
function search(board: BoardState, me: Player, turn: Player, depth: number, alpha: number, beta: number): number {
  const moves = allMoves(board, turn);
  if (!moves.length) return turn === me ? -900 - depth : 900 + depth;
  if (depth === 0) return evaluate(board, me);

  if (turn === me) {
    let best = -Infinity;
    for (const { from, move } of moves) {
      const nb = applyFull(board, from, move);
      best = Math.max(best, search(nb, me, other(turn), depth - 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const { from, move } of moves) {
    const nb = applyFull(board, from, move);
    best = Math.min(best, search(nb, me, other(turn), depth - 1, alpha, beta));
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

export interface Decision {
  from: Pos;
  move: Move;
  score: number;
}

/**
 * Escolhe o lance menos arriscado. `depth` 4 já enxerga:
 * meu lance → resposta dele → meu troco → resposta dele.
 */
export function chooseMove(board: BoardState, me: Player, depth = 4): Decision | null {
  const moves = allMoves(board, me);
  if (!moves.length) return null;
  if (moves.length === 1) return { ...moves[0], score: 0 };

  let best: Decision | null = null;
  for (const { from, move } of moves) {
    const nb = applyFull(board, from, move);
    let score = search(nb, me, other(me), depth - 1, -Infinity, Infinity);
    // desempate suave: evita comportamento robótico repetitivo
    score += Math.random() * 0.05;
    if (!best || score > best.score) best = { from, move, score };
  }
  return best;
}

// ── OBSERVADOR SILENCIOSO ────────────────────────────────────

export interface RiskReport {
  /** peças que serão capturadas em qualquer lance que eu faça */
  doomed: number;
  total: number;
  /** peças que têm ao menos uma saída segura */
  safe: number;
  /** melhor placar alcançável olhando à frente */
  bestScore: number;
  /** quanto o adversário come na melhor resposta ao meu melhor lance */
  worstLoss: number;
  /** dá pra coroar alguém em breve? */
  promotionChance: boolean;
  /** sem chance real: aceita render */
  hopeless: boolean;
  reason: string;
}

/**
 * Analisa a situação de `me` sem tocar no jogo.
 *
 * Cuidado deliberado (pedido do Marcos):
 *  - Ter poucas peças NÃO é motivo de rendição se ainda há saída.
 *  - Entregar peça pode ser sacrifício para abrir caminho de dama:
 *    por isso `promotionChance` VETA a rendição.
 *  - Só considera perdido quando TODAS as linhas terminam mal.
 */
export function analyzeRisk(board: BoardState, me: Player): RiskReport {
  const opp = other(me);
  const counts = countPieces(board);
  const total = counts[me];

  const rep: RiskReport = {
    doomed: 0,
    total,
    safe: 0,
    bestScore: 0,
    worstLoss: 0,
    promotionChance: false,
    hopeless: false,
    reason: "",
  };
  if (total === 0) {
    rep.hopeless = true;
    rep.reason = "sem unidades";
    return rep;
  }

  const moves = allMoves(board, me);
  if (!moves.length) {
    rep.hopeless = true;
    rep.reason = "sem movimentos";
    return rep;
  }

  // ── por peça: existe algum lance que não a entrega de graça? ──
  const byPiece = new Map<string, { total: number; safe: number }>();
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p?.player === me) byPiece.set(`${r}-${c}`, { total: 0, safe: 0 });
    }

  let bestScore = -Infinity;
  let worstLossOfBest = 0;

  for (const { from, move } of moves) {
    const nb = applyFull(board, from, move);
    const lost = bestOpponentGain(nb, opp);
    const gained = move.jump ? chainDepth(board, from, move, 0) : 0;
    const netto = gained - lost;

    const key = `${from.r}-${from.c}`;
    const rec = byPiece.get(key);
    if (rec) {
      rec.total++;
      if (netto >= 0) rec.safe++;
    }

    // coroação à vista? (agora ou logo depois)
    const landed = nb[move.to.r][move.to.c];
    if (landed?.king && !board[from.r][from.c]?.king) rep.promotionChance = true;

    const score = search(nb, me, opp, 2, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      worstLossOfBest = lost;
    }
  }

  for (const rec of byPiece.values()) {
    if (rec.total === 0) continue;
    if (rec.safe > 0) rep.safe++;
    else rep.doomed++;
  }

  rep.bestScore = bestScore;
  rep.worstLoss = worstLossOfBest;

  // ── veredito, com trava dupla ──
  const material = total - counts[opp];
  const kings = { me: 0, opp: 0 };
  for (const row of board)
    for (const p of row) if (p?.king) kings[p.player === me ? "me" : "opp"]++;

  // VETO: ainda dá pra virar
  if (rep.safe > 0 && rep.promotionChance) {
    rep.reason = "há saída e chance de coroar";
    return rep;
  }
  if (rep.safe >= 2) {
    rep.reason = "há peças com saída segura";
    return rep;
  }
  if (kings.me > 0 && rep.safe > 0) {
    rep.reason = "dama viva com saída";
    return rep;
  }

  // ── Daqui pra baixo é rendição. Trava tripla, deliberadamente dura:
  //    quem tem 4+ peças NUNCA recebe sugestão de render — com esse
  //    material ainda dá pra sacrificar, abrir corredor e coroar.
  if (total >= 3) {
    rep.reason = "material suficiente para reagir";
    return rep;
  }
  if (rep.promotionChance || kings.me > 0) {
    rep.reason = "ainda há caminho de dama";
    return rep;
  }

  // busca profunda de confirmação: existe QUALQUER linha que não termine mal?
  const deep = search(board, me, me, 5, -Infinity, Infinity);
  if (deep > -4) {
    rep.reason = "a análise profunda ainda vê chance";
    return rep;
  }

  // condenado: 1-3 peças, nenhuma com saída, sem dama, sem coroação à vista
  if (rep.safe === 0 && bestScore < -3.5 && material <= -3) {
    rep.hopeless = true;
    rep.reason = `nenhuma saída · ${rep.doomed}/${total} unidades condenadas`;
    return rep;
  }
  // esmagado: 1-2 peças cercadas contra força muito maior
  if (total <= 2 && counts[opp] >= total + 4 && rep.safe === 0) {
    rep.hopeless = true;
    rep.reason = "cercado e em inferioridade total";
    return rep;
  }

  rep.reason = rep.safe > 0 ? "ainda há saída" : "situação crítica, mas há chance";
  return rep;
}
