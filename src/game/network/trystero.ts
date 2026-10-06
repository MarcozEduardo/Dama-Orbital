import {
  joinRoom,
  type JsonValue,
  type MessageAction,
  type Room,
  type TurnServerConfig,
} from "@trystero-p2p/firebase";
import {
  ensureFirebaseSession,
  firebaseFunctionsEnabled,
  trysteroFirebasePath,
  turnCredentialEndpoint,
} from "../../config/firebase";
import { callGetTurnCredentials } from "./functions";
import type {
  ChannelStatus,
  EventChannel,
  MatchEvent,
} from "./types";

type WireObject = Record<string, JsonValue>;

function toWire(event: MatchEvent): WireObject {
  return JSON.parse(JSON.stringify(event)) as WireObject;
}

function fromWire(value: WireObject): MatchEvent | null {
  if (
    typeof value.eventId !== "string" ||
    typeof value.matchId !== "string" ||
    typeof value.actorUid !== "string" ||
    typeof value.kind !== "string"
  ) {
    return null;
  }
  return value as unknown as MatchEvent;
}

function normalizeTurnConfig(value: unknown): TurnServerConfig[] {
  const root = value as
    | { iceServers?: unknown; servers?: unknown }
    | TurnServerConfig[]
    | null;
  const list = Array.isArray(root)
    ? root
    : Array.isArray(root?.iceServers)
      ? root.iceServers
      : Array.isArray(root?.servers)
        ? root.servers
        : [];

  return list.filter((item): item is TurnServerConfig => {
    if (!item || typeof item !== "object") return false;
    const urls = (item as TurnServerConfig).urls;
    return typeof urls === "string" || (Array.isArray(urls) && urls.every((url) => typeof url === "string"));
  });
}

export async function fetchTurnConfig(): Promise<TurnServerConfig[]> {
  if (turnCredentialEndpoint) {
    const response = await fetch(turnCredentialEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: 3600 }),
    });
    if (!response.ok) throw new Error(`TURN respondeu ${response.status}`);
    return normalizeTurnConfig(await response.json());
  }

  // Só tenta a callable quando o deploy das Functions foi confirmado.
  if (firebaseFunctionsEnabled) {
    return normalizeTurnConfig(await callGetTurnCredentials());
  }
  return [];
}

async function detectRoute(connection: RTCPeerConnection): Promise<"DIRECT" | "RELAYED"> {
  try {
    const stats = await connection.getStats();
    let selectedLocalCandidateId = "";
    stats.forEach((report) => {
      if (
        report.type === "candidate-pair" &&
        (report.selected || (report.nominated && report.state === "succeeded"))
      ) {
        selectedLocalCandidateId = String(report.localCandidateId || "");
      }
    });
    let relayed = false;
    stats.forEach((report) => {
      if (
        report.type === "local-candidate" &&
        report.id === selectedLocalCandidateId &&
        report.candidateType === "relay"
      ) {
        relayed = true;
      }
    });
    return relayed ? "RELAYED" : "DIRECT";
  } catch {
    return "DIRECT";
  }
}

export class TrysteroEventChannel implements EventChannel {
  readonly name = "trystero-webrtc";
  private room: Room | null = null;
  private eventAction: MessageAction<WireObject> | null = null;
  private listeners = new Set<(event: MatchEvent) => void>();
  private statusListeners = new Set<(status: ChannelStatus) => void>();
  private status: ChannelStatus = {
    state: "CONNECTING",
    peers: 0,
    latencyMs: null,
    detail: "Aguardando peer WebRTC",
  };

  constructor(
    private readonly matchId: string,
    private readonly password?: string,
  ) {}

  async connect() {
    if (this.room) return;
    const { app } = await ensureFirebaseSession();
    let turnConfig: TurnServerConfig[] = [];
    try {
      turnConfig = await fetchTurnConfig();
    } catch {
      // TURN é proteção extra; RTDB continua disponível se este fetch falhar.
    }

    this.room = joinRoom(
      {
        appId: String(app.options.databaseURL),
        password: this.password,
        relayConfig: {
          firebaseApp: app,
          firebasePath: trysteroFirebasePath,
        },
        turnConfig,
        trickleIce: true,
      },
      this.matchId,
      {
        handshakeTimeoutMs: 10_000,
        onJoinError: ({ error }) => {
          this.setStatus({
            state: "DATABASE",
            peers: Object.keys(this.room?.getPeers() || {}).length,
            latencyMs: null,
            detail: `P2P indisponível: ${error}`,
          });
        },
      },
    );

    const action = this.room.makeAction<WireObject>("match-event");
    action.onMessage = (data) => {
      const event = fromWire(data);
      if (event) this.listeners.forEach((listener) => listener(event));
    };
    this.eventAction = action;

    this.room.onPeerJoin = (peerId) => void this.refreshPeer(peerId);
    this.room.onPeerLeave = () => {
      const peers = Object.keys(this.room?.getPeers() || {}).length;
      this.setStatus({
        state: peers ? this.status.state : "RECONNECTING",
        peers,
        latencyMs: null,
        detail: peers ? "Peer alternativo ativo" : "DataChannel reconectando",
      });
    };
  }

  async send(event: MatchEvent) {
    if (!this.room || !this.eventAction) await this.connect();
    if (!Object.keys(this.room!.getPeers()).length) throw new Error("Nenhum peer P2P conectado");
    await this.eventAction!.send(toWire(event));
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

  async close() {
    const room = this.room;
    this.room = null;
    this.eventAction = null;
    if (room) await room.leave();
    this.listeners.clear();
    this.statusListeners.clear();
    this.status = { state: "CLOSED", peers: 0, latencyMs: null };
  }

  private async refreshPeer(peerId: string) {
    if (!this.room) return;
    const connection = this.room.getPeers()[peerId];
    const [route, latency] = await Promise.all([
      connection ? detectRoute(connection) : Promise.resolve<"DIRECT" | "RELAYED">("DIRECT"),
      this.room.ping(peerId).catch(() => null),
    ]);
    this.setStatus({
      state: route,
      peers: Object.keys(this.room.getPeers()).length,
      latencyMs: latency,
      detail: route === "RELAYED" ? "WebRTC via TURN" : "WebRTC direto",
    });
  }

  private setStatus(status: ChannelStatus) {
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }
}