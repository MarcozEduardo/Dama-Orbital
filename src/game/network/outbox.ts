import type { MatchEvent } from "./types";

const DB_NAME = "damas-orbitais-network";
const STORE = "outbox";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase | null> {
  if (!("indexedDB" in window)) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "eventId" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, resolve: (value: T) => void) => void,
  fallback: T,
): Promise<T> {
  const db = await openDatabase();
  if (!db) return fallback;

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE, mode);
      operation(transaction.objectStore(STORE), resolve);
      transaction.onerror = () => resolve(fallback);
      transaction.onabort = () => resolve(fallback);
      transaction.oncomplete = () => db.close();
    } catch {
      db.close();
      resolve(fallback);
    }
  });
}

export async function queueEvent(event: MatchEvent): Promise<void> {
  await withStore<void>("readwrite", (store, resolve) => {
    const request = store.put(event);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  }, undefined);
}

export async function acknowledgeEvent(eventId: string): Promise<void> {
  await withStore<void>("readwrite", (store, resolve) => {
    const request = store.delete(eventId);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  }, undefined);
}

export async function pendingEvents(matchId?: string): Promise<MatchEvent[]> {
  return withStore<MatchEvent[]>("readonly", (store, resolve) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const events = (request.result as MatchEvent[]).filter((event) => !matchId || event.matchId === matchId);
      resolve(events.sort((a, b) => a.sentAt - b.sentAt));
    };
    request.onerror = () => resolve([]);
  }, []);
}

export async function pruneOutbox(maxAgeMs = 24 * 60 * 60 * 1000): Promise<void> {
  const cutoff = Date.now() - maxAgeMs;
  const events = await pendingEvents();
  await Promise.all(events.filter((event) => event.sentAt < cutoff).map((event) => acknowledgeEvent(event.eventId)));
}