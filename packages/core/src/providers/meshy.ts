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
  model_urls?: { glb?: string; fbx?: string; obj?: string; usdz?: string; mtl?: string };
  texture_urls?: Record<string, string>[];
  thumbnail_url?: string;
  task_error?: { message?: string };
}

/**
 * Every format Meshy produced for a task, plus its texture maps. These come
 * from the job that was already paid for, so fetching them costs nothing —
 * FBX for Unity is the same model as the GLB, in a different container.
 */
export interface MeshyTaskAssets {
  models: { format: string; url: string }[];
  /** e.g. base_color, metallic, normal, roughness. */
  textures: { name: string; url: string }[];
}

/** One job this key has run, as listed by the provider. */
export interface ProviderJob {
  taskId: string;
  prompt: string;
  status: string;
  succeeded: boolean;
  createdAt: number;
  thumbnailUrl?: string;
  source: 'text' | 'image';
}

interface MeshyListRow {
  id?: string;
  prompt?: string;
  status?: string;
  created_at?: number | string;
  thumbnail_url?: string;
}

const rows = (payload: unknown): MeshyListRow[] => {
  if (Array.isArray(payload)) return payload as MeshyListRow[];
  const obj = payload as { result?: unknown; data?: unknown };
  if (Array.isArray(obj?.result)) return obj.result as MeshyListRow[];
  if (Array.isArray(obj?.data)) return obj.data as MeshyListRow[];
  return [];
};

/**
 * Everything this key has generated, newest first.
 *
 * Jobs run through the API do not appear in Meshy's web workspace, so without
 * this a model you paid for and lost track of is effectively invisible. Listing
 * them means a job whose download failed can still be pulled into the library
 * without spending anything more.
 */
export async function listRecentJobs(key: string, limit = 20): Promise<ProviderJob[]> {
  const query = `?page_num=1&page_size=${limit}&sort_by=-created_at`;

  const load = async (path: string, source: 'text' | 'image'): Promise<ProviderJob[]> => {
    try {
      const payload = await requestJson<unknown>(
        `${BASE}/${path}${query}`,
        { headers: auth(key) },
        'Meshy job list',
      );
      return rows(payload)
        .filter((r) => r.id)
        .map((r) => {
          const status = String(r.status ?? '').toUpperCase();
          return {
            taskId: source === 'image' ? 'img:' + r.id : String(r.id),
            prompt: r.prompt?.trim() || '(no prompt)',
            status: status.toLowerCase() || 'unknown',
            succeeded: status === 'SUCCEEDED',
            createdAt:
              typeof r.created_at === 'number'
                ? r.created_at
                : Date.parse(String(r.created_at ?? '')) || 0,
            thumbnailUrl: r.thumbnail_url,
            source,
          };
        });
    } catch {
      // One endpoint being unavailable should not hide the other's jobs.
      return [];
    }
  };

  const [text, image] = await Promise.all([
    load('v2/text-to-3d', 'text'),
    load('v1/image-to-3d', 'image'),
  ]);
  return [...text, ...image].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

export async function fetchTaskAssets(key: string, taskId: string): Promise<MeshyTaskAssets> {
  const path = pathFor(taskId);
  const task = await requestJson<MeshyTask>(
    `${BASE}/${path}/${rawId(taskId)}`,
    { headers: auth(key) },
    'Meshy task formats',
  );

  const models = Object.entries(task.model_urls ?? {})
    .filter(([, url]) => typeof url === 'string' && url.startsWith('http'))
    .map(([format, url]) => ({ format, url: url as string }));

  // Meshy returns one object per material, each keyed by map name.
  const textures: { name: string; url: string }[] = [];
  (task.texture_urls ?? []).forEach((set, i) => {
    for (const [name, url] of Object.entries(set)) {
      if (typeof url !== 'string' || !url.startsWith('http')) continue;
      const suffix = (task.texture_urls?.length ?? 0) > 1 ? `_${i + 1}` : '';
      textures.push({ name: `${name}${suffix}`, url });
    }
  });

  return { models, textures };
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

/**
 * Meshy serves text and image tasks from different paths, so the id we hand
 * back carries an `img:` marker. It survives a restart, which is what lets a
 * paid job be resumed later. Anything talking to Meshy about the task itself —
 * rigging, for one — needs the bare id.
 */
const kindOf = (taskId: string): 'image' | 'text' | 'texture' => {
  if (taskId.startsWith('img:')) return 'image';
  if (taskId.startsWith('tex:')) return 'texture';
  return 'text';
};

const PATHS = {
  text: 'v2/text-to-3d',
  image: 'v1/image-to-3d',
  texture: 'v1/retexture',
} as const;

const pathFor = (taskId: string) => PATHS[kindOf(taskId)];

export const meshyRawTaskId = (taskId: string) => taskId.replace(/^(img|tex):/, '');
const rawId = meshyRawTaskId;

/**
 * Meshy builds a model in two stages: `preview` produces bare geometry, and
 * `refine` paints it. Forge previously stopped after preview, which is why
 * every model came out untextured — a grey mesh with no face, no clothing
 * colour and a single material. Refine is a second, separately-charged task.
 */
export async function startTextureStage(
  key: string,
  meshTaskId: string,
  opts: { prompt?: string } = {},
): Promise<string> {
  const created = await requestJson<MeshyCreate>(
    `${BASE}/v2/text-to-3d`,
    {
      method: 'POST',
      headers: auth(key),
      body: JSON.stringify({
        mode: 'refine',
        preview_task_id: rawId(meshTaskId),
        enable_pbr: true,
        ...(opts.prompt ? { texture_prompt: opts.prompt.slice(0, 800) } : {}),
      }),
    },
    'Meshy texture stage',
  );
  if (!created.result) throw new ProviderError('Meshy did not return a texture task id');
  return created.result;
}

export interface RetextureOptions {
  /** A Meshy task to re-skin. Preferred: Meshy already has the mesh. */
  inputTaskId?: string;
  /** A publicly reachable model instead, for anything Meshy did not build. */
  modelUrl?: string;
  /** What the object is — "a young man in a hoodie". */
  objectPrompt?: string;
  /** How it should look — "dark brown skin, red hoodie, blue jeans". */
  stylePrompt: string;
}

/**
 * Repaint an existing model without rebuilding its geometry.
 *
 * This is the honest answer to "change the skin tone / change the clothes":
 * Meshy has no notion of a shirt or a face as separate editable things, so
 * appearance is changed by re-texturing the whole model from a description.
 * The mesh is untouched, so the result is the same character, repainted.
 */
export async function startRetexture(key: string, opts: RetextureOptions): Promise<string> {
  if (!opts.inputTaskId && !opts.modelUrl) {
    throw new ProviderError('Retexturing needs either a Meshy task or a model URL');
  }
  const created = await requestJson<MeshyCreate>(
    `${BASE}/v1/retexture`,
    {
      method: 'POST',
      headers: auth(key),
      body: JSON.stringify({
        ...(opts.inputTaskId
          ? { input_task_id: rawId(opts.inputTaskId) }
          : { model_url: opts.modelUrl }),
        ...(opts.objectPrompt ? { object_prompt: opts.objectPrompt.slice(0, 600) } : {}),
        text_style_prompt: opts.stylePrompt.slice(0, 600),
        enable_pbr: true,
      }),
    },
    'Meshy retexture',
  );
  if (!created.result) throw new ProviderError('Meshy did not return a retexture task id');
  return 'tex:' + created.result;
}

/**
 * Credits left on this key.
 *
 * Worth surfacing because a model is not one charge: the mesh and the texture
 * stage are billed as separate tasks, as is a retexture, a rig and each
 * animation clip. Rather than quote numbers that change, Forge shows the real
 * balance so the cost of anything can be read off before and after.
 */
export async function fetchBalance(key: string): Promise<number | null> {
  const res = await requestJson<{ balance?: number }>(
    `${BASE}/v1/balance`,
    { headers: auth(key) },
    'Meshy balance',
  );
  return typeof res.balance === 'number' ? res.balance : null;
}

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

  textureStage: {
    label: 'Painting the textures',
    start: startTextureStage,
  },

  balance: fetchBalance,

  async status(key: string, taskId: string): Promise<TaskStatus> {
    const path = pathFor(taskId);
    const task = await requestJson<MeshyTask>(
      `${BASE}/${path}/${rawId(taskId)}`,
      { headers: auth(key) },
      'Meshy task status',
    );
    return mapStatus(task);
  },
};
