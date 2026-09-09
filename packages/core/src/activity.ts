import type { DeviceKind } from './types.js';
import type { KeyValueStore } from './settings.js';

/**
 * A record of what actually happened to the library, and where.
 *
 * "Last changed 2h ago" answers when but not what, and once two devices share
 * a library that is the more useful half: whether the change you are looking at
 * is the rig you started on the desktop or something the phone did.
 *
 * Entries are facts about the past, so they are never edited — merging two
 * devices' logs is a union, and the only thing ever dropped is the oldest.
 */

export interface ActivityEntry {
  /** Stable across devices, so a merge cannot duplicate an entry. */
  id: string;
  at: number;
  device: DeviceKind;
  /** Already written for a person: "Rover rigged", "Rover: Run clip added". */
  message: string;
  /** The asset it happened to, when it was about one. */
  assetId?: string;
}

/** Enough to cover real use without bloating the synced manifest. */
export const ACTIVITY_LIMIT = 200;

const ACTIVITY_KEY = 'forge.activity.v1';

export function newActivity(
  message: string,
  device: DeviceKind,
  assetId?: string,
): ActivityEntry {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    device,
    message,
    ...(assetId ? { assetId } : {}),
  };
}

/** Newest first, capped. */
export const appendActivity = (log: ActivityEntry[], entry: ActivityEntry): ActivityEntry[] =>
  [entry, ...log].slice(0, ACTIVITY_LIMIT);

/**
 * Union two devices' logs. Neither side can delete the other's history — a
 * device that has been offline for a week still contributes everything it did.
 */
export function mergeActivity(a: ActivityEntry[], b: ActivityEntry[]): ActivityEntry[] {
  const byId = new Map<string, ActivityEntry>();
  for (const entry of [...a, ...b]) {
    if (entry?.id) byId.set(entry.id, entry);
  }
  return [...byId.values()].sort((x, y) => y.at - x.at).slice(0, ACTIVITY_LIMIT);
}

export async function loadActivity(store: KeyValueStore): Promise<ActivityEntry[]> {
  const raw = await store.get(ACTIVITY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ActivityEntry[]) : [];
  } catch {
    return [];
  }
}

export const saveActivity = (store: KeyValueStore, log: ActivityEntry[]): Promise<void> =>
  store.set(ACTIVITY_KEY, JSON.stringify(log.slice(0, ACTIVITY_LIMIT)));
