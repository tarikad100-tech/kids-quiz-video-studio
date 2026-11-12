/*
 * Saves voice clips in the browser (IndexedDB) so they survive a refresh and a
 * generated clip is never paid for twice. Every call is wrapped: if storage is
 * blocked (private window), the app still works for the current session.
 */

const DB_NAME = "quizzy-voice";
const STORE = "clips";

export type StoredClip = {
  bytes: ArrayBuffer;
  /** The text this clip was made for (to notice when the question changed). */
  script: string;
  source: "voice" | "mic" | "file";
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Storage unavailable."));
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  try {
    const db = await open();

    return await new Promise<T | null>((resolve) => {
      const transaction = db.transaction(STORE, mode);
      const request = work(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
      transaction.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

export function loadStored(key: string): Promise<StoredClip | null> {
  return run<StoredClip>("readonly", (store) => store.get(key) as IDBRequest<StoredClip>);
}

export async function saveStored(key: string, clip: StoredClip): Promise<void> {
  await run("readwrite", (store) => store.put(clip, key));
}

export async function deleteStored(key: string): Promise<void> {
  await run("readwrite", (store) => store.delete(key));
}

/** Small stable hash for cache keys. */
export function hashText(text: string): string {
  let hash = 5381;

  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;

  return hash.toString(36);
}
