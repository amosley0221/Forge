import { Capacitor, registerPlugin } from '@capacitor/core';
import { APP_VERSION } from './version.js';

/**
 * In-app updates for the sideloaded APK.
 *
 * The release workflow publishes `latest.json` on every GitHub release, so the
 * app reads one small file from a stable URL instead of the GitHub API (no rate
 * limit, no token). `releases/latest/download/<name>` always redirects to the
 * newest release, so this URL never has to change.
 *
 * Installing over the existing app — rather than uninstall-then-install —
 * requires two things, both guaranteed by the release workflow:
 *   1. the same applicationId (`games.dustline.forge`), and
 *   2. the same signing certificate on every build.
 * Android rejects an update signed by a different key, which is what forces
 * the "uninstall first" dance when APKs are signed with throwaway debug keys.
 */

export const REPO_OWNER = 'amosley0221';
export const REPO_NAME = 'Forge';
export const LATEST_JSON_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/latest.json`;
export const RELEASES_PAGE = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

export interface ForgeUpdaterPlugin {
  /** Version of the running build, straight from the PackageManager. */
  getInfo(): Promise<{ packageName: string; versionName: string; versionCode: number }>;
  /** True when the user has granted "install unknown apps" for Forge. */
  canInstall(): Promise<{ granted: boolean }>;
  /** Opens the system screen where that permission is granted. */
  requestInstallPermission(): Promise<void>;
  /** Downloads the APK and hands it to the system installer. */
  downloadAndInstall(options: { url: string; versionName: string }): Promise<{ started: boolean }>;
  addListener(
    event: 'downloadProgress',
    fn: (p: { percent: number; bytes: number; total: number }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

const Native = registerPlugin<ForgeUpdaterPlugin>('ForgeUpdater');

export interface LatestRelease {
  versionName: string;
  versionCode: number;
  notes?: string;
  publishedAt?: string;
  apk: { url: string; size?: number; sha256?: string };
}

export interface UpdateStatus {
  supported: boolean;
  current: { versionName: string; versionCode: number };
  latest?: LatestRelease;
  updateAvailable: boolean;
  error?: string;
}

const isAndroid = () => Capacitor.getPlatform() === 'android';

export async function currentVersion(): Promise<{ versionName: string; versionCode: number }> {
  if (!isAndroid()) return { versionName: APP_VERSION, versionCode: 0 };
  try {
    const info = await Native.getInfo();
    return { versionName: info.versionName, versionCode: info.versionCode };
  } catch {
    return { versionName: APP_VERSION, versionCode: 0 };
  }
}

export async function checkForUpdate(): Promise<UpdateStatus> {
  const current = await currentVersion();
  if (!isAndroid()) {
    return { supported: false, current, updateAvailable: false };
  }
  try {
    const res = await fetch(LATEST_JSON_URL, { cache: 'no-store', redirect: 'follow' });
    if (!res.ok) throw new Error(`release manifest: ${res.status}`);
    const latest = (await res.json()) as LatestRelease;
    return {
      supported: true,
      current,
      latest,
      // versionCode is the only monotonic value Android itself compares.
      updateAvailable: Number(latest.versionCode) > current.versionCode,
    };
  } catch (e) {
    return {
      supported: true,
      current,
      updateAvailable: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function installUpdate(
  latest: LatestRelease,
  onProgress?: (percent: number) => void,
): Promise<void> {
  if (!isAndroid()) throw new Error('Updates install on Android only');
  const { granted } = await Native.canInstall();
  if (!granted) {
    await Native.requestInstallPermission();
    throw new Error(
      'Allow Forge to install apps, then tap Update again — Android only asks once.',
    );
  }
  let handle: { remove: () => Promise<void> } | undefined;
  if (onProgress) {
    handle = await Native.addListener('downloadProgress', (p) => onProgress(p.percent));
  }
  try {
    await Native.downloadAndInstall({ url: latest.apk.url, versionName: latest.versionName });
  } finally {
    await handle?.remove();
  }
}
