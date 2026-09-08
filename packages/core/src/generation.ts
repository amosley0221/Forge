import { http } from './http.js';
import { ProviderError } from './providers/types.js';
import type { GenerateOptions, GenerationProvider } from './providers/types.js';

/**
 * Runs one real generation job: submit to the provider, poll its task until it
 * finishes, download the GLB. Every percentage reported here comes from the
 * provider — there is no timer driving a fake progress bar.
 */

export interface GenerationEvent {
  /** Shown under the spinner, e.g. "Meshy is building the mesh". */
  label: string;
  /** 0–100 across the whole job, weighted by phase. */
  percent: number;
  phase: 'submitting' | 'generating' | 'texturing' | 'downloading' | 'importing';
}

export interface GenerationResult {
  taskId: string;
  modelUrl: string;
  blob: Blob;
}

export interface RunGenerationOptions extends GenerateOptions {
  provider: GenerationProvider;
  apiKey: string;
  /** 'image' requires `imageUrl`. */
  source: 'text' | 'image';
  onEvent?: (e: GenerationEvent) => void;
  /**
   * Fires the moment the provider accepts a job — which is the moment it
   * starts charging. Persist the id here so a later failure (a dropped
   * download, a closed laptop) can be resumed without paying twice. The
   * texture stage is a second charged task, so it reports itself too.
   */
  onTaskCreated?: (taskId: string, stage: 'mesh' | 'texture') => void;
  /**
   * Run the provider's texture stage after the mesh. Off means the model comes
   * back as bare geometry — grey, no face, no clothing colour. On costs a
   * second task's worth of credits, which is why it is the caller's decision.
   */
  texture?: boolean;
  /** Extra wording for the texture stage: "dark brown skin, red hoodie". */
  texturePrompt?: string;
  signal?: AbortSignal;
  /** How often to ask the provider for status. */
  pollMs?: number;
}

/** Where a blob lives once downloaded. Each app injects its own storage. */
export interface BlobStore {
  put(id: string, blob: Blob): Promise<string>;
  /** Resolves to a URL the viewer can load (blob:, file://, capacitor://…). */
  url(id: string): Promise<string | null>;
  /**
   * Whether this device actually holds the file.
   *
   * Distinct from `url()` on purpose: a path-based store can hand back a
   * perfectly well-formed URL for a file that was never written, so "url() was
   * truthy" is not evidence of anything. Callers deciding whether to download
   * must ask this.
   */
  has(id: string): Promise<boolean>;
  remove(id: string): Promise<void>;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('Generation cancelled', 'AbortError'));
      },
      { once: true },
    );
  });

/**
 * Generation dominates the job, so it owns most of the bar. When a texture
 * stage follows, the mesh only gets the first half — otherwise the bar would
 * reach 90% and then sit there for a second full task.
 */
const weight = (
  phase: GenerationEvent['phase'],
  providerPercent: number,
  twoStage = false,
): number => {
  switch (phase) {
    case 'submitting':
      return 3;
    case 'generating':
      return twoStage
        ? 5 + Math.round(providerPercent * 0.4)
        : 5 + Math.round(providerPercent * 0.85);
    case 'texturing':
      return 47 + Math.round(providerPercent * 0.43);
    case 'downloading':
      return 92;
    case 'importing':
      return 98;
  }
};

export async function runGeneration(opts: RunGenerationOptions): Promise<GenerationResult> {
  const { provider, apiKey, source, onEvent, signal } = opts;
  const stage = opts.texture ? provider.textureStage : undefined;
  const twoStage = Boolean(stage);
  const emit = (phase: GenerationEvent['phase'], label: string, p = 0) =>
    onEvent?.({ phase, label, percent: weight(phase, p, twoStage) });

  emit('submitting', `Sending your prompt to ${provider.name}`);

  const meshTaskId =
    source === 'image'
      ? await provider.imageTo3D(apiKey, { ...opts, imageUrl: opts.imageUrl! })
      : await provider.textTo3D(apiKey, opts);
  opts.onTaskCreated?.(meshTaskId, 'mesh');

  if (!stage) return awaitTask({ ...opts, taskId: meshTaskId });

  // The texture stage needs a finished mesh, so wait for it — but skip its
  // download entirely: the untextured GLB is not what we are keeping.
  await waitForTask({
    ...opts,
    taskId: meshTaskId,
    onEvent: (e) => onEvent?.({ ...e, percent: weight('generating', e.percent, true) }),
  });

  emit('texturing', stage.label);
  const textureTaskId = await stage.start(apiKey, meshTaskId, { prompt: opts.texturePrompt });
  opts.onTaskCreated?.(textureTaskId, 'texture');

  return awaitTask({
    ...opts,
    taskId: textureTaskId,
    onEvent: (e) =>
      onEvent?.({
        ...e,
        label: e.phase === 'generating' ? stage.label : e.label,
        percent: e.phase === 'generating' ? weight('texturing', e.percent) : e.percent,
      }),
    signal,
  });
}

/**
 * Poll a task the provider has already accepted until it finishes. Reports raw
 * provider percentages; the caller decides where they sit on its own bar.
 */
export async function waitForTask(opts: AwaitTaskOptions): Promise<string> {
  const { provider, apiKey, taskId, onEvent, signal } = opts;
  const pollMs = opts.pollMs ?? 3000;

  for (;;) {
    if (signal?.aborted) throw new DOMException('Generation cancelled', 'AbortError');
    const status = await provider.status(apiKey, taskId);

    if (status.state === 'failed') {
      throw new ProviderError(status.error || `${provider.name} could not build this asset`);
    }
    if (status.state === 'succeeded') {
      if (!status.modelUrl) {
        throw new ProviderError(`${provider.name} finished without returning a model file`);
      }
      return status.modelUrl;
    }

    onEvent?.({
      phase: 'generating',
      label:
        status.state === 'queued'
          ? `Queued at ${provider.name}`
          : `${provider.name} is building the mesh`,
      percent: status.progress,
    });
    await sleep(pollMs, signal);
  }
}

export interface AwaitTaskOptions {
  provider: GenerationProvider;
  apiKey: string;
  taskId: string;
  onEvent?: (e: GenerationEvent) => void;
  signal?: AbortSignal;
  pollMs?: number;
}

/**
 * Wait for a task the provider has already accepted, then download it. Used
 * both by a fresh generation and to resume one that was paid for but whose
 * download never landed — no new task is submitted, so no new credits.
 */
export async function awaitTask(opts: AwaitTaskOptions): Promise<GenerationResult> {
  const { taskId, onEvent, signal } = opts;
  const emit = (phase: GenerationEvent['phase'], label: string, p = 0) =>
    onEvent?.({ phase, label, percent: weight(phase, p) });

  // No upper bound on attempts: a slow queue is not a failure, and the user
  // can cancel.
  const modelUrl = await waitForTask(opts);

  emit('downloading', 'Downloading the model');
  let res: Response;
  try {
    res = await http()(modelUrl, { signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ProviderError(
      `Could not download the model (${e instanceof Error ? e.message : 'network error'})`,
    );
  }
  if (!res.ok) throw new ProviderError(`Could not download the model (${res.status})`);
  const blob = await res.blob();
  if (blob.size === 0) throw new ProviderError('The downloaded model was empty');

  emit('importing', 'Reading the mesh');
  return { taskId, modelUrl, blob };
}

/** A provider task that was paid for but never produced a stored model. */
export interface PendingTask {
  taskId: string;
  provider: string;
  prompt: string;
  category: string;
  source: 'text' | 'image';
  createdAt: number;
  /** Why the first attempt did not finish, for the recovery UI. */
  error?: string;
  /**
   * What kind of job this was. A rig is charged like any other task but lands
   * as a new version of an existing asset rather than as a new one, so
   * recovery has to know the difference.
   */
  kind?: 'mesh' | 'rig';
  /** The asset a recovered rig belongs to. */
  assetId?: string;
}
