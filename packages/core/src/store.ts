import type { Asset, SyncMeta } from './types.js';

const KEY = 'forge.assets.v1';
const QUEUE_KEY = 'forge.queue.v1';
const CHANNEL = 'forge-assets';

export type StoreListener = (assets: Asset[], meta: SyncMeta) => void;

/**
 * A transport moves asset state between devices. The local transport keeps
 * everything in this browser/WebView (localStorage + BroadcastChannel) and is
 * also the offline layer under the remote transport.
 */
export interface SyncTransport {
  load(): Asset[];
  save(assets: Asset[], meta: SyncMeta): void;
  subscribe(fn: StoreListener): () => void;
  /** Mutations waiting to be replayed against the server. */
  pending?(): number;
  dispose?(): void;
}

function readLocal(): Asset[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (Array.isArray(v)) return v as Asset[];
  } catch {
    /* corrupt or unavailable storage — start empty rather than guess */
  }
  return null;
}

function writeLocal(assets: Asset[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(assets));
  } catch {
    /* quota or private mode — state stays in memory for this session */
  }
}

export function createLocalTransport(): SyncTransport {
  const subs = new Set<StoreListener>();
  const chan =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;

  const notify = (assets: Asset[], meta: SyncMeta) => {
    subs.forEach((fn) => {
      try {
        fn(assets, meta);
      } catch {
        /* a bad listener must not stop the others */
      }
    });
  };

  if (chan) {
    chan.onmessage = (e: MessageEvent) =>
      notify(e.data.assets, { ...e.data.meta, remote: true });
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) notify(readLocal() || [], { remote: true });
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);

  return {
    load() {
      // A fresh install has no assets. Nothing is seeded — the library is
      // empty until the user generates or imports something.
      return readLocal() ?? [];
    },
    save(assets, meta) {
      writeLocal(assets);
      notify(assets, meta);
      chan?.postMessage({ assets, meta });
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    dispose() {
      chan?.close();
      if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
      subs.clear();
    },
  };
}

export interface RemoteConfig {
  /** Base URL of the Forge API, e.g. https://api.forge.dev */
  apiUrl: string;
  projectId: string;
  /** Bearer token for the signed-in account. */
  token: () => string | null;
  /** Identifies this client so its own echoes are ignored. */
  deviceId: string;
  fetchImpl?: typeof fetch;
}

/**
 * Server-backed transport: writes go to the API, remote changes arrive over
 * SSE. Every mutation is mirrored into local storage first, so an offline
 * client keeps working and replays its queue in order once it reconnects.
 * Conflicts are resolved server-side by appending a sibling version — the
 * server never overwrites a version it did not create.
 */
export function createRemoteTransport(cfg: RemoteConfig): SyncTransport {
  const local = createLocalTransport();
  const subs = new Set<StoreListener>();
  const doFetch = cfg.fetchImpl ?? globalThis.fetch.bind(globalThis);
  let events: EventSource | null = null;

  const queue = (): { assets: Asset[]; meta: SyncMeta }[] => {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    } catch {
      return [];
    }
  };
  const setQueue = (q: { assets: Asset[]; meta: SyncMeta }[]) => {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-200)));
    } catch {
      /* ignore */
    }
  };

  const push = async (assets: Asset[], meta: SyncMeta): Promise<boolean> => {
    const token = cfg.token();
    if (!token) return false;
    try {
      const res = await doFetch(`${cfg.apiUrl}/projects/${cfg.projectId}/assets`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          'x-forge-device': cfg.deviceId,
        },
        body: JSON.stringify({ assets, meta }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const drain = async () => {
    const q = queue();
    while (q.length) {
      const head = q[0];
      if (!(await push(head.assets, head.meta))) break;
      q.shift();
      setQueue(q);
    }
  };

  const notify = (assets: Asset[], meta: SyncMeta) =>
    subs.forEach((fn) => {
      try {
        fn(assets, meta);
      } catch {
        /* ignore */
      }
    });

  const connect = () => {
    if (typeof EventSource === 'undefined') return;
    const token = cfg.token();
    if (!token) return;
    events = new EventSource(
      `${cfg.apiUrl}/projects/${cfg.projectId}/stream?token=${encodeURIComponent(token)}`,
    );
    events.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data) as { assets: Asset[]; meta: SyncMeta; deviceId?: string };
        if (payload.deviceId === cfg.deviceId) return; // our own echo
        local.save(payload.assets, { ...payload.meta, remote: true });
        notify(payload.assets, { ...payload.meta, remote: true });
      } catch {
        /* malformed frame — the next one will resync */
      }
    };
    events.onerror = () => {
      events?.close();
      events = null;
      setTimeout(connect, 4000);
    };
  };

  connect();
  if (typeof window !== 'undefined') window.addEventListener('online', drain);
  void drain();

  return {
    load: () => local.load(),
    save(assets, meta) {
      local.save(assets, meta);
      void push(assets, meta).then((ok) => {
        if (!ok) setQueue([...queue(), { assets, meta }]);
      });
    },
    subscribe(fn) {
      subs.add(fn);
      const off = local.subscribe(fn);
      return () => {
        subs.delete(fn);
        off();
      };
    },
    pending: () => queue().length,
    dispose() {
      events?.close();
      if (typeof window !== 'undefined') window.removeEventListener('online', drain);
      local.dispose?.();
      subs.clear();
    },
  };
}
