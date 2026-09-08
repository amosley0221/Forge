import { http } from './http.js';
import { ProviderError } from './providers/types.js';
import type { GenerateOptions, GenerationProvider, TaskState } from './providers/types.js';

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
  phase: 'submitting' | 'generating' | 'downloading' | 'importing';
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
  signal?: AbortSignal;
  /** How often to ask the provider for task status. */
  pollMs?: number;
}

/** Where a blob lives once downloaded. Each app injects its own storage. */
export interface BlobStore {
  put(id: string, blob: Blob): Promise<string>;
  /** Resolves to a URL the viewer can load (blob:, file://, capacitor://…). */
  url(id: string): Promise<string | null>;
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

/** Generation dominates the job, so it owns most of the bar. */
const weight = (phase: GenerationEvent['phase'], providerPercent: number): number => {
  switch (phase) {
    case 'submitting':
      return 3;
    case 'generating':
      return 5 + Math.round(providerPercent * 0.85);
    case 'downloading':
      return 92;
    case 'importing':
      return 98;
  }
};

export async function runGeneration(opts: RunGenerationOptions): Promise<GenerationResult> {
  const { provider, apiKey, source, onEvent, signal } = opts;
  const pollMs = opts.pollMs ?? 3000;
  const emit = (phase: GenerationEvent['phase'], label: string, p = 0) =>
    onEvent?.({ phase, label, percent: weight(phase, p) });

  emit('submitting', `Sending your prompt to ${provider.name}`);

  const taskId =
    source === 'image'
      ? await provider.imageTo3D(apiKey, { ...opts, imageUrl: opts.imageUrl! })
      : await provider.textTo3D(apiKey, opts);

  let last: TaskState = 'queued';
  let modelUrl: string | undefined;

  // Poll until the provider says it is done. No upper bound on attempts: a
  // slow queue is not a failure, and the user can cancel.
  for (;;) {
    if (signal?.aborted) throw new DOMException('Generation cancelled', 'AbortError');
    const status = await provider.status(apiKey, taskId);
    last = status.state;

    if (status.state === 'failed') {
      throw new ProviderError(status.error || `${provider.name} could not build this asset`);
    }
    if (status.state === 'succeeded') {
      if (!status.modelUrl) {
        throw new ProviderError(`${provider.name} finished without returning a model file`);
      }
      modelUrl = status.modelUrl;
      break;
    }

    emit(
      'generating',
      status.state === 'queued'
        ? `Queued at ${provider.name}`
        : `${provider.name} is building the mesh`,
      status.progress,
    );
    await sleep(pollMs, signal);
  }

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
  void last;
  return { taskId, modelUrl, blob };
}
