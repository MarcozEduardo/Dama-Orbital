import { getFunctions, httpsCallable, type Functions } from "firebase/functions";
import {
  ensureFirebaseSession,
  firebaseFunctionsRegion,
} from "../../config/firebase";
import type { MatchEvent, MatchStateSnapshot } from "./types";

let functions: Functions | null = null;

async function client() {
  const { app } = await ensureFirebaseSession();
  functions ??= getFunctions(app, firebaseFunctionsRegion);
  return functions;
}

export async function callCreateMatch(nick: string) {
  const fn = httpsCallable<{ nick: string }, { matchId: string; code: string; seat: "host" }>(
    await client(),
    "createMatch",
  );
  return (await fn({ nick })).data;
}

export async function callJoinMatch(code: string, nick: string, intent: "play" | "observe") {
  const fn = httpsCallable<
    { code: string; nick: string; intent: "play" | "observe" },
    { matchId: string; code: string; seat: "host" | "guest" | "observer" }
  >(await client(), "joinMatch");
  return (await fn({ code, nick, intent })).data;
}

export async function callSubmitMatchEvent(event: MatchEvent) {
  const fn = httpsCallable<{ event: MatchEvent }, { commit: MatchStateSnapshot }>(
    await client(),
    "submitMatchEvent",
  );
  return (await fn({ event })).data.commit;
}

export async function callSendRadio(matchId: string, text: string) {
  const fn = httpsCallable<{ matchId: string; text: string }, { ok: true }>(
    await client(),
    "sendRadio",
  );
  return (await fn({ matchId, text })).data;
}

export async function callGetTurnCredentials(): Promise<unknown> {
  const fn = httpsCallable<{ ttl: number }, unknown>(await client(), "getTurnCredentials");
  return (await fn({ ttl: 3600 })).data;
}