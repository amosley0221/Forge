import { check } from '@tauri-apps/plugin-updater';
import type { Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

/**
 * Desktop in-app updates.
 *
 * The release workflow publishes `updater.json` alongside the installers,
 * signed with the key in `apps/desktop/updater/`. Tauri checks that signature
 * before it will install anything, then replaces the installed app in place —
 * on Windows it reruns the NSIS installer in passive mode, on macOS it swaps
 * the .app bundle. Either way there is no uninstall and no lost settings.
 *
 * The endpoint is `releases/latest/download/updater.json`, which always
 * redirects to the newest release, so it never has to change.
 */

export const RELEASES_PAGE = 'https://github.com/amosley0221/Forge/releases/latest';

const inTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface UpdateStatus {
  supported: boolean;
  available: boolean;
  version?: string;
  notes?: string;
  update?: Update;
  error?: string;
}

export async function checkForUpdate(): Promise<UpdateStatus> {
  if (!inTauri()) {
    return { supported: false, available: false };
  }
  try {
    const update = await check();
    if (!update) return { supported: true, available: false };
    return {
      supported: true,
      available: true,
      version: update.version,
      notes: update.body,
      update,
    };
  } catch (e) {
    return {
      supported: true,
      available: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Download and install, then relaunch. Progress is reported as a percentage
 * when the server sends a content length, and as bytes when it does not.
 */
export async function installUpdate(
  update: Update,
  onProgress?: (percent: number, downloaded: number, total: number | null) => void,
): Promise<void> {
  let downloaded = 0;
  let total: number | null = null;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        total = event.data.contentLength ?? null;
        onProgress?.(0, 0, total);
        break;
      case 'Progress':
        downloaded += event.data.chunkLength;
        onProgress?.(total ? Math.round((downloaded / total) * 100) : 0, downloaded, total);
        break;
      case 'Finished':
        onProgress?.(100, downloaded, total);
        break;
    }
  });

  // The installer has replaced the app; restart into the new build.
  await relaunch();
}
