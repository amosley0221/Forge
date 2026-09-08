import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { revealItemInDir } from '@tauri-apps/plugin-opener';

/**
 * Saving a model from the desktop app.
 *
 * A browser-style `<a download>` inside the Tauri WebView drops the file
 * somewhere the user then has to go hunting for. This asks where to put it,
 * defaults to a sensible filename, and offers to open the containing folder
 * afterwards.
 */

const inTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface SaveResult {
  /** Absolute path, or null when the user cancelled. */
  path: string | null;
}

export async function saveModel(blob: Blob, suggestedName: string): Promise<SaveResult> {
  if (!inTauri()) {
    // Plain browser (npm run dev): fall back to a download.
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = suggestedName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return { path: null };
  }

  const path = await save({
    defaultPath: suggestedName,
    filters: [{ name: 'glTF binary', extensions: ['glb'] }],
  });
  if (!path) return { path: null };

  await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
  return { path };
}

/** Open the file manager with the saved file selected. */
export async function showInFolder(path: string): Promise<void> {
  if (!inTauri()) return;
  await revealItemInDir(path);
}

export const canRevealFiles = inTauri;
