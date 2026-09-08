import { zipSync } from 'fflate';
import { http } from './http.js';
import { fetchTaskAssets } from './providers/meshy.js';
import type { AssetVersion } from './types.js';

/**
 * Export formats beyond the GLB Forge stores.
 *
 * Forge does not convert anything: Meshy produces FBX, OBJ and USDZ from the
 * same job as the GLB, so an FBX export just fetches what the provider already
 * built. That means no extra credits — and no lossy conversion — but it also
 * means it only works for models Forge generated through Meshy. An imported
 * `.glb` has no provider task behind it.
 */

export type ExportFormat = 'glb' | 'fbx' | 'obj';

export interface ExportOption {
  format: ExportFormat;
  label: string;
  /** Why this one is or is not available for the current version. */
  note: string;
  available: boolean;
}

/** FBX and OBJ reference their textures as separate files, so they ship zipped. */
export const isBundled = (format: ExportFormat) => format !== 'glb';

export function exportOptions(version: AssetVersion | null): ExportOption[] {
  const fromMeshy = version?.provider === 'meshy' && Boolean(version.taskId);
  return [
    {
      format: 'glb',
      label: 'GLB',
      note: 'Textures embedded in one file. Godot and three.js read it directly.',
      available: Boolean(version?.fileId),
    },
    {
      format: 'fbx',
      label: 'FBX + textures',
      note: fromMeshy
        ? 'A zip of the .fbx and its texture maps — what Unity expects.'
        : 'Only for models generated through Meshy; this one has no provider task behind it.',
      available: fromMeshy,
    },
    {
      format: 'obj',
      label: 'OBJ + textures',
      note: fromMeshy
        ? 'A zip of the .obj, its .mtl and the texture maps.'
        : 'Only for models generated through Meshy.',
      available: fromMeshy,
    },
  ];
}

export interface BundleProgress {
  label: string;
  percent: number;
}

async function download(url: string, what: string): Promise<Uint8Array> {
  const res = await http()(url);
  if (!res.ok) throw new Error(`Could not download ${what} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

const extensionOf = (url: string, fallback: string) => {
  const clean = url.split('?')[0];
  const dot = clean.lastIndexOf('.');
  const ext = dot > -1 ? clean.slice(dot + 1) : '';
  return /^[a-z0-9]{2,5}$/i.test(ext) ? ext.toLowerCase() : fallback;
};

/**
 * Build a zip containing the requested model format plus every texture map
 * Meshy generated for it, named so the model's material references resolve.
 */
export async function buildExportBundle(opts: {
  apiKey: string;
  taskId: string;
  format: Exclude<ExportFormat, 'glb'>;
  /** Base filename, e.g. `wasteland_rover_v2`. */
  name: string;
  onProgress?: (p: BundleProgress) => void;
}): Promise<Blob> {
  const { apiKey, taskId, format, name, onProgress } = opts;

  onProgress?.({ label: 'Asking Meshy which formats it built', percent: 5 });
  const assets = await fetchTaskAssets(apiKey, taskId);

  const model = assets.models.find((m) => m.format === format);
  if (!model) {
    const had = assets.models.map((m) => m.format).join(', ') || 'none';
    throw new Error(
      `Meshy did not produce a ${format.toUpperCase()} for this model (it has: ${had}).`,
    );
  }

  const files: Record<string, Uint8Array> = {};

  onProgress?.({ label: `Downloading the ${format.toUpperCase()}`, percent: 20 });
  files[`${name}.${format}`] = await download(model.url, `the ${format.toUpperCase()}`);

  // OBJ keeps its material definitions in a sidecar file.
  if (format === 'obj') {
    const mtl = assets.models.find((m) => m.format === 'mtl');
    if (mtl) files[`${name}.mtl`] = await download(mtl.url, 'the .mtl');
  }

  const total = assets.textures.length;
  for (let i = 0; i < total; i++) {
    const tex = assets.textures[i];
    onProgress?.({
      label: `Downloading textures (${i + 1} of ${total})`,
      percent: 30 + Math.round((i / Math.max(1, total)) * 60),
    });
    const ext = extensionOf(tex.url, 'png');
    files[`textures/${name}_${tex.name}.${ext}`] = await download(tex.url, `texture ${tex.name}`);
  }

  onProgress?.({ label: 'Packing the zip', percent: 95 });
  // Textures are already compressed images; storing them keeps this quick.
  const zipped = zipSync(files, { level: 0 });
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
}
