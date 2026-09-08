import type {
  AgentRequest,
  AgentResponse,
  DetectedSubject,
  JobProgress,
  SpriteSheetReading,
} from './types.js';

/**
 * Client for the server-side agent. Provider keys never reach a client — the
 * server holds them (or, under BYOK on desktop, reads them from the OS
 * keychain and forwards them per request).
 */
export interface AgentClientConfig {
  apiUrl: string;
  token: () => string | null;
  fetchImpl?: typeof fetch;
}

export interface AgentClient {
  submit(req: AgentRequest): Promise<{ jobId: string }>;
  /** Stream job progress: understanding → shape → retopo_uv → texturing → checks. */
  watch(jobId: string, onProgress: (p: JobProgress) => void): Promise<AgentResponse>;
  detectSubjects(imageUrl: string): Promise<DetectedSubject[]>;
  readSpriteSheet(url: string): Promise<SpriteSheetReading>;
}

export function createAgentClient(cfg: AgentClientConfig): AgentClient {
  const doFetch = cfg.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const headers = () => ({
    'content-type': 'application/json',
    authorization: `Bearer ${cfg.token() ?? ''}`,
  });

  const post = async <T>(path: string, body: unknown): Promise<T> => {
    const res = await doFetch(`${cfg.apiUrl}${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
    return (await res.json()) as T;
  };

  return {
    submit: (req) => post<{ jobId: string }>('/agent/submit', req),

    watch(jobId, onProgress) {
      return new Promise<AgentResponse>((resolve, reject) => {
        if (typeof EventSource === 'undefined') {
          reject(new Error('EventSource unavailable'));
          return;
        }
        const es = new EventSource(
          `${cfg.apiUrl}/agent/jobs/${jobId}/stream?token=${encodeURIComponent(cfg.token() ?? '')}`,
        );
        es.addEventListener('progress', (e) => {
          try {
            onProgress(JSON.parse((e as MessageEvent).data) as JobProgress);
          } catch {
            /* skip a malformed frame */
          }
        });
        es.addEventListener('done', (e) => {
          es.close();
          try {
            resolve(JSON.parse((e as MessageEvent).data) as AgentResponse);
          } catch (err) {
            reject(err);
          }
        });
        es.onerror = () => {
          es.close();
          reject(new Error('agent stream closed'));
        };
      });
    },

    detectSubjects: (imageUrl) =>
      post<DetectedSubject[]>('/agent/detect_subjects', { imageUrl }),

    readSpriteSheet: (url) => post<SpriteSheetReading>('/agent/read_sprite_sheet', { url }),
  };
}
