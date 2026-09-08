import type { BlobStore } from './generation.js';

export type { BlobStore } from './generation.js';

/**
 * IndexedDB-backed model cache — the default on desktop and in the browser.
 * The Android build swaps in a Filesystem-backed store so models survive a
 * WebView data clear and can be shared out to other apps.
 */
export function indexedDbBlobStore(dbName = 'forge-models'): BlobStore {
  const STORE = 'models';
  const urls = new Map<string, string>();

  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Could not open the model cache'));
    });

  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => {
    const db = await open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const request = fn(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Model cache write failed'));
      });
    } finally {
      db.close();
    }
  };

  return {
    async put(id, blob) {
      await tx('readwrite', (s) => s.put(blob, id));
      return id;
    },
    async url(id) {
      const cached = urls.get(id);
      if (cached) return cached;
      const blob = await tx<Blob | undefined>('readonly', (s) => s.get(id));
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      urls.set(id, url);
      return url;
    },
    async remove(id) {
      const url = urls.get(id);
      if (url) {
        URL.revokeObjectURL(url);
        urls.delete(id);
      }
      await tx('readwrite', (s) => s.delete(id));
    },
  };
}

/** Read a stored model back out, e.g. to export or share it. */
export async function readBlob(store: BlobStore, id: string): Promise<Blob | null> {
  const url = await store.url(id);
  if (!url) return null;
  const res = await fetch(url);
  return res.ok ? res.blob() : null;
}
