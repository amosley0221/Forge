import { ProviderError, requestJson } from './types.js';
import type { GenerateOptions, GenerationProvider, KeyCheck, TaskStatus } from './types.js';

const BASE = 'https://api.tripo3d.ai/v2/openapi';

interface TripoEnvelope<T> {
  code: number;
  message?: string;
  data: T;
}

interface TripoTask {
  task_id: string;
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'banned' | 'expired' | 'unknown';
  progress?: number;
  output?: { pbr_model?: string; model?: string; rendered_image?: string };
}

const auth = (key: string) => ({ authorization: `Bearer ${key}` });
const jsonAuth = (key: string) => ({ ...auth(key), 'content-type': 'application/json' });

function unwrap<T>(env: TripoEnvelope<T>, what: string): T {
  if (env.code !== 0) throw new ProviderError(`${what}: ${env.message || `code ${env.code}`}`);
  return env.data;
}

function mapStatus(t: TripoTask): TaskStatus {
  const progress = typeof t.progress === 'number' ? t.progress : 0;
  switch (t.status) {
    case 'success':
      return {
        state: 'succeeded',
        progress: 100,
        modelUrl: t.output?.pbr_model || t.output?.model,
        thumbnailUrl: t.output?.rendered_image,
      };
    case 'failed':
    case 'cancelled':
    case 'banned':
    case 'expired':
      return { state: 'failed', progress, error: `Tripo reported ${t.status}` };
    case 'running':
      return { state: 'running', progress };
    default:
      return { state: 'queued', progress };
  }
}

/** Tripo takes an uploaded file token rather than an image URL. */
async function uploadImage(key: string, imageUrl: string): Promise<{ token: string; type: string }> {
  const blob = await (await fetch(imageUrl)).blob();
  const type = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpeg';
  const form = new FormData();
  form.append('file', blob, `capture.${type === 'jpeg' ? 'jpg' : type}`);

  let res: Response;
  try {
    res = await fetch(`${BASE}/upload`, { method: 'POST', headers: auth(key), body: form });
  } catch (e) {
    throw new ProviderError(
      `Tripo image upload could not be reached (${e instanceof Error ? e.message : 'network error'})`,
    );
  }
  if (!res.ok) throw new ProviderError(`Tripo image upload failed (${res.status})`, res.status);
  const env = (await res.json()) as TripoEnvelope<{ image_token: string }>;
  return { token: unwrap(env, 'Tripo image upload').image_token, type };
}

export const tripo: GenerationProvider = {
  id: 'tripo',
  name: 'Tripo',
  keyPlaceholder: 'tsk_…',
  keysUrl: 'https://platform.tripo3d.ai/api-keys',

  async validateKey(key: string): Promise<KeyCheck> {
    try {
      const env = await requestJson<TripoEnvelope<{ balance?: number; frozen?: number }>>(
        `${BASE}/user/balance`,
        { headers: auth(key) },
        'Tripo key check',
      );
      const data = unwrap(env, 'Tripo key check');
      return {
        ok: true,
        message:
          typeof data.balance === 'number' ? `Connected · ${data.balance} credits` : 'Connected',
      };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Key check failed' };
    }
  },

  async textTo3D(key: string, opts: GenerateOptions): Promise<string> {
    const prompt = [opts.prompt, opts.style && `${opts.style} style`].filter(Boolean).join(', ');
    const env = await requestJson<TripoEnvelope<{ task_id: string }>>(
      `${BASE}/task`,
      {
        method: 'POST',
        headers: jsonAuth(key),
        body: JSON.stringify({ type: 'text_to_model', prompt }),
      },
      'Tripo text-to-3D',
    );
    return unwrap(env, 'Tripo text-to-3D').task_id;
  },

  async imageTo3D(key: string, opts: GenerateOptions & { imageUrl: string }): Promise<string> {
    const { token, type } = await uploadImage(key, opts.imageUrl);
    const env = await requestJson<TripoEnvelope<{ task_id: string }>>(
      `${BASE}/task`,
      {
        method: 'POST',
        headers: jsonAuth(key),
        body: JSON.stringify({
          type: 'image_to_model',
          file: { type, file_token: token },
        }),
      },
      'Tripo image-to-3D',
    );
    return unwrap(env, 'Tripo image-to-3D').task_id;
  },

  async status(key: string, taskId: string): Promise<TaskStatus> {
    const env = await requestJson<TripoEnvelope<TripoTask>>(
      `${BASE}/task/${taskId}`,
      { headers: auth(key) },
      'Tripo task status',
    );
    return mapStatus(unwrap(env, 'Tripo task status'));
  },
};
