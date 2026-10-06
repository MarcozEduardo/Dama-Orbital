import { acknowledgeEvent, pendingEvents, queueEvent } from "./outbox";
import type {
  ChannelStatus,
  EventChannel,
  LinkState,
  MatchEvent,
  Unsubscribe,
} from "./types";

const MAX_SEEN = 256;

/**
 * Combina WebRTC e RTDB sem aplicar um evento duas vezes.
 *
 * - WebRTC entrega rápido.
 * - RTDB recebe o mesmo eventId e mantém a cópia durável.
 * - IndexedDB só apaga a outbox depois que a RTDB confirma o envio.
 */
export class ResilientEventChannel implements EventChannel {
  readonly name = "resilient-p2p-rtdb";
  private listeners = new Set<(event: MatchEvent) => void>();
  private statusListeners = new Set<(status: ChannelStatus) => void>();
  private cleanups: Unsubscribe[] = [];
  private seen = new Set<string>();
  private seenOrder: string[] = [];
  private directStatus: ChannelStatus = {
    state: "CONNECTING",
    peers: 0,
    latencyMs: null,
  };
  private fallbackStatus: ChannelStatus = {
    state: "CONNECTING",
    peers: 0,
    latencyMs: null,
  };

  constructor(
    private readonly matchId: string,
    private readonly direct: EventChannel,
    private readonly fallback: EventChannel,
  ) {
    this.cleanups.push(
      direct.subscribe((event) => this.emitOnce(event)),
      fallback.subscribe((event) => this.emitOnce(event)),
      direct.subscribeStatus((status) => {
        this.directStatus = status;
        this.emitStatus();
      }),
      fallback.subscribeStatus((status) => {
        this.fallbackStatus = status;
        this.emitStatus();
      }),
    );
  }

  async send(event: MatchEvent) {
    await queueEvent(event);
    const [directResult, fallbackResult] = await Promise.allSettled([
      this.direct.send(event),
      this.fallback.send(event),
    ]);

    // A RTDB é a cópia durável. P2P sozinho não remove a outbox.
    if (fallbackResult.status === "fulfilled") {
      await acknowledgeEvent(event.eventId);
      return;
    }
    if (directResult.status === "fulfilled") return;
    throw new Error("Nenhum canal conseguiu enviar o evento");
  }

  async flush() {
    const events = await pendingEvents(this.matchId);
    for (const event of events) {
      try {
        await this.send(event);
      } catch {
        break;
      }
    }
  }

  subscribe(listener: (event: MatchEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeStatus(listener: (status: ChannelStatus) => void) {
    this.statusListeners.add(listener);
    listener(this.combinedStatus());
    return () => this.statusListeners.delete(listener);
  }

  async close() {
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
    await Promise.allSettled([this.direct.close(), this.fallback.close()]);
    this.listeners.clear();
    this.statusListeners.clear();
  }

  private emitOnce(event: MatchEvent) {
    if (this.seen.has(event.eventId)) return;
    this.seen.add(event.eventId);
    this.seenOrder.push(event.eventId);
    if (this.seenOrder.length > MAX_SEEN) {
      const oldest = this.seenOrder.shift();
      if (oldest) this.seen.delete(oldest);
    }
    this.listeners.forEach((listener) => listener(event));
  }

  private combinedStatus(): ChannelStatus {
    const directLive = this.directStatus.state === "DIRECT" || this.directStatus.state === "RELAYED";
    if (directLive) return this.directStatus;
    if (this.fallbackStatus.state === "DATABASE") return this.fallbackStatus;

    const state: LinkState =
      this.directStatus.state === "CLOSED" && this.fallbackStatus.state === "CLOSED"
        ? "CLOSED"
        : "RECONNECTING";
    return {
      state,
      peers: this.directStatus.peers,
      latencyMs: null,
      detail: "Aguardando WebRTC ou Firebase",
    };
  }

  private emitStatus() {
    const status = this.combinedStatus();
    this.statusListeners.forEach((listener) => listener(status));
    if (status.state === "DATABASE" || status.state === "DIRECT" || status.state === "RELAYED") {
      void this.flush();
    }
  }
}