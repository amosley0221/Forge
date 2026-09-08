import { http } from '../http.js';
import { ProviderError, requestJson } from './types.js';
import type { TaskStatus } from './types.js';

/**
 * Meshy's rigging and animation endpoints, which is what makes Rig and Animate
 * mode do real work: an existing text-to-3D task is rigged into a skeleton,
 * then named actions are baked into animated GLBs.
 *
 * These are versioned HTTP endpoints on Meshy's side. Responses are parsed
 * defensively — any shape we do not recognise surfaces as an error naming what
 * came back, rather than being silently treated as success.
 */

const BASE = 'https://api.meshy.ai/openapi';

const auth = (key: string) => ({
  authorization: `Bearer ${key}`,
  'content-type': 'application/json',
});

interface MeshyJob {
  id?: string;
  status?: string;
  progress?: number;
  task_error?: { message?: string };
  [k: string]: unknown;
}

/** Meshy nests the download under differently-named *_urls objects per task. */
function findGlb(obj: unknown, depth = 0): string | undefined {
  if (!obj || typeof obj !== 'object' || depth > 4) return undefined;
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (key === 'glb' && typeof value === 'string' && value.startsWith('http')) return value;
    const nested = findGlb(value, depth + 1);
    if (nested) return nested;
  }
  return undefined;
}

function mapJob(job: MeshyJob, what: string): TaskStatus {
  const progress = typeof job.progress === 'number' ? job.progress : 0;
  const status = String(job.status ?? '').toUpperCase();
  if (status === 'SUCCEEDED') {
    const modelUrl = findGlb(job);
    if (!modelUrl) throw new ProviderError(`${what} finished without a GLB in the response`);
    return { state: 'succeeded', progress: 100, modelUrl };
  }
  if (status === 'FAILED' || status === 'CANCELED') {
    return {
      state: 'failed',
      progress,
      error: job.task_error?.message || `${what} ${status.toLowerCase()}`,
    };
  }
  if (status === 'IN_PROGRESS') return { state: 'running', progress };
  return { state: 'queued', progress };
}

export interface MeshyAction {
  id: string;
  name: string;
}

/** The motion library Meshy can bake onto a rigged model. */
export async function listActions(key: string): Promise<MeshyAction[]> {
  const res = await requestJson<{ result?: unknown[]; data?: unknown[] }>(
    `${BASE}/v1/animations/actions`,
    { headers: auth(key) },
    'Meshy action list',
  );
  const rows = (res.result ?? res.data ?? []) as Record<string, unknown>[];
  return rows
    .map((r) => ({
      id: String(r.id ?? r.action_id ?? ''),
      name: String(r.name ?? r.action_name ?? r.id ?? ''),
    }))
    .filter((a) => a.id);
}

/**
 * Rig a completed text-to-3D task. `characterHeight` is in metres and is what
 * Meshy scales the skeleton against, so pass the real size read from the mesh.
 */
export async function startRigging(
  key: string,
  inputTaskId: string,
  characterHeight: number,
): Promise<string> {
  const res = await requestJson<{ result?: string }>(
    `${BASE}/v1/rigging`,
    {
      method: 'POST',
      headers: auth(key),
      body: JSON.stringify({
        input_task_id: inputTaskId,
        character_height: Number(characterHeight.toFixed(2)) || 1.7,
      }),
    },
    'Meshy rigging',
  );
  if (!res.result) throw new ProviderError('Meshy rigging did not return a task id');
  return res.result;
}

export async function riggingStatus(key: string, taskId: string): Promise<TaskStatus> {
  const job = await requestJson<MeshyJob>(
    `${BASE}/v1/rigging/${taskId}`,
    { headers: auth(key) },
    'Meshy rigging status',
  );
  return mapJob(job, 'Meshy rigging');
}

export async function startAnimation(
  key: string,
  riggedTaskId: string,
  actionId: string,
): Promise<string> {
  const res = await requestJson<{ result?: string }>(
    `${BASE}/v1/animations`,
    {
      method: 'POST',
      headers: auth(key),
      body: JSON.stringify({ rigged_task_id: riggedTaskId, action_id: actionId }),
    },
    'Meshy animation',
  );
  if (!res.result) throw new ProviderError('Meshy animation did not return a task id');
  return res.result;
}

export async function animationStatus(key: string, taskId: string): Promise<TaskStatus> {
  const job = await requestJson<MeshyJob>(
    `${BASE}/v1/animations/${taskId}`,
    { headers: auth(key) },
    'Meshy animation status',
  );
  return mapJob(job, 'Meshy animation');
}

export interface RigProgress {
  label: string;
  percent: number;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('Cancelled', 'AbortError'));
      },
      { once: true },
    );
  });

async function poll(
  fn: () => Promise<TaskStatus>,
  onProgress: (p: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  for (;;) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const status = await fn();
    if (status.state === 'failed') throw new ProviderError(status.error ?? 'Task failed');
    if (status.state === 'succeeded') return status.modelUrl!;
    onProgress(status.progress);
    await sleep(4000, signal);
  }
}

/** Rig a model and download the rigged GLB. */
export async function rigModel(opts: {
  apiKey: string;
  inputTaskId: string;
  characterHeight: number;
  onProgress?: (p: RigProgress) => void;
  signal?: AbortSignal;
}): Promise<{ riggedTaskId: string; blob: Blob }> {
  opts.onProgress?.({ label: 'Sending the mesh to Meshy for rigging', percent: 3 });
  const riggedTaskId = await startRigging(opts.apiKey, opts.inputTaskId, opts.characterHeight);
  const url = await poll(
    () => riggingStatus(opts.apiKey, riggedTaskId),
    (p) => opts.onProgress?.({ label: 'Meshy is building the skeleton', percent: 5 + p * 0.85 }),
    opts.signal,
  );
  opts.onProgress?.({ label: 'Downloading the rigged model', percent: 93 });
  const blob = await download(url, opts.signal);
  return { riggedTaskId, blob };
}

/** Bake one action onto a rigged model and download the animated GLB. */
export async function animateModel(opts: {
  apiKey: string;
  riggedTaskId: string;
  actionId: string;
  actionName: string;
  onProgress?: (p: RigProgress) => void;
  signal?: AbortSignal;
}): Promise<Blob> {
  opts.onProgress?.({ label: `Asking Meshy for a ${opts.actionName} clip`, percent: 3 });
  const taskId = await startAnimation(opts.apiKey, opts.riggedTaskId, opts.actionId);
  const url = await poll(
    () => animationStatus(opts.apiKey, taskId),
    (p) => opts.onProgress?.({ label: `Meshy is baking ${opts.actionName}`, percent: 5 + p * 0.85 }),
    opts.signal,
  );
  opts.onProgress?.({ label: 'Downloading the clip', percent: 93 });
  return download(url, opts.signal);
}

async function download(url: string, signal?: AbortSignal): Promise<Blob> {
  const res = await http()(url, { signal });
  if (!res.ok) throw new ProviderError(`Could not download the model (${res.status})`);
  const blob = await res.blob();
  if (!blob.size) throw new ProviderError('The downloaded model was empty');
  return blob;
}
