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
 * Providers are called from a WebView, so CORS matters: on Android the
 * CapacitorHttp plugin patches fetch to go through native networking, and the
 * desktop shell routes through the Tauri HTTP plugin. In a plain browser
 * (`npm run dev`) these calls will be blocked, and the error says so.
 */
export async function requestJson<T>(
  url: string,
  init: RequestInit,
  what: string,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
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
