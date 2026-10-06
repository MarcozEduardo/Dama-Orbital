export * from "./types";
export * from "./hash";
export * from "./outbox";
export * from "./firebase";
export * from "./trystero";
export * from "./functions";
export * from "./resilient";
export * from "./pulse";

import { FirebaseEventChannel } from "./firebase";
import { ResilientEventChannel } from "./resilient";
import { TrysteroEventChannel } from "./trystero";

/**
 * Fábrica pronta para a integração no App. Não chamar para observadores:
 * eles devem ouvir somente o snapshot/eventos da RTDB.
 */
export async function createPlayerChannel(matchId: string, password?: string) {
  const firebase = new FirebaseEventChannel(matchId);
  const p2p = new TrysteroEventChannel(matchId, password);
  await firebase.connect();
  // WebRTC é aceleração, não requisito de continuidade. Se a rede bloquear
  // o handshake, o canal combinado nasce mesmo assim operando pela RTDB.
  await p2p.connect().catch(() => undefined);
  return new ResilientEventChannel(matchId, p2p, firebase);
}