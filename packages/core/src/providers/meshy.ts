import { ProviderError, requestJson } from './types.js';
import type { GenerateOptions, GenerationProvider, KeyCheck, TaskStatus } from './types.js';

const BASE = 'https://api.meshy.ai/openapi';

interface MeshyCreate {
  result: string;
}

interface MeshyTask {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  progress?: number;
  model_urls?: { glb?: string; fbx?: string; obj?: string; usdz?: string };
  thumbnail_url?: string;
  task_error?: { message?: string };
}

const auth = (key: string) => ({
  authorization: `Bearer ${key}`,
  'content-type': 'application/json',
});

function mapStatus(t: MeshyTask): TaskStatus {
  const progress = typeof t.progress === 'number' ? t.progress : 0;
  switch (t.status) {
    case 'SUCCEEDED':
      return { state: 'succeeded', progress: 100, modelUrl: t.model_urls?.glb, thumbnailUrl: t.thumbnail_url };
    case 'FAILED':
    case 'CANCELED':
      return {
        state: 'failed',
        progress,
        error: t.task_error?.message || `Meshy reported ${t.status.toLowerCase()}`,
      };
    case 'IN_PROGRESS':
      return { state: 'running', progress };
    default:
      return { state: 'queued', progress };
  }
}

/** Meshy keeps text and image tasks on different paths; remember which. */
const kindOf = (taskId: string) => (taskId.startsWith('img:') ? 'image' : 'text');
const rawId = (taskId: string) => taskId.replace(/^img:/, '');

export const meshy: GenerationProvider = {
  id: 'meshy',
  name: 'Meshy',
  keyPlaceholder: 'msy_…',
  keysUrl: 'https://www.meshy.ai/api',

  async validateKey(key: string): Promise<KeyCheck> {
    try {
      const balance = await requestJson<{ balance?: number }>(
        `${BASE}/v1/balance`,
        { headers: auth(key) },
        'Meshy key check',
      );
      return {
        ok: true,
        message:
          typeof balance.balance === 'number'
            ? `Connected · ${balance.balance} credits`
            : 'Connected',
      };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Key check failed' };
    }
  },

  async textTo3D(key: string, opts: GenerateOptions): Promise<string> {
    const prompt = [opts.prompt, opts.style && `${opts.style} style`].filter(Boolean).join(', ');
    const created = await requestJson<MeshyCreate>(
      `${BASE}/v2/text-to-3d`,
      {
        method: 'POST',
        headers: auth(key),
        body: JSON.stringify({
          mode: 'preview',
          prompt,
          art_style: 'realistic',
          should_remesh: true,
          topology: 'triangle',
          ...(opts.triBudget ? { target_polycount: opts.triBudget } : {}),
        }),
      },
      'Meshy text-to-3D',
    );
    if (!created.result) throw new ProviderError('Meshy did not return a task id');
    return created.result;
  },

  async imageTo3D(key: string, opts: GenerateOptions & { imageUrl: string }): Promise<string> {
    const created = await requestJson<MeshyCreate>(
      `${BASE}/v1/image-to-3d`,
      {
        method: 'POST',
        headers: auth(key),
        body: JSON.stringify({
          image_url: opts.imageUrl,
          enable_pbr: true,
          should_remesh: true,
          topology: 'triangle',
          ...(opts.triBudget ? { target_polycount: opts.triBudget } : {}),
        }),
      },
      'Meshy image-to-3D',
    );
    if (!created.result) throw new ProviderError('Meshy did not return a task id');
    return 'img:' + created.result;
  },

  async status(key: string, taskId: string): Promise<TaskStatus> {
    const path = kindOf(taskId) === 'image' ? 'v1/image-to-3d' : 'v2/text-to-3d';
    const task = await requestJson<MeshyTask>(
      `${BASE}/${path}/${rawId(taskId)}`,
      { headers: auth(key) },
      'Meshy task status',
    );
    return mapStatus(task);
  },
};
