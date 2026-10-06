/** Hash pequeno e determinístico para detectar divergência de estado. */
export function stateHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function hashMatchState(input: {
  board: string;
  turn: number;
  seq: number;
  winner?: number | null;
  surrendered?: number | null;
}) {
  return stateHash(
    `${input.board}|${input.turn}|${input.seq}|${input.winner ?? "-"}|${input.surrendered ?? "-"}`,
  );
}

export function createEventId(uid: string, localCounter: number) {
  const time = Date.now().toString(36);
  return `${uid.slice(0, 8)}-${time}-${localCounter.toString(36)}`;
}