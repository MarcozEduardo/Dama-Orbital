import type { Player } from "../engine";

export type MatchSeat = "host" | "guest" | "observer";
export type MatchMode = "online" | "observer";
export type LinkState =
  | "CONNECTING"
  | "DIRECT"
  | "RELAYED"
  | "DATABASE"
  | "RECONNECTING"
  | "PAUSED"
  | "CLOSED";

export type MatchEventKind = "MOVE" | "SURRENDER" | "TIMEOUT" | "RADIO" | "SYNC_REQUEST";

export interface MatchEvent {
  eventId: string;
  matchId: string;
  seqExpected: number;
  actorUid: string;
  actorSeat: MatchSeat;
  kind: MatchEventKind;
  payload: Record<string, unknown>;
  sentAt: number;
  baseHash: string;
}

export interface MoveRecord {
  from: [number, number];
  to: [number, number];
  jumps: [number, number][];
}

export interface MatchStateSnapshot {
  board: string;
  turn: Player;
  seq: number;
  lastMove: MoveRecord | null;
  winner: Player | null;
  surrendered: Player | null;
  deadlineAt: number;
  /** peça que o jogador da vez está com a mão em cima */
  selected?: [number, number] | null;
  stateHash: string;
  lastEventId: string | null;
}

export interface RemotePlayer {
  uid: string;
  nick: string;
  joinedAt: number;
  lastSeen: number;
}

export interface RemoteMatch {
  version: 1;
  code: string;
  status: "waiting" | "playing" | "reconnecting" | "finished" | "expired";
  createdAt: number;
  expiresAt: number;
  updatedAt: number;
  players: {
    p1: RemotePlayer;
    p2?: RemotePlayer;
  };
  observers?: Record<string, RemotePlayer>;
  typing?: { kind: "nick" | "radio" | "surrender"; who: string; uid: string; until: number } | null;
  state: MatchStateSnapshot;
}

export interface ConnectionIdentity {
  matchId: string;
  code: string;
  uid: string;
  seat: MatchSeat;
  match: RemoteMatch;
}

export interface CommitResult {
  committed: boolean;
  reason?: "stale-seq" | "wrong-turn" | "not-player" | "match-closed" | "missing";
  state?: MatchStateSnapshot;
}

export interface ChannelStatus {
  state: LinkState;
  peers: number;
  latencyMs: number | null;
  detail?: string;
}

export type Unsubscribe = () => void;

export interface EventChannel {
  readonly name: string;
  send(event: MatchEvent): Promise<void>;
  subscribe(listener: (event: MatchEvent) => void): Unsubscribe;
  subscribeStatus(listener: (status: ChannelStatus) => void): Unsubscribe;
  close(): Promise<void> | void;
}