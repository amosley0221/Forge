import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  appendVersion,
  clipsFromStats,
  createLocalTransport,
  createRemoteTransport,
  hasOnboarded,
  loadProvider,
  loadSettings,
  nameFrom,
  providerById,
  stylePhrase,
  animateModel,
  awaitTask,
  currentVersion,
  loadPendingTasks,
  savePendingTasks,
  appendActivity,
  loadActivity,
  mergeActivity,
  newActivity,
  saveActivity,
  checkAccess,
  clearSyncToken,
  downloadModel,
  fetchLibrary,
  loadSync,
  loadSyncToken,
  mergeLibraries,
  pushLibrary,
  readBlob,
  saveSync,
  saveSyncToken,
  uploadModel,
  listActions,
  listRecentJobs,
  meshyRawTaskId,
  rigModel,
  runGeneration,
  startRetexture,
  saveProvider,
  saveSettings,
  setOnboarded,
} from '@forge/core';
import type {
  ActivityEntry,
  Asset,
  MeshyAction,
  PendingTask,
  ProviderJob,
  AssetVersion,
  BlobStore,
  Category,
  ClipStatus,
  DeviceKind,
  GenerationEvent,
  KeyValueStore,
  MeshStats,
  ProjectSettings,
  GitHubConfig,
  ProviderCredentials,
  RemoteConfig,
  SyncConfig,
  SecretStore,
  SyncMeta,
  SyncTransport,
} from '@forge/core';
import { KINDS } from '@forge/core';
import { readMeshStats } from './viewer/engine.js';

export interface UseForgeOptions {
  device: DeviceKind;
  store: KeyValueStore;
  secrets: SecretStore;
  blobs: BlobStore;
  remote?: RemoteConfig;
}

export interface JobState {
  running: boolean;
  label: string;
  percent: number;
  phase: GenerationEvent['phase'] | 'idle';
  error: string | null;
}

const IDLE_JOB: JobState = { running: false, label: '', percent: 0, phase: 'idle', error: null };

/**
 * Everything both apps share: the library, its sync transport, persisted
 * settings and provider credentials, and the real generation/import paths.
 * No demo data is ever inserted — a fresh install starts empty.
 */
export function useForge({ device, store, secrets, blobs, remote }: UseForgeOptions) {
  const transport = useMemo<SyncTransport>(
    () => (remote ? createRemoteTransport(remote) : createLocalTransport()),
    [remote?.apiUrl, remote?.projectId, remote?.deviceId],
  );

  const [assets, setAssets] = useState<Asset[]>(() => transport.load());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settings, setSettingsState] = useState<ProjectSettings>(DEFAULT_SETTINGS);
  const [credentials, setCredentials] = useState<ProviderCredentials>({ provider: null, apiKey: null });
  const [onboarded, setOnboardedState] = useState<boolean | null>(null);
  const [job, setJob] = useState<JobState>(IDLE_JOB);
  const [toast, setToast] = useState('');
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTask[]>([]);
  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(null);
  const [syncToken, setSyncToken] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<{
    status: 'off' | 'idle' | 'syncing' | 'error';
    lastSyncedAt: number | null;
    message: string | null;
  }>({ status: 'off', lastSyncedAt: null, message: null });

  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);
  const assetsRef = useRef(assets);
  assetsRef.current = assets;

  /* ---------------------------------------------------------------- */
  /* Persisted state                                                    */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [s, c, done, tasks, sync, token, log] = await Promise.all([
        loadSettings(store),
        loadProvider(store, secrets),
        hasOnboarded(store),
        loadPendingTasks(store),
        loadSync(store),
        loadSyncToken(secrets),
        loadActivity(store),
      ]);
      if (!alive) return;
      activityRef.current = log;
      setActivity(log);
      setSettingsState(s);
      setCredentials(c);
      setOnboardedState(done);
      setPending(tasks);
      setSyncConfig(sync);
      setSyncToken(token);
      setSyncState((prev) => ({
        ...prev,
        status: sync.enabled && token ? 'idle' : 'off',
      }));
    })();
    return () => {
      alive = false;
    };
  }, [store, secrets]);

  const say = useCallback((t: string) => {
    setToast(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<ProjectSettings>) => {
      setSettingsState((prev) => {
        const next = { ...prev, ...patch };
        void saveSettings(store, next);
        return next;
      });
    },
    [store],
  );

  const connectProvider = useCallback(
    async (creds: ProviderCredentials) => {
      await saveProvider(store, secrets, creds);
      setCredentials(creds);
    },
    [store, secrets],
  );

  const finishOnboarding = useCallback(async () => {
    await setOnboarded(store);
    setOnboardedState(true);
  }, [store]);

  /* ---------------------------------------------------------------- */
  /* Library                                                            */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const off = transport.subscribe((next, meta) => {
      setAssets(next);
      if (meta?.remote && meta.from && meta.from !== device) {
        say(meta.msg || `Update received from ${meta.from}`);
      }
    });
    return () => {
      off();
      clearTimeout(toastTimer.current);
    };
  }, [transport, device, say]);

  /**
   * Every local change with a description is written into the activity log.
   * The message was already there — it just went to a toast and vanished, so
   * there was no way to see what had happened to a project.
   */
  const commit = useCallback(
    (next: Asset[], meta: SyncMeta = {}, assetId?: string) => {
      setAssets(next);
      transport.save(next, { from: device, ...meta });
      if (!meta.msg) return;
      const log = appendActivity(activityRef.current, newActivity(meta.msg, device, assetId));
      activityRef.current = log;
      setActivity(log);
      void saveActivity(store, log);
    },
    [transport, device, store],
  );

  /**
   * `touch: false` records the change without moving updatedAt — for things
   * that are not edits to the asset. Which version you happen to be looking at
   * is one: counting it made "last changed" mean "last opened", and made every
   * click on the history strip look like a change worth syncing.
   */
  const upsert = useCallback(
    (asset: Asset, msg?: string, opts: { touch?: boolean } = {}) => {
      const rest = assetsRef.current.filter((a) => a.id !== asset.id);
      const next = opts.touch === false ? asset : { ...asset, updatedAt: Date.now() };
      commit([next, ...rest], msg ? { msg } : {}, asset.id);
    },
    [commit],
  );

  const active = useMemo(() => assets.find((a) => a.id === activeId) ?? null, [assets, activeId]);
  const version = active?.versions[active.cur] ?? null;

  /** Resolve the current version's cached GLB into a URL the viewer can load. */
  useEffect(() => {
    let alive = true;
    if (!version?.fileId) {
      setModelUrl(null);
      return;
    }
    void blobs.url(version.fileId).then((url) => {
      if (alive) setModelUrl(url);
    });
    return () => {
      alive = false;
    };
  }, [version?.fileId, blobs]);

  const removeAsset = useCallback(
    async (asset: Asset) => {
      await Promise.all(
        asset.versions.filter((v) => v.fileId).map((v) => blobs.remove(v.fileId!)),
      );
      commit(
        assetsRef.current.filter((a) => a.id !== asset.id),
        { msg: `${asset.name} deleted` },
      );
      if (activeId === asset.id) setActiveId(null);
    },
    [blobs, commit, activeId],
  );

  const setClipStatus = useCallback(
    (asset: Asset, name: string, status: ClipStatus, msg?: string) => {
      const clips = asset.clips.some((c) => c.name === name)
        ? asset.clips.map((c) => (c.name === name ? { ...c, status } : c))
        : [...asset.clips, { name, status }];
      upsert({ ...asset, clips }, msg ?? `${asset.name}: ${name} marked ${status}`);
    },
    [upsert],
  );

  const selectVersion = useCallback(
    (asset: Asset, index: number) => upsert({ ...asset, cur: index }, undefined, { touch: false }),
    [upsert],
  );

  const undoLast = useCallback(
    (asset: Asset) => {
      if (asset.versions.length < 2) return null;
      const dropped = asset.versions[asset.versions.length - 1];
      if (dropped.fileId) void blobs.remove(dropped.fileId);
      const versions = asset.versions.slice(0, -1);
      upsert({ ...asset, versions, cur: versions.length - 1 }, `${asset.name}: ${dropped.label} undone`);
      say('Reverted to ' + versions[versions.length - 1].label);
      return versions[versions.length - 1].label;
    },
    [upsert, say, blobs],
  );

  /* ---------------------------------------------------------------- */
  /* GitHub-backed library sync                                         */
  /* ---------------------------------------------------------------- */

  const ghConfig = useCallback((): GitHubConfig | null => {
    if (!syncConfig?.enabled || !syncToken || !syncConfig.owner || !syncConfig.repo) return null;
    return {
      owner: syncConfig.owner,
      repo: syncConfig.repo,
      branch: syncConfig.branch || 'main',
      token: syncToken,
    };
  }, [syncConfig, syncToken]);

  const syncing = useRef(false);
  const recoverTaskRef = useRef<((task: PendingTask) => Promise<Asset | null>) | null>(null);
  // rig() is defined below generate(); a ref lets one call the other without
  // reordering the whole hook.
  const rigRef = useRef<((asset: Asset) => Promise<Asset | null>) | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const activityRef = useRef<ActivityEntry[]>([]);
  activityRef.current = activity;

  /**
   * Pull what the other device wrote, push what this one has. Model files are
   * immutable and addressed by id, so they are only ever uploaded once; the
   * manifest is the only thing that changes.
   *
   * Nothing is deleted by a sync — an asset the other side has not seen is
   * treated as new, never as removed — so a stale device cannot wipe the
   * library.
   */
  const syncNow = useCallback(
    async (opts: { quiet?: boolean } = {}): Promise<boolean> => {
      const cfg = ghConfig();
      if (!cfg || syncing.current) return false;
      syncing.current = true;
      setSyncState((p) => ({ ...p, status: 'syncing', message: null }));

      try {
        const { manifest, sha } = await fetchLibrary(cfg);
        const remoteAssets = manifest?.assets ?? [];

        // The other device's history is as real as this one's, so the log is a
        // union — neither side can erase what the other did.
        const mergedActivity = mergeActivity(activityRef.current, manifest?.activity ?? []);
        if (mergedActivity.length !== activityRef.current.length) {
          activityRef.current = mergedActivity;
          setActivity(mergedActivity);
          void saveActivity(store, mergedActivity);
        }
        const merged = mergeLibraries(assetsRef.current, remoteAssets);
        const knownFiles = new Set(manifest?.files ?? []);

        // Fetch any model this device is missing.
        for (const asset of merged) {
          for (const v of asset.versions) {
            if (!v.fileId) continue;
            if (await blobs.has(v.fileId)) continue;
            const blob = await downloadModel(cfg, v.fileId);
            if (blob) {
              await blobs.put(v.fileId, blob);
              knownFiles.add(v.fileId);
            }
          }
        }

        // Upload any model the repo is missing. The manifest lists what is
        // already there, so a settled library uploads nothing and asks nothing.
        for (const asset of merged) {
          for (const v of asset.versions) {
            if (!v.fileId || knownFiles.has(v.fileId)) continue;
            if (!(await blobs.has(v.fileId))) continue;
            const blob = await readBlob(blobs, v.fileId);
            if (!blob) continue;
            await uploadModel(cfg, v.fileId, blob);
            knownFiles.add(v.fileId);
          }
        }

        const filesChanged = knownFiles.size !== (manifest?.files?.length ?? -1);
        const changed =
          filesChanged ||
          mergedActivity.length !== (manifest?.activity?.length ?? -1) ||
          merged.length !== remoteAssets.length ||
          merged.some((a) => {
            const r = remoteAssets.find((x) => x.id === a.id);
            return !r || r.updatedAt !== a.updatedAt;
          });

        if (changed) {
          await pushLibrary(
            cfg,
            {
              version: 1,
              updatedAt: Date.now(),
              device,
              assets: merged,
              files: [...knownFiles],
              activity: mergedActivity,
            },
            sha,
          );
        }

        // Adopt the merged view locally.
        const remoteBrought = merged.length - assetsRef.current.length;
        if (changed || remoteBrought !== 0) {
          setAssets(merged);
          transport.save(merged, { from: device });
        }

        setSyncState({ status: 'idle', lastSyncedAt: Date.now(), message: null });
        if (!opts.quiet && remoteBrought > 0) {
          say(`Synced — ${remoteBrought} asset${remoteBrought > 1 ? 's' : ''} pulled in`);
        }
        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Sync failed';
        setSyncState((p) => ({ ...p, status: 'error', message }));
        if (!opts.quiet) say(message);
        return false;
      } finally {
        syncing.current = false;
      }
    },
    [ghConfig, blobs, device, transport, say],
  );

  const connectSync = useCallback(
    async (cfg: SyncConfig, token: string): Promise<{ ok: boolean; message: string }> => {
      const check = await checkAccess({ ...cfg, branch: cfg.branch || 'main', token });
      if (!check.ok) return check;
      // Use whatever the repository actually calls its default branch.
      const next = {
        ...cfg,
        branch: check.defaultBranch || cfg.branch || 'main',
        enabled: true,
      };
      await saveSync(store, next);
      await saveSyncToken(secrets, token);
      setSyncConfig(next);
      setSyncToken(token);
      setSyncState({ status: 'idle', lastSyncedAt: null, message: null });
      return check;
    },
    [store, secrets],
  );

  const disconnectSync = useCallback(async () => {
    const next = { ...(syncConfig ?? { owner: '', repo: '', branch: 'main' }), enabled: false };
    await saveSync(store, next as SyncConfig);
    await clearSyncToken(secrets);
    setSyncConfig(next as SyncConfig);
    setSyncToken(null);
    setSyncState({ status: 'off', lastSyncedAt: null, message: null });
  }, [store, secrets, syncConfig]);

  // Sync as soon as a connected config loads, and again whenever the window
  // regains focus — which is what makes "open it and the latest is there" true
  // on both platforms, including an Android app resuming from the background.
  useEffect(() => {
    if (!syncConfig?.enabled || !syncToken) return;
    void syncNow({ quiet: true });

    const onFocus = () => void syncNow({ quiet: true });
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onFocus);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
        document.removeEventListener('visibilitychange', onFocus);
      }
    };
  }, [syncConfig?.enabled, syncConfig?.owner, syncConfig?.repo, syncToken, syncNow]);

  /* ---------------------------------------------------------------- */
  /* Paid-but-unfinished tasks                                          */
  /* ---------------------------------------------------------------- */

  const rememberTask = useCallback(
    (task: PendingTask) => {
      setPending((prev) => {
        const next = [...prev.filter((t) => t.taskId !== task.taskId), task];
        void savePendingTasks(store, next);
        return next;
      });
    },
    [store],
  );

  const forgetTask = useCallback(
    (taskId: string) => {
      setPending((prev) => {
        const next = prev.filter((t) => t.taskId !== taskId);
        void savePendingTasks(store, next);
        return next;
      });
    },
    [store],
  );

  const markTaskFailed = useCallback(
    (taskId: string, error: string) => {
      setPending((prev) => {
        const next = prev.map((t) => (t.taskId === taskId ? { ...t, error } : t));
        void savePendingTasks(store, next);
        return next;
      });
    },
    [store],
  );

  /* ---------------------------------------------------------------- */
  /* Import and generation — the only two ways an asset comes to exist  */
  /* ---------------------------------------------------------------- */

  const storeModel = useCallback(
    async (blob: Blob): Promise<{ fileId: string; stats: MeshStats }> => {
      const fileId = 'm' + Math.random().toString(36).slice(2, 10);
      await blobs.put(fileId, blob);
      const url = await blobs.url(fileId);
      if (!url) throw new Error('Could not read the model back after saving it');
      const stats = await readMeshStats(url);
      return { fileId, stats: { ...stats, bytes: blob.size } };
    },
    [blobs],
  );

  /** Import a .glb/.gltf the user already has. Works with no provider key. */
  const importModel = useCallback(
    async (file: File, category: Category = 'Prop'): Promise<Asset | null> => {
      setJob({ running: true, label: `Reading ${file.name}`, percent: 40, phase: 'importing', error: null });
      try {
        const { fileId, stats } = await storeModel(file);
        const asset: Asset = {
          id: 'a' + Math.random().toString(36).slice(2, 10),
          name: nameFrom(file.name),
          category,
          kind: KINDS[category],
          device,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          cur: 0,
          versions: [
            {
              label: 'v1',
              note: `imported from ${file.name}`,
              prompt: '',
              device,
              createdAt: Date.now(),
              stats,
              fileId,
            },
          ],
          clips: clipsFromStats(stats),
        };
        upsert(asset, `${asset.name} imported on ${device}`);
        setJob(IDLE_JOB);
        return asset;
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Import failed';
        setJob({ ...IDLE_JOB, error });
        say(error);
        return null;
      }
    },
    [storeModel, device, upsert, say],
  );

  const cancelJob = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
    setJob(IDLE_JOB);
  }, []);

  /**
   * Turn a finished provider result into a stored asset or version. Shared by
   * a fresh generation and by resuming a task that was already paid for.
   */
  const landResult = useCallback(
    async (
      result: { blob: Blob; modelUrl: string; taskId: string },
      opts: {
        prompt: string;
        category: Category;
        fromImage?: boolean;
        target?: Asset;
        note?: string;
        providerId: 'meshy' | 'tripo';
      },
    ): Promise<Asset> => {
      const { fileId, stats } = await storeModel(result.blob);

      if (opts.target) {
        const updated = appendVersion(opts.target, {
          note: opts.note ?? 'prompt edit',
          prompt: opts.prompt,
          device,
          createdAt: Date.now(),
          stats,
          fileId,
          sourceUrl: result.modelUrl,
          provider: opts.providerId,
          taskId: result.taskId,
        });
        upsert(
          { ...updated, clips: mergeClips(updated.clips, stats) },
          `${updated.name} ${updated.versions[updated.cur].label} created on ${device}`,
        );
        return updated;
      }

      const asset: Asset = {
        id: 'a' + Math.random().toString(36).slice(2, 10),
        name: nameFrom(opts.prompt || 'asset'),
        category: opts.category,
        kind: KINDS[opts.category],
        device,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        cur: 0,
        versions: [
          {
            label: 'v1',
            note: opts.fromImage ? 'generated from image' : 'generated from prompt',
            prompt: opts.prompt,
            device,
            createdAt: Date.now(),
            stats,
            fileId,
            sourceUrl: result.modelUrl,
            provider: opts.providerId,
            taskId: result.taskId,
          },
        ],
        clips: clipsFromStats(stats),
      };
      upsert(asset, `${asset.name} created on ${device}`);
      return asset;
    },
    [storeModel, device, upsert],
  );

  /**
   * Generate a new asset, or a new version of an existing one, using the
   * user's provider key. Progress comes from the provider.
   *
   * The task id is recorded the instant the provider accepts the job, because
   * that is when it charges. If anything after that fails the job stays in the
   * pending list and can be finished with `recoverTask` — the user is never
   * asked to pay twice for a model the provider already built.
   */
  const generate = useCallback(
    async (opts: {
      prompt: string;
      category: Category;
      imageUrl?: string;
      /** Several views of one subject; beats a single view by a long way. */
      imageUrls?: string[];
      /** When set, the result becomes a new version of this asset. */
      target?: Asset;
      note?: string;
    }): Promise<Asset | null> => {
      const provider = providerById(credentials.provider);
      if (!provider || !credentials.apiKey) {
        const error = 'Connect a 3D provider in Settings before generating.';
        setJob({ ...IDLE_JOB, error });
        say(error);
        return null;
      }

      const controller = new AbortController();
      abort.current = controller;
      setJob({ running: true, label: 'Starting', percent: 0, phase: 'submitting', error: null });

      // Both stages are charged separately, so both ids are written down and
      // both stay recoverable until a model actually lands.
      const paidTasks: string[] = [];
      const source: 'text' | 'image' =
        opts.imageUrl || opts.imageUrls?.length ? 'image' : 'text';

      try {
        const result = await runGeneration({
          provider,
          apiKey: credentials.apiKey,
          source,
          prompt: opts.prompt,
          style: stylePhrase(settings.style),
          triBudget:
            KINDS[opts.category] === 'creature' ? settings.creatureTriBudget : settings.triBudget,
          imageUrl: opts.imageUrl,
          imageUrls: opts.imageUrls,
          texture: settings.textured,
          textureResolution: settings.textureSize >= 4096 ? '4k' : '2k',
          texturePrompt: [opts.prompt, stylePhrase(settings.style)].filter(Boolean).join(', '),
          signal: controller.signal,
          onTaskCreated: (id) => {
            paidTasks.push(id);
            rememberTask({
              taskId: id,
              provider: provider.id,
              prompt: opts.prompt,
              category: opts.category,
              source,
              createdAt: Date.now(),
            });
          },
          onEvent: (e) =>
            setJob({ running: true, label: e.label, percent: e.percent, phase: e.phase, error: null }),
        });

        const asset = await landResult(result, {
          prompt: opts.prompt,
          category: opts.category,
          fromImage: source === 'image',
          target: opts.target,
          note: opts.note,
          providerId: provider.id,
        });

        paidTasks.forEach(forgetTask);
        forgetTask(result.taskId);
        abort.current = null;

        // Chain straight into rigging when asked. Only for a fresh character or
        // creature: rigging a prop wastes the credits, and a new version of an
        // existing asset is an edit rather than something to re-rig.
        const kind = KINDS[opts.category];
        const autoRig =
          settings.autoRig &&
          provider.id === 'meshy' &&
          !opts.target &&
          (kind === 'character' || kind === 'creature');
        if (autoRig && rigRef.current) {
          // A rig failure leaves the model itself safely landed.
          const rigged = await rigRef.current(asset);
          return rigged ?? asset;
        }

        setJob(IDLE_JOB);
        return asset;
      } catch (e) {
        abort.current = null;
        const cancelled = e instanceof DOMException && e.name === 'AbortError';
        const error = cancelled
          ? 'Cancelled'
          : e instanceof Error
            ? e.message
            : 'Generation failed';
        // Mark only the stage that was actually in flight.
        const lastTask = paidTasks[paidTasks.length - 1];
        if (lastTask) markTaskFailed(lastTask, error);
        if (cancelled) {
          setJob(IDLE_JOB);
          return null;
        }
        setJob({ ...IDLE_JOB, error });
        return null;
      }
    },
    [credentials, settings, landResult, rememberTask, forgetTask, markTaskFailed, say],
  );

  /**
   * Everything this provider key has generated, including jobs Forge never
   * saw — API jobs do not show up in Meshy's web workspace, so this is the
   * only way to find a model you paid for and lost.
   */
  const listProviderJobs = useCallback(async (): Promise<ProviderJob[]> => {
    if (credentials.provider !== 'meshy' || !credentials.apiKey) {
      say('Listing past jobs needs a connected Meshy key.');
      return [];
    }
    try {
      return await listRecentJobs(credentials.apiKey);
    } catch (e) {
      say(e instanceof Error ? e.message : 'Could not list your jobs');
      return [];
    }
  }, [credentials, say]);

  /** Pull one of those jobs into the library. Downloads only — no new task. */
  const importProviderJob = useCallback(
    async (job: ProviderJob): Promise<Asset | null> =>
      recoverTaskRef.current?.({
        taskId: job.taskId,
        provider: 'meshy',
        prompt: job.prompt === '(no prompt)' ? '' : job.prompt,
        category: 'Prop',
        source: job.source,
        createdAt: job.createdAt || Date.now(),
      }) ?? null,
    [],
  );

  /**
   * Finish a task the provider already built and charged for. No new task is
   * submitted, so this costs nothing.
   */
  const recoverTask = useCallback(
    async (task: PendingTask): Promise<Asset | null> => {
      const provider = providerById(credentials.provider);
      if (!provider || !credentials.apiKey) {
        say('Connect the same provider again to pick this up.');
        return null;
      }
      if (provider.id !== task.provider) {
        say(`This job ran on ${task.provider}; connect that provider to finish it.`);
        return null;
      }

      const controller = new AbortController();
      abort.current = controller;
      setJob({ running: true, label: 'Picking the job back up', percent: 0, phase: 'submitting', error: null });

      try {
        const result = await awaitTask({
          provider,
          apiKey: credentials.apiKey,
          taskId: task.taskId,
          signal: controller.signal,
          onEvent: (e) =>
            setJob({ running: true, label: e.label, percent: e.percent, phase: e.phase, error: null }),
        });
        let asset: Asset;
        if (task.kind === 'rig' && task.assetId) {
          // A rig is a new version of an existing asset, not a new asset.
          const target = assetsRef.current.find((a) => a.id === task.assetId);
          if (!target) throw new Error('The asset this rig belongs to is no longer here.');
          const { fileId, stats } = await storeModel(result.blob);
          const updated = appendVersion(target, {
            note: 'rigged',
            prompt: '',
            device,
            createdAt: Date.now(),
            stats,
            fileId,
            provider: 'meshy',
            taskId: currentVersion(target).taskId,
            riggedTaskId: meshyRawTaskId(task.taskId),
          });
          upsert(
            { ...updated, clips: mergeClips(updated.clips, stats) },
            `${target.name} rigged`,
          );
          asset = updated;
        } else {
          asset = await landResult(result, {
            prompt: task.prompt,
            category: task.category as Category,
            fromImage: task.source === 'image',
            providerId: provider.id,
          });
        }
        forgetTask(task.taskId);
        setJob(IDLE_JOB);
        abort.current = null;
        say('Recovered — no extra credits used.');
        return asset;
      } catch (e) {
        abort.current = null;
        if (e instanceof DOMException && e.name === 'AbortError') {
          setJob(IDLE_JOB);
          return null;
        }
        const error = e instanceof Error ? e.message : 'Could not finish the job';
        markTaskFailed(task.taskId, error);
        setJob({ ...IDLE_JOB, error });
        return null;
      }
    },
    [credentials, landResult, forgetTask, markTaskFailed, say, storeModel, device, upsert],
  );

  recoverTaskRef.current = recoverTask;

  /* ---------------------------------------------------------------- */
  /* Rigging and animation (Meshy)                                      */
  /* ---------------------------------------------------------------- */

  const requireMeshy = useCallback(() => {
    if (credentials.provider !== 'meshy' || !credentials.apiKey) {
      throw new Error('Rigging and animation need a connected Meshy key.');
    }
    return credentials.apiKey;
  }, [credentials]);

  /** Rig the current version so motion clips can be baked onto it. */
  const rig = useCallback(
    async (asset: Asset): Promise<Asset | null> => {
      const controller = new AbortController();
      abort.current = controller;
      let paidRig: string | null = null;
      try {
        const key = requireMeshy();
        const version = currentVersion(asset);
        if (!version.taskId) {
          throw new Error(
            'Only models generated by Meshy in this app can be rigged — an imported file has no Meshy task behind it.',
          );
        }
        setJob({ running: true, label: 'Preparing to rig', percent: 0, phase: 'submitting', error: null });
        const { riggedTaskId, blob } = await rigModel({
          apiKey: key,
          // Strip the `img:` marker: Meshy's rigging endpoint wants the bare id.
          inputTaskId: meshyRawTaskId(version.taskId),
          characterHeight: version.stats.sizeMeters || 1.7,
          signal: controller.signal,
          onTaskCreated: (id) => {
            paidRig = 'rig:' + id;
            rememberTask({
              taskId: paidRig,
              provider: 'meshy',
              prompt: `rig ${asset.name}`,
              category: asset.category,
              source: 'text',
              createdAt: Date.now(),
              kind: 'rig',
              assetId: asset.id,
            });
          },
          onProgress: (p) =>
            setJob({ running: true, label: p.label, percent: p.percent, phase: 'generating', error: null }),
        });
        const { fileId, stats } = await storeModel(blob);
        const updated = appendVersion(asset, {
          note: 'rigged',
          prompt: '',
          device,
          createdAt: Date.now(),
          stats,
          fileId,
          provider: 'meshy',
          taskId: version.taskId,
          riggedTaskId,
        });
        upsert({ ...updated, clips: mergeClips(updated.clips, stats) }, `${asset.name} rigged`);
        if (paidRig) forgetTask(paidRig);
        setJob(IDLE_JOB);
        abort.current = null;
        return updated;
      } catch (e) {
        abort.current = null;
        if (e instanceof DOMException && e.name === 'AbortError') {
          setJob(IDLE_JOB);
          return null;
        }
        const error = e instanceof Error ? e.message : 'Rigging failed';
        // The rig was charged for the moment Meshy accepted it, so leave it in
        // the pending list with the reason rather than losing the credits.
        if (paidRig) markTaskFailed(paidRig, error);
        setJob({ ...IDLE_JOB, error });
        say(error);
        return null;
      }
    },
    [requireMeshy, storeModel, device, upsert, say, rememberTask, forgetTask, markTaskFailed],
  );

  /**
   * Repaint the current version from a description — "dark brown skin, red
   * hoodie, blue jeans" — and land the result as a new version.
   *
   * This is what appearance editing actually is with this provider. Meshy has
   * no concept of a shirt or a face as separate editable things, so there is
   * no slider for skin tone and no way to select just the jacket: the whole
   * model is re-textured from the description. The geometry is untouched, so
   * it stays the same character, and the earlier version stays in the history.
   */
  const restyle = useCallback(
    async (asset: Asset, stylePrompt: string): Promise<Asset | null> => {
      const description = stylePrompt.trim();
      if (!description) return null;

      const controller = new AbortController();
      abort.current = controller;
      let taskId: string | null = null;
      try {
        const key = requireMeshy();
        const version = currentVersion(asset);
        if (!version.taskId) {
          throw new Error(
            'Only models generated by Meshy in this app can be restyled — an imported file has no Meshy task behind it.',
          );
        }

        setJob({ running: true, label: 'Sending the new look to Meshy', percent: 0, phase: 'submitting', error: null });
        taskId = await startRetexture(key, {
          inputTaskId: version.taskId,
          objectPrompt: version.prompt || asset.name,
          stylePrompt: description,
        });
        rememberTask({
          taskId,
          provider: 'meshy',
          prompt: description,
          category: asset.category,
          source: 'text',
          createdAt: Date.now(),
        });

        const provider = providerById('meshy')!;
        const result = await awaitTask({
          provider,
          apiKey: key,
          taskId,
          signal: controller.signal,
          onEvent: (e) =>
            setJob({
              running: true,
              label: e.phase === 'generating' ? 'Repainting the model' : e.label,
              percent: e.percent,
              phase: e.phase,
              error: null,
            }),
        });

        const { fileId, stats } = await storeModel(result.blob);
        const updated = appendVersion(asset, {
          note: `restyled: ${description}`,
          prompt: description,
          device,
          createdAt: Date.now(),
          stats,
          fileId,
          sourceUrl: result.modelUrl,
          provider: 'meshy',
          // Keep pointing at the mesh task: rigging and FBX export both want
          // the task that owns the geometry, not the repaint.
          taskId: version.taskId,
          riggedTaskId: version.riggedTaskId,
        });
        upsert(
          { ...updated, clips: mergeClips(updated.clips, stats) },
          `${asset.name} restyled on ${device}`,
        );
        forgetTask(taskId);
        setJob(IDLE_JOB);
        abort.current = null;
        return updated;
      } catch (e) {
        abort.current = null;
        if (e instanceof DOMException && e.name === 'AbortError') {
          setJob(IDLE_JOB);
          return null;
        }
        const error = e instanceof Error ? e.message : 'Restyling failed';
        if (taskId) markTaskFailed(taskId, error);
        setJob({ ...IDLE_JOB, error });
        return null;
      }
    },
    [requireMeshy, storeModel, device, upsert, rememberTask, forgetTask, markTaskFailed],
  );

  /**
   * Credits left on the connected key. Read it before and after a job to see
   * what that job actually cost — a model is billed as a mesh task plus a
   * texture task, and rigging and each clip are charged on top.
   */
  const providerBalance = useCallback(async (): Promise<number | null> => {
    const provider = providerById(credentials.provider);
    if (!provider?.balance || !credentials.apiKey) return null;
    try {
      return await provider.balance(credentials.apiKey);
    } catch {
      // A balance we cannot read is not worth an error panel over.
      return null;
    }
  }, [credentials]);

  rigRef.current = rig;

  /**
   * Land an edit made on the loaded mesh as a new version.
   *
   * No provider is involved — the geometry was already here — so this costs
   * nothing and the previous version stays in the history to go back to.
   */
  const landEdit = useCallback(
    async (asset: Asset, blob: Blob, note: string): Promise<Asset | null> => {
      try {
        setJob({ running: true, label: note, percent: 60, phase: 'importing', error: null });
        const { fileId, stats } = await storeModel(blob);
        const version = currentVersion(asset);
        const updated = appendVersion(asset, {
          note,
          prompt: '',
          device,
          createdAt: Date.now(),
          stats,
          fileId,
          // The edit keeps its lineage: rigging and FBX export still want the
          // provider task that produced the geometry.
          provider: version.provider,
          taskId: version.taskId,
          riggedTaskId: version.riggedTaskId,
        });
        upsert({ ...updated, clips: mergeClips(updated.clips, stats) }, `${asset.name}: ${note}`);
        setJob(IDLE_JOB);
        return updated;
      } catch (e) {
        const error = e instanceof Error ? e.message : 'That edit could not be applied';
        setJob({ ...IDLE_JOB, error });
        return null;
      }
    },
    [storeModel, device, upsert],
  );

  /** The motion library the provider offers for a rigged model. */
  const motionActions = useCallback(async (): Promise<MeshyAction[]> => {
    try {
      return await listActions(requireMeshy());
    } catch (e) {
      say(e instanceof Error ? e.message : 'Could not load the motion list');
      return [];
    }
  }, [requireMeshy, say]);

  /** Bake one action onto the rigged model; it lands as a new version. */
  const addClip = useCallback(
    async (asset: Asset, action: MeshyAction): Promise<Asset | null> => {
      const controller = new AbortController();
      abort.current = controller;
      try {
        const key = requireMeshy();
        const rigged = [...asset.versions].reverse().find((v) => v.riggedTaskId);
        if (!rigged?.riggedTaskId) throw new Error('Rig the model first, then add clips to it.');

        setJob({ running: true, label: `Preparing ${action.name}`, percent: 0, phase: 'submitting', error: null });
        const blob = await animateModel({
          apiKey: key,
          riggedTaskId: rigged.riggedTaskId,
          actionId: action.id,
          actionName: action.name,
          signal: controller.signal,
          onProgress: (p) =>
            setJob({ running: true, label: p.label, percent: p.percent, phase: 'generating', error: null }),
        });
        const { fileId, stats } = await storeModel(blob);
        const updated = appendVersion(asset, {
          note: `clip: ${action.name}`,
          prompt: '',
          device,
          createdAt: Date.now(),
          stats,
          fileId,
          provider: 'meshy',
          riggedTaskId: rigged.riggedTaskId,
        });
        // A freshly baked clip has not been looked at yet.
        const clips = stats.clipNames.map((name) => {
          const existing = updated.clips.find((c) => c.name === name);
          return existing ?? { name, status: 'review' as const };
        });
        upsert({ ...updated, clips }, `${asset.name}: ${action.name} clip added`);
        setJob(IDLE_JOB);
        abort.current = null;
        return { ...updated, clips };
      } catch (e) {
        abort.current = null;
        if (e instanceof DOMException && e.name === 'AbortError') {
          setJob(IDLE_JOB);
          return null;
        }
        const error = e instanceof Error ? e.message : 'Could not add the clip';
        setJob({ ...IDLE_JOB, error });
        say(error);
        return null;
      }
    },
    [requireMeshy, storeModel, device, upsert, say],
  );

  /** Replace the current version's file in place, e.g. after rigging. */
  const addVersionFromBlob = useCallback(
    async (asset: Asset, blob: Blob, note: string, prompt = '') => {
      const { fileId, stats } = await storeModel(blob);
      const updated = appendVersion(asset, {
        note,
        prompt,
        device,
        createdAt: Date.now(),
        stats,
        fileId,
      });
      upsert({ ...updated, clips: mergeClips(updated.clips, stats) });
      return updated;
    },
    [storeModel, device, upsert],
  );

  return {
    // library
    assets,
    active,
    activeId,
    setActiveId,
    version,
    modelUrl,
    upsert,
    commit,
    removeAsset,
    setClipStatus,
    selectVersion,
    undoLast,
    addVersionFromBlob,
    // work
    job,
    generate,
    importModel,
    cancelJob,
    pendingTasks: pending,
    syncConfig,
    syncState,
    syncNow,
    restyle,
    providerBalance,
    activity,
    landEdit,
    connectSync,
    disconnectSync,
    syncConnected: Boolean(syncConfig?.enabled && syncToken),
    recoverTask,
    forgetTask,
    listProviderJobs,
    importProviderJob,
    canListJobs: credentials.provider === 'meshy' && Boolean(credentials.apiKey),
    dismissError: () => setJob(IDLE_JOB),
    rig,
    addClip,
    motionActions,
    canRig: credentials.provider === 'meshy' && Boolean(credentials.apiKey),
    // configuration
    settings,
    updateSettings,
    credentials,
    connectProvider,
    onboarded,
    finishOnboarding,
    blobs,
    // chrome
    toast,
    say,
    canGenerate: Boolean(credentials.provider && credentials.apiKey),
    pendingSync: transport.pending?.() ?? 0,
  };
}

/** Keep review states for clips that survive, adopt any new ones as approved. */
function mergeClips(existing: Asset['clips'], stats: MeshStats): Asset['clips'] {
  return stats.clipNames.map(
    (name) => existing.find((c) => c.name === name) ?? { name, status: 'approved' as const },
  );
}
