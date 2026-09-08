import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ANIMS,
  createLocalTransport,
  createRemoteTransport,
  gerund,
  randomTris,
  uid,
} from '@forge/core';
import type {
  Asset,
  AssetClip,
  AssetVersion,
  Category,
  ClipName,
  ClipStatus,
  DeviceKind,
  Kind,
  RemoteConfig,
  SyncMeta,
  SyncTransport,
} from '@forge/core';

export interface UseForgeOptions {
  device: DeviceKind;
  /** Omit to run fully local (offline / demo). */
  remote?: RemoteConfig;
  /** Label shown next to the sync dot, e.g. "Synced · Android". */
  syncedLabel: string;
}

export interface NewAssetInput {
  name: string;
  category: Category;
  kind: Kind;
  variant?: number;
  tris?: string;
  mats?: number;
  note: string;
  size: string;
  prompt: string;
  anims?: AssetClip[];
}

/**
 * Everything both apps share: the asset list, its sync transport, the
 * generation job runner and the version/clip mutations. Presentation stays in
 * each app; this is the part that must behave identically on both.
 */
export function useForge({ device, remote, syncedLabel }: UseForgeOptions) {
  const transport = useMemo<SyncTransport>(
    () => (remote ? createRemoteTransport(remote) : createLocalTransport()),
    // A transport owns sockets and listeners; rebuild it only if the target changes.
    [remote?.apiUrl, remote?.projectId, remote?.deviceId],
  );

  const [assets, setAssets] = useState<Asset[]>(() => transport.load());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [sync, setSync] = useState({ label: syncedLabel, ok: true });
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activePrompt, setActivePrompt] = useState('');

  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const jobTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const assetsRef = useRef(assets);
  assetsRef.current = assets;

  const say = useCallback((t: string) => {
    setToast(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  const flashSync = useCallback(() => {
    setSync({ label: 'Syncing…', ok: false });
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => setSync({ label: syncedLabel, ok: true }), 900);
  }, [syncedLabel]);

  useEffect(() => {
    const off = transport.subscribe((next, meta) => {
      setAssets(next);
      if (meta?.remote) {
        flashSync();
        if (meta.from && meta.from !== device) say(meta.msg || `Update received from ${meta.from}`);
      }
    });
    return () => {
      off();
      clearTimeout(toastTimer.current);
      clearTimeout(syncTimer.current);
      clearInterval(jobTimer.current);
    };
  }, [transport, device, flashSync, say]);

  const commit = useCallback(
    (next: Asset[], meta: SyncMeta = {}) => {
      setAssets(next);
      transport.save(next, { from: device, ...meta });
      flashSync();
    },
    [transport, device, flashSync],
  );

  const upsert = useCallback(
    (asset: Asset, msg?: string) => {
      const rest = assetsRef.current.filter((a) => a.id !== asset.id);
      commit([{ ...asset, updatedAt: Date.now() }, ...rest], msg ? { msg } : {});
    },
    [commit],
  );

  const active = useMemo(
    () => assets.find((a) => a.id === activeId) ?? null,
    [assets, activeId],
  );

  /**
   * Drives the five-stage progress overlay. Replace the interval with
   * `agentClient.watch(jobId, …)` once the server is live; the callback
   * contract is the same.
   */
  const runJob = useCallback((prompt: string, onDone: () => void) => {
    setGenerating(true);
    setProgress(0);
    setActivePrompt(prompt);
    clearInterval(jobTimer.current);
    jobTimer.current = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 4 + Math.random() * 6);
        if (next >= 100) {
          clearInterval(jobTimer.current);
          setGenerating(false);
          onDone();
          return 100;
        }
        return next;
      });
    }, 110);
  }, []);

  const newAsset = useCallback(
    (input: NewAssetInput): Asset => {
      const asset: Asset = {
        id: uid(),
        name: input.name,
        category: input.category,
        kind: input.kind,
        variant: input.variant ?? 0,
        device,
        updatedAt: Date.now(),
        cur: 0,
        anims: input.anims ?? [],
        versions: [
          {
            label: 'v1',
            tris: input.tris ?? randomTris(),
            mats: input.mats ?? 2,
            note: input.note,
            size: input.size,
            prompt: input.prompt,
            device,
          },
        ],
      };
      upsert(asset, `${asset.name} created on ${device}`);
      return asset;
    },
    [device, upsert],
  );

  const addVersion = useCallback(
    (asset: Asset, patch: Partial<AssetVersion>, msg?: string) => {
      const base = asset.versions[asset.cur];
      const versions = [
        ...asset.versions,
        { ...base, ...patch, label: 'v' + (asset.versions.length + 1), device },
      ];
      upsert({ ...asset, versions, cur: versions.length - 1 }, msg);
      return versions;
    },
    [device, upsert],
  );

  const undoLast = useCallback(
    (asset: Asset) => {
      if (asset.versions.length < 2) return null;
      const versions = asset.versions.slice(0, -1);
      upsert({ ...asset, versions, cur: versions.length - 1 });
      const label = versions[versions.length - 1].label;
      say('Reverted to ' + label);
      return label;
    },
    [upsert, say],
  );

  const setClipStatus = useCallback(
    (asset: Asset, name: ClipName, status: ClipStatus, msg?: string) => {
      const anims = (asset.anims || []).some((c) => c.name === name)
        ? (asset.anims || []).map((c) => (c.name === name ? { ...c, status } : c))
        : [...(asset.anims || []), { name, status }];
      upsert({ ...asset, anims }, msg);
    },
    [upsert],
  );

  const selectVersion = useCallback(
    (asset: Asset, index: number) => upsert({ ...asset, cur: index }),
    [upsert],
  );

  const clipsFor = useCallback((kind: Kind): ClipName[] => ANIMS[kind] ?? ['idle'], []);

  return {
    assets,
    active,
    activeId,
    setActiveId,
    clipsFor,
    commit,
    upsert,
    newAsset,
    addVersion,
    undoLast,
    setClipStatus,
    selectVersion,
    runJob,
    generating,
    progress,
    activePrompt,
    toast,
    say,
    sync,
    pendingSync: transport.pending?.() ?? 0,
    gerund,
  };
}
