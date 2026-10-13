// Offline-first: een kopie van je gegevens in IndexedDB (de app opent er direct mee, ook zonder netwerk)
// en een wachtrij voor wijzigingen die je offline doet; die gaan vanzelf weg zodra er weer verbinding is.
// Alles is best effort: zonder IndexedDB (privévenster) werkt de app gewoon online.

const DB = "planner";
const SNAPSHOT = "snapshot";
const OUTBOX = "outbox";

export type QueuedRequest = { id?: number; method: string; path: string; body?: string; at: number };

let dbPromise: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("geen IndexedDB"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(SNAPSHOT);
      req.result.createObjectStore(OUTBOX, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const tx = d.transaction(store, mode);
        const req = action(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

// ---------- Snapshot ----------

export async function saveSnapshot(name: string, value: unknown) {
  await run(SNAPSHOT, "readwrite", (s) => s.put(value, name)).catch(() => {});
}

export async function loadSnapshot<T>(name: string): Promise<T | null> {
  return ((await run(SNAPSHOT, "readonly", (s) => s.get(name)).catch(() => undefined)) as T | undefined) ?? null;
}

/** Bij uitloggen: niets van je gegevens op het apparaat laten staan. */
export async function clearOffline() {
  await Promise.all([run(SNAPSHOT, "readwrite", (s) => s.clear()), run(OUTBOX, "readwrite", (s) => s.clear())]).catch(() => {});
}

// ---------- Wachtrij ----------

export async function enqueue(request: Omit<QueuedRequest, "id" | "at">) {
  await run(OUTBOX, "readwrite", (s) => s.add({ ...request, at: Date.now() }));
}

export async function queued(): Promise<QueuedRequest[]> {
  return ((await run(OUTBOX, "readonly", (s) => s.getAll()).catch(() => [])) as QueuedRequest[]).sort((a, b) => (a.id || 0) - (b.id || 0));
}

export async function dequeue(id: number) {
  await run(OUTBOX, "readwrite", (s) => s.delete(id)).catch(() => {});
}

/** Geen verbinding (de browser zegt offline, of fetch kreeg geen antwoord). */
export const isOfflineError = (error: unknown) =>
  (typeof navigator !== "undefined" && navigator.onLine === false) || error instanceof TypeError;

export class QueuedError extends Error {
  constructor() {
    super("Offline: wordt verstuurd zodra er weer verbinding is.");
  }
}
