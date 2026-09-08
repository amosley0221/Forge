import type {
  Asset,
  AssetClip,
  AssetVersion,
  Category,
  DeviceKind,
  Kind,
  MeshStats,
} from './types.js';
import type { ProviderId } from './providers/types.js';

export const uid = () => 'a' + Math.random().toString(36).slice(2, 10);

/** Every clip a freshly imported or generated model has, taken from the file. */
export function clipsFromStats(stats: MeshStats): AssetClip[] {
  return stats.clipNames.map((name) => ({ name, status: 'approved' as const }));
}

export interface NewAssetInput {
  name: string;
  category: Category;
  kind: Kind;
  device: DeviceKind;
  note: string;
  prompt: string;
  stats: MeshStats;
  fileId?: string;
  sourceUrl?: string;
  provider?: ProviderId;
  taskId?: string;
}

export function createAsset(input: NewAssetInput): Asset {
  const now = Date.now();
  const version: AssetVersion = {
    label: 'v1',
    note: input.note,
    prompt: input.prompt,
    device: input.device,
    createdAt: now,
    stats: input.stats,
    fileId: input.fileId,
    sourceUrl: input.sourceUrl,
    provider: input.provider,
    taskId: input.taskId,
  };
  return {
    id: uid(),
    name: input.name,
    category: input.category,
    kind: input.kind,
    device: input.device,
    createdAt: now,
    updatedAt: now,
    cur: 0,
    versions: [version],
    clips: clipsFromStats(input.stats),
  };
}

export function appendVersion(asset: Asset, version: Omit<AssetVersion, 'label'>): Asset {
  const versions = [
    ...asset.versions,
    { ...version, label: 'v' + (asset.versions.length + 1) },
  ];
  return { ...asset, versions, cur: versions.length - 1, updatedAt: Date.now() };
}

/** Derive a snake_case name from whatever the user typed or the file was called. */
export function nameFrom(source: string): string {
  const base = source.replace(/\.[a-z0-9]+$/i, '');
  return (
    base
      .split(/[,.\n—-]/)[0]
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9 _]/g, '')
      .split(/[\s_]+/)
      .filter((w) => w.length > 2 && !['the', 'and', 'with', 'for'].includes(w))
      .slice(0, 2)
      .join('_') || 'asset'
  );
}

export function ago(t: number): string {
  const d = Math.max(0, Date.now() - t) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  if (d < 86400) return Math.floor(d / 3600) + 'h ago';
  return Math.floor(d / 86400) + 'd ago';
}

export const formatTris = (n: number) => n.toLocaleString();

export const formatSize = (m: number) =>
  m >= 1 ? `${m.toFixed(1)} m` : `${Math.round(m * 100)} cm`;

export const formatBytes = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`;

export const reviewCount = (a: Asset | null | undefined) =>
  (a?.clips ?? []).filter((c) => c.status === 'review').length;

export const approvedCount = (a: Asset | null | undefined) =>
  (a?.clips ?? []).filter((c) => c.status === 'approved').length;

export const currentVersion = (a: Asset): AssetVersion => a.versions[a.cur] ?? a.versions[0];
