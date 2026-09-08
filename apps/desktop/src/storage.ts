import { indexedDbBlobStore, memoryBackedLocalStore } from '@forge/core';
import type { BlobStore, KeyValueStore } from '@forge/core';

const inTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Project settings live in localStorage; they are not secret. */
export function desktopStore(): KeyValueStore {
  return memoryBackedLocalStore();
}

/**
 * The provider API key goes to the OS keychain through the Tauri commands in
 * src-tauri/src/main.rs, so it is never written to disk in the clear and never
 * synced. Outside the shell (plain `npm run dev`) it falls back to
 * localStorage, and the UI says so.
 */
export function desktopSecrets(): KeyValueStore {
  if (!inTauri()) {
    const inner = memoryBackedLocalStore();
    return {
      get: (k) => inner.get(`insecure.${k}`),
      set: (k, v) => inner.set(`insecure.${k}`, v),
      remove: (k) => inner.remove(`insecure.${k}`),
    };
  }
  const invoke = async <T>(cmd: string, args: Record<string, unknown>): Promise<T> => {
    const api = await import('@tauri-apps/api/core');
    return api.invoke<T>(cmd, args);
  };
  return {
    async get(name) {
      return (await invoke<string | null>('get_secret', { name })) ?? null;
    },
    async set(name, value) {
      await invoke('set_secret', { name, value });
    },
    async remove(name) {
      await invoke('delete_secret', { name });
    },
  };
}

export const desktopBlobs = (): BlobStore => indexedDbBlobStore();

export const secretsAreSecure = inTauri;
