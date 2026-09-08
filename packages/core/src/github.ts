import { http } from './http.js';
import type { Asset } from './types.js';

/**
 * A GitHub repository used as the shared store for a Forge library.
 *
 * There is no server to run: the repo holds `library.json` (all asset
 * metadata) and one `models/<fileId>.glb` per model. Both apps read it on
 * launch and write to it after a change, so the phone picks up what the
 * desktop made and the other way round.
 *
 * Everything stored is a plain file — the models are browsable and
 * downloadable straight from github.com, which is the point.
 */

const API = 'https://api.github.com';

export interface GitHubConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

export interface LibraryManifest {
  version: 1;
  updatedAt: number;
  /** Which device wrote this revision, for the "updated from…" message. */
  device: string;
  assets: Asset[];
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

const LIBRARY_PATH = 'library.json';
const modelPath = (fileId: string) => `models/${fileId}.glb`;

const headers = (cfg: GitHubConfig, accept = 'application/vnd.github+json') => ({
  accept,
  authorization: `Bearer ${cfg.token}`,
  'x-github-api-version': '2022-11-28',
});

async function request(
  cfg: GitHubConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  let res: Response;
  try {
    res = await http()(`${API}${path}`, { ...init, headers: { ...headers(cfg), ...init.headers } });
  } catch (e) {
    throw new GitHubError(
      `Could not reach GitHub (${e instanceof Error ? e.message : 'network error'})`,
    );
  }
  return res;
}

async function failure(res: Response, what: string): Promise<GitHubError> {
  let detail = '';
  try {
    const body = (await res.json()) as { message?: string };
    detail = body.message ?? '';
  } catch {
    /* no JSON body */
  }
  if (res.status === 401) {
    return new GitHubError('GitHub rejected the token. Check it has not expired.', 401);
  }
  if (res.status === 403) {
    return new GitHubError(
      `GitHub refused the request — the token needs Contents: read and write on this repository. ${detail}`,
      403,
    );
  }
  if (res.status === 404) {
    return new GitHubError(
      'Repository not found, or the token cannot see it. Create it first and give the token access.',
      404,
    );
  }
  return new GitHubError(`${what} failed (${res.status}) ${detail}`.trim(), res.status);
}

/** Confirm the token works and the repo is writable before saving any of it. */
export async function checkAccess(cfg: GitHubConfig): Promise<{ ok: boolean; message: string }> {
  const res = await request(cfg, `/repos/${cfg.owner}/${cfg.repo}`);
  if (!res.ok) {
    const err = await failure(res, 'Repository check');
    return { ok: false, message: err.message };
  }
  const repo = (await res.json()) as { permissions?: { push?: boolean }; private?: boolean };
  if (repo.permissions && repo.permissions.push === false) {
    return { ok: false, message: 'The token can read this repository but not write to it.' };
  }
  return {
    ok: true,
    message: `Connected to ${cfg.owner}/${cfg.repo}${repo.private ? ' (private)' : ''}`,
  };
}

interface ContentMeta {
  sha: string;
  size: number;
  content?: string;
  encoding?: string;
  download_url?: string | null;
}

async function getMeta(cfg: GitHubConfig, path: string): Promise<ContentMeta | null> {
  const res = await request(
    cfg,
    `/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(cfg.branch)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw await failure(res, `Reading ${path}`);
  return (await res.json()) as ContentMeta;
}

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.replace(/\s/g, '');
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function encodeBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  // Chunked so a multi-megabyte model does not blow the argument limit.
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

async function putFile(
  cfg: GitHubConfig,
  path: string,
  content: string,
  message: string,
  sha?: string,
): Promise<void> {
  const res = await request(cfg, `/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, content, branch: cfg.branch, ...(sha ? { sha } : {}) }),
  });
  if (!res.ok) throw await failure(res, `Writing ${path}`);
}

/* ------------------------------------------------------------------ *
 * Library manifest
 * ------------------------------------------------------------------ */

export async function fetchLibrary(
  cfg: GitHubConfig,
): Promise<{ manifest: LibraryManifest | null; sha?: string }> {
  const meta = await getMeta(cfg, LIBRARY_PATH);
  if (!meta) return { manifest: null };

  let text: string;
  if (meta.content && meta.encoding === 'base64') {
    text = new TextDecoder().decode(decodeBase64(meta.content));
  } else if (meta.download_url) {
    const res = await http()(meta.download_url);
    if (!res.ok) throw new GitHubError(`Could not download the library manifest (${res.status})`);
    text = await res.text();
  } else {
    throw new GitHubError('GitHub returned a library manifest with no content');
  }

  try {
    return { manifest: JSON.parse(text) as LibraryManifest, sha: meta.sha };
  } catch {
    throw new GitHubError('The library manifest in the repository is not valid JSON');
  }
}

export async function pushLibrary(
  cfg: GitHubConfig,
  manifest: LibraryManifest,
  sha?: string,
): Promise<void> {
  const body = btoa(unescape(encodeURIComponent(JSON.stringify(manifest, null, 2) + '\n')));
  await putFile(cfg, LIBRARY_PATH, body, `Forge library from ${manifest.device}`, sha);
}

/* ------------------------------------------------------------------ *
 * Model files
 * ------------------------------------------------------------------ */

export async function hasModel(cfg: GitHubConfig, fileId: string): Promise<boolean> {
  return (await getMeta(cfg, modelPath(fileId))) !== null;
}

export async function uploadModel(
  cfg: GitHubConfig,
  fileId: string,
  blob: Blob,
): Promise<void> {
  const path = modelPath(fileId);
  const existing = await getMeta(cfg, path);
  if (existing) return; // model files are immutable — same id, same bytes
  await putFile(cfg, path, await encodeBase64(blob), `Forge model ${fileId}`);
}

export async function downloadModel(cfg: GitHubConfig, fileId: string): Promise<Blob | null> {
  const meta = await getMeta(cfg, modelPath(fileId));
  if (!meta) return null;

  // Files over 1 MB come back without inline content, so use the signed URL.
  if (meta.download_url) {
    const res = await http()(meta.download_url);
    if (!res.ok) throw new GitHubError(`Could not download model ${fileId} (${res.status})`);
    return res.blob();
  }
  if (meta.content && meta.encoding === 'base64') {
    const bytes = decodeBase64(meta.content);
    return new Blob([bytes.buffer as ArrayBuffer], { type: 'model/gltf-binary' });
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Merge
 * ------------------------------------------------------------------ */

/**
 * Union by asset id, newest wins per asset. Nothing is deleted by a sync:
 * an asset missing from one side is treated as "not seen here yet" rather
 * than "removed", so a stale device can never wipe the library.
 */
export function mergeLibraries(local: Asset[], remote: Asset[]): Asset[] {
  const byId = new Map<string, Asset>();
  for (const a of local) byId.set(a.id, a);
  for (const r of remote) {
    const l = byId.get(r.id);
    if (!l || r.updatedAt > l.updatedAt) byId.set(r.id, r);
  }
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Model files referenced by the library that this device does not have yet. */
export function missingFileIds(assets: Asset[], has: (fileId: string) => boolean): string[] {
  const ids = new Set<string>();
  for (const a of assets) {
    for (const v of a.versions) {
      if (v.fileId && !has(v.fileId)) ids.add(v.fileId);
    }
  }
  return [...ids];
}
