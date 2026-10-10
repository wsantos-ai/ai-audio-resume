// Fila offline em IndexedDB: toda gravação é salva aqui ANTES do envio e só sai após o servidor confirmar.

export interface PendingRecording {
  uuid: string;
  blob: Blob;
  duration: number;
  /** ISO 8601 (UTC) do fim da gravação */
  visitedAt: string;
  createdAt: string;
  lastError: string | null;
}

const DB_NAME = 'resumo-visitas';
const STORE = 'pending';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'uuid' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
  });
}

export const queue = {
  put: (item: PendingRecording) => tx('readwrite', (s) => s.put(item)),
  remove: (uuid: string) => tx('readwrite', (s) => s.delete(uuid)),
  async all(): Promise<PendingRecording[]> {
    const items = await tx<PendingRecording[]>('readonly', (s) => s.getAll());
    return (items ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
};
