// The live class's command queue on the device (ADR-009): one IndexedDB record that holds the whole
// queue. It never leaves the device except through the backend, which sends the commands in order.
import type { QueueState, QueueStore } from '../application/live-queue';

const STORE = 'queue';
const KEY = 'live';

function open(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function request<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const result = run(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(result.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function indexedDbQueueStore(name = 'dan-sensei-live'): QueueStore {
  const db = open(name);
  return {
    load: async () => ((await request(await db, 'readonly', (s) => s.get(KEY))) as QueueState | undefined) ?? { pending: [], refused: [] },
    save: async (state) => void (await request(await db, 'readwrite', (s) => s.put(state, KEY))),
  };
}
