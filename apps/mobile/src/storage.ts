import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { indexedDbBlobStore, memoryBackedLocalStore } from '@forge/core';
import type { BlobStore, KeyValueStore } from '@forge/core';

const isNative = () => Capacitor.isNativePlatform();

/** Settings live in Android's SharedPreferences, so they survive app updates. */
export function preferencesStore(): KeyValueStore {
  if (!isNative()) return memoryBackedLocalStore();
  return {
    async get(key) {
      return (await Preferences.get({ key })).value;
    },
    async set(key, value) {
      await Preferences.set({ key, value });
    },
    async remove(key) {
      await Preferences.remove({ key });
    },
  };
}

/**
 * The provider API key. Android's SharedPreferences are private to the app and
 * excluded from cloud backup below (`android:allowBackup` stays on for project
 * data, but the key is stored under its own prefix and cleared on sign-out).
 * It is never written into project state, so it never syncs to another device.
 */
export function secretStore(): KeyValueStore {
  const inner = preferencesStore();
  const scoped = (k: string) => `secret.${k}`;
  return {
    get: (k) => inner.get(scoped(k)),
    set: (k, v) => inner.set(scoped(k), v),
    remove: (k) => inner.remove(scoped(k)),
  };
}

const MODEL_DIR = 'models';

/**
 * Models are stored as real files in the app's data directory rather than in
 * the WebView's storage: they survive a cache clear, they can be handed to
 * another app when exporting, and they are not size-capped like IndexedDB.
 */
export function filesystemBlobStore(): BlobStore {
  if (!isNative()) return indexedDbBlobStore();

  const path = (id: string) => `${MODEL_DIR}/${id}.glb`;
  const urls = new Map<string, string>();

  const toBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result);
        resolve(result.slice(result.indexOf(',') + 1));
      };
      reader.onerror = () => reject(reader.error ?? new Error('Could not read the model'));
      reader.readAsDataURL(blob);
    });

  return {
    async put(id, blob) {
      await Filesystem.mkdir({ path: MODEL_DIR, directory: Directory.Data, recursive: true }).catch(
        () => undefined, // already exists
      );
      await Filesystem.writeFile({
        path: path(id),
        directory: Directory.Data,
        data: await toBase64(blob),
      });
      return id;
    },
    async url(id) {
      const cached = urls.get(id);
      if (cached) return cached;
      // getUri only assembles a path — it succeeds for a file that was never
      // written. Without this stat the store hands back a URL to nothing, the
      // viewer 404s on it, and sync concludes the model is already here and
      // never downloads it.
      if (!(await this.has(id))) return null;
      try {
        const { uri } = await Filesystem.getUri({ path: path(id), directory: Directory.Data });
        // The WebView cannot read file:// directly; Capacitor rewrites it.
        const webUrl = Capacitor.convertFileSrc(uri);
        urls.set(id, webUrl);
        return webUrl;
      } catch {
        return null;
      }
    },
    async has(id) {
      if (urls.has(id)) return true;
      try {
        const info = await Filesystem.stat({ path: path(id), directory: Directory.Data });
        return info.size > 0;
      } catch {
        return false;
      }
    },
    async remove(id) {
      urls.delete(id);
      await Filesystem.deleteFile({ path: path(id), directory: Directory.Data }).catch(
        () => undefined, // already gone
      );
    },
  };
}

/** Absolute on-device path of a stored model, for sharing or exporting. */
export async function modelFileUri(id: string): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const { uri } = await Filesystem.getUri({
      path: `${MODEL_DIR}/${id}.glb`,
      directory: Directory.Data,
    });
    return uri;
  } catch {
    return null;
  }
}

/** Write an export next to the model so the user can find it in Files. */
export async function writeExportManifest(name: string, contents: string): Promise<string | null> {
  if (!isNative()) return null;
  const path = `exports/${name}`;
  await Filesystem.mkdir({ path: 'exports', directory: Directory.Data, recursive: true }).catch(
    () => undefined,
  );
  await Filesystem.writeFile({
    path,
    directory: Directory.Data,
    data: contents,
    encoding: Encoding.UTF8,
  });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Data });
  return uri;
}
