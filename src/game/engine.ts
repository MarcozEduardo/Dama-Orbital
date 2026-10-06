// ─────────────────────────────────────────────────────────────
//  DAMAS ORBITAIS · Motor de regras (Damas Brasileiras)
//  - Captura obrigatória ("comer é obrigatório")
//  - Capturas múltiplas em cadeia (bug das direções corrigido!)
//  - Peão captura para frente E para trás
//  - Dama "voadora": desliza e captura a qualquer distância na diagonal
// ─────────────────────────────────────────────────────────────

export type Player = 1 | 2;

export interface PieceObj {
  id: number;
  player: Player;
  king: boolean;
  kills: number; // estrelas de veterana ⭐
}

export type Cell = PieceObj | null;
export type BoardState = Cell[][];

export interface Pos {
  r: number;
  c: number;
}

export interface Move {
  to: Pos;
  jump: Pos | null;
}

// CORREÇÃO: antes havia [5] solto no array — faltava a diagonal [1, 1]!
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

export const keyOf = (r: number, c: number) => `${r}-${c}`;

export function createInitialBoard(): BoardState {
  const b: BoardState = Array.from({ length: 8 }, () => Array<Cell>(8).fill(null));
  let id = 1;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1) b[r][c] = { id: id++, player: 2, king: false, kills: 0 };
  for (let r = 5; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1) b[r][c] = { id: id++, player: 1, king: false, kills: 0 };
  return b;
}

export function cloneBoard(b: BoardState): BoardState {
  return b.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

/** Todos os movimentos legais de UMA peça. capturesOnly = só saltos de captura. */
export function movesFrom(b: BoardState, r: number, c: number, capturesOnly = false): Move[] {
  const piece = b[r]?.[c];
  if (!piece) return [];
  const opp: Player = piece.player === 1 ? 2 : 1;
  const out: Move[] = [];

  if (!piece.king) {
    // ── peão: anda 1 casa na diagonal para frente
    if (!capturesOnly) {
      const fwd = piece.player === 1 ? -1 : 1;
      for (const dc of [-1, 1]) {
        const nr = r + fwd;
        const nc = c + dc;
        if (inside(nr, nc) && !b[nr][nc]) out.push({ to: { r: nr, c: nc }, jump: null });
      }
    }
    // ── peão: captura nas 4 diagonais (frente e trás)
    for (const [dr, dc] of DIRS) {
      const mr = r + dr;
      const mc = c + dc;
      const lr = r + 2 * dr;
      const lc = c + 2 * dc;
      if (inside(lr, lc)) {
        const mid = b[mr]?.[mc];
        if (mid && mid.player === opp && !b[lr][lc]) {
          out.push({ to: { r: lr, c: lc }, jump: { r: mr, c: mc } });
        }
      }
    }
  } else {
    // ── DAMA: voa pela diagonal; captura a peça que estiver no caminho
    //    e pode pousar em qualquer casa livre além dela. Nada de eixo X/Y!
    for (const [dr, dc] of DIRS) {
      let nr = r + dr;
      let nc = c + dc;
      let enemy: Pos | null = null;
      while (inside(nr, nc)) {
        const cell = b[nr][nc];
        if (!enemy) {
          if (!cell) {
            if (!capturesOnly) out.push({ to: { r: nr, c: nc }, jump: null });
          } else if (cell.player === opp) {
            enemy = { r: nr, c: nc };
          } else {
            break; // aliada bloqueia o caminho
          }
        } else {
          if (!cell) out.push({ to: { r: nr, c: nc }, jump: enemy });
          else break; // muro atrás do alvo
        }
        nr += dr;
        nc += dc;
      }
    }
  }

  return capturesOnly ? out.filter((m) => m.jump) : out;
}

/** Existe alguma captura disponível para o jogador? (regra do "comer é obrigatório") */
export function capturesExist(b: BoardState, player: Player): boolean {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (p && p.player === player && movesFrom(b, r, c, true).length > 0) return true;
    }
  return false;
}

/** Conjunto de chaves "r-c" das peças do jogador que TÊM captura disponível. */
export function forcedPieces(b: BoardState, player: Player): Set<string> {
  const set = new Set<string>();
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (p && p.player === player && movesFrom(b, r, c, true).length > 0) set.add(keyOf(r, c));
    }
  return set;
}

/** Movimentos legais do jogador já aplicando a captura obrigatória. */
export function allMoves(b: BoardState, player: Player): Array<{ from: Pos; move: Move }> {
  const must = capturesExist(b, player);
  const out: Array<{ from: Pos; move: Move }> = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p || p.player !== player) continue;
      for (const m of movesFrom(b, r, c, must)) out.push({ from: { r, c }, move: m });
    }
  return out;
}

export function countPieces(b: BoardState): Record<Player, number> {
  const count: Record<Player, number> = { 1: 0, 2: 0 };
  for (const row of b)
    for (const cell of row) if (cell) count[cell.player]++;
  return count;
}
