import { http } from '../http.js';
/**
 * A 3D generation provider, driven with the user's own API key.
 *
 * Nothing here simulates work: every task id, percentage and model URL comes
 * from the provider. When there is no key, the app says so rather than
 * pretending to generate something.
 */

export type ProviderId = 'meshy' | 'tripo';

export type TaskState = 'queued' | 'running' | 'succeeded' | 'failed';

export interface TaskStatus {
  state: TaskState;
  /** 0–100, as reported by the provider. */
  progress: number;
  /** Downloadable GLB once the task succeeds. */
  modelUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

export interface GenerateOptions {
  prompt: string;
  /** Free-form style words folded into the prompt (toon, low-poly, …). */
  style?: string;
  /** Upper bound on triangles; providers treat it as a target polycount. */
  triBudget?: number;
  /** data: URI or https URL of the source image, for image-to-3D. */
  imageUrl?: string;
}

export interface KeyCheck {
  ok: boolean;
  /** Shown verbatim in Settings — provider wording, not ours. */
  message: string;
}

export interface GenerationProvider {
  id: ProviderId;
  name: string;
  /** Shape of the key, used as the input placeholder. */
  keyPlaceholder: string;
  keysUrl: string;
  /** Cheapest authenticated call the provider offers, used to check the key. */
  validateKey(key: string): Promise<KeyCheck>;
  textTo3D(key: string, opts: GenerateOptions): Promise<string>;
  imageTo3D(key: string, opts: GenerateOptions & { imageUrl: string }): Promise<string>;
  status(key: string, taskId: string): Promise<TaskStatus>;
  /** Credits remaining, when the provider exposes them. */
  balance?(key: string): Promise<number | null>;
  /**
   * Providers that build geometry and texture as separate, separately-charged
   * tasks expose the second one here. Without it a model comes back untextured
   * — no face, no clothing colour, one flat material. Providers that texture in
   * a single pass simply omit it.
   */
  textureStage?: {
    /** Shown on the progress bar while it runs. */
    label: string;
    /** Takes the finished mesh task and returns the texture task's id. */
    start(
      key: string,
      meshTaskId: string,
      opts: { prompt?: string; resolution?: '2k' | '4k' | '8k' },
    ): Promise<string>;
  };
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/**
 * Providers are called from a WebView, so every request goes through the HTTP
 * client the shell installed (see http.ts). In a plain browser there is none,
 * CORS blocks the call, and the error below says so.
 */
export async function requestJson<T>(
  url: string,
  init: RequestInit,
  what: string,
): Promise<T> {
  let res: Response;
  try {
    res = await http()(url, init);
  } catch (e) {
    throw new ProviderError(
      `${what} could not be reached (${e instanceof Error ? e.message : 'network error'}). ` +
        'In a browser this is usually CORS — run the desktop or Android build.',
    );
  }
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 300);
    try {
      const j = JSON.parse(text) as { message?: string; error?: string };
      detail = j.message || j.error || detail;
    } catch {
      /* keep the raw body */
    }
    throw new ProviderError(`${what} failed (${res.status}): ${detail}`, res.status);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ProviderError(`${what} returned a response that was not JSON`);
  }
}
