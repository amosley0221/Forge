import type { PendingTask } from './generation.js';
import type { EnginePreset } from './types.js';

/**
 * Persistence is injected by each app: Capacitor Preferences on Android, the
 * OS keychain (via Tauri) on desktop, localStorage in a browser. Core never
 * reaches for a global itself, so the same settings code runs everywhere.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Secrets go in a separate store so they can be kept out of synced storage. */
export type SecretStore = KeyValueStore;

export interface ProjectSettings {
  /** Empty until the user names their project during first run. */
  projectName: string;
  engine: EnginePreset['name'];
  style: string;
  triBudget: number;
  creatureTriBudget: number;
  /**
   * Base-colour map size asked of the provider. It was declared here but never
   * sent, so every model came back at whatever the provider defaulted to.
   */
  textureSize: 2048 | 4096;
  /**
   * Run the provider's texture stage after the mesh. Off gives bare grey
   * geometry — no face, no clothing colour — and costs one task instead of two.
   */
  textured: boolean;
  /** Slowly spin the model when the viewer is left alone. */
  turntable: boolean;
  autoClips: boolean;
  lodLevels: number;
  guide: boolean;
}

export const DEFAULT_SETTINGS: ProjectSettings = {
  projectName: '',
  engine: 'Unity',
  style: 'toon',
  triBudget: 20000,
  creatureTriBudget: 8000,
  textureSize: 2048,
  textured: true,
  turntable: true,
  autoClips: true,
  lodLevels: 4,
  guide: true,
};

export interface ProviderCredentials {
  /** Which 3D generation provider the user connected. */
  provider: 'meshy' | 'tripo' | null;
  /** Present only in memory and in the secret store — never in project state. */
  apiKey: string | null;
}

const SETTINGS_KEY = 'forge.settings.v1';
const PROVIDER_KEY = 'forge.provider.v1';
const SECRET_KEY = 'forge.provider.apiKey';
const ONBOARDED_KEY = 'forge.onboarded.v1';
const PENDING_KEY = 'forge.pendingTasks.v1';
const SYNC_KEY = 'forge.sync.v1';
const SYNC_TOKEN_KEY = 'forge.sync.token';

export async function loadSettings(store: KeyValueStore): Promise<ProjectSettings> {
  const raw = await store.get(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<ProjectSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(store: KeyValueStore, s: ProjectSettings): Promise<void> {
  await store.set(SETTINGS_KEY, JSON.stringify(s));
}

export async function loadProvider(
  store: KeyValueStore,
  secrets: SecretStore,
): Promise<ProviderCredentials> {
  const provider = (await store.get(PROVIDER_KEY)) as ProviderCredentials['provider'];
  if (!provider) return { provider: null, apiKey: null };
  const apiKey = await secrets.get(SECRET_KEY);
  return { provider, apiKey };
}

export async function saveProvider(
  store: KeyValueStore,
  secrets: SecretStore,
  creds: ProviderCredentials,
): Promise<void> {
  if (!creds.provider || !creds.apiKey) {
    await store.remove(PROVIDER_KEY);
    await secrets.remove(SECRET_KEY);
    return;
  }
  await store.set(PROVIDER_KEY, creds.provider);
  await secrets.set(SECRET_KEY, creds.apiKey);
}

export async function hasOnboarded(store: KeyValueStore): Promise<boolean> {
  return (await store.get(ONBOARDED_KEY)) === '1';
}

export async function setOnboarded(store: KeyValueStore): Promise<void> {
  await store.set(ONBOARDED_KEY, '1');
}

/* ------------------------------------------------------------------ *
 * GitHub-backed library sync
 * ------------------------------------------------------------------ */

export interface SyncConfig {
  owner: string;
  repo: string;
  branch: string;
  /** Off until the user connects a repository. */
  enabled: boolean;
}

export const DEFAULT_SYNC: SyncConfig = {
  owner: '',
  repo: '',
  branch: 'main',
  enabled: false,
};

export async function loadSync(store: KeyValueStore): Promise<SyncConfig> {
  const raw = await store.get(SYNC_KEY);
  if (!raw) return { ...DEFAULT_SYNC };
  try {
    return { ...DEFAULT_SYNC, ...(JSON.parse(raw) as Partial<SyncConfig>) };
  } catch {
    return { ...DEFAULT_SYNC };
  }
}

export async function saveSync(store: KeyValueStore, cfg: SyncConfig): Promise<void> {
  await store.set(SYNC_KEY, JSON.stringify(cfg));
}

/** The GitHub token lives beside the provider key, never in project state. */
export const loadSyncToken = (secrets: SecretStore) => secrets.get(SYNC_TOKEN_KEY);
export const saveSyncToken = (secrets: SecretStore, token: string) =>
  secrets.set(SYNC_TOKEN_KEY, token);
export const clearSyncToken = (secrets: SecretStore) => secrets.remove(SYNC_TOKEN_KEY);

/* ------------------------------------------------------------------ *
 * Paid-but-unfinished provider tasks
 * ------------------------------------------------------------------ */

/**
 * A provider charges the moment it accepts a job, so the task id is written
 * down before anything else can go wrong. If the download or the mesh import
 * then fails, the job can be picked up again instead of paid for twice.
 */
export async function loadPendingTasks(store: KeyValueStore): Promise<PendingTask[]> {
  const raw = await store.get(PENDING_KEY);
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as PendingTask[]) : [];
  } catch {
    return [];
  }
}

export async function savePendingTasks(
  store: KeyValueStore,
  tasks: PendingTask[],
): Promise<void> {
  // Keep the list short; an old task's download URL expires anyway.
  await store.set(PENDING_KEY, JSON.stringify(tasks.slice(-20)));
}

/** Browser/WebView fallback. Both apps override it with platform storage. */
export function memoryBackedLocalStore(): KeyValueStore {
  const mem = new Map<string, string>();
  const ls = () => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
      return null;
    }
  };
  return {
    async get(k) {
      return ls()?.getItem(k) ?? mem.get(k) ?? null;
    },
    async set(k, v) {
      mem.set(k, v);
      try {
        ls()?.setItem(k, v);
      } catch {
        /* private mode — memory only for this session */
      }
    },
    async remove(k) {
      mem.delete(k);
      try {
        ls()?.removeItem(k);
      } catch {
        /* ignore */
      }
    },
  };
}
