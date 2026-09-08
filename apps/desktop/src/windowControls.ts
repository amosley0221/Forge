/**
 * The window is borderless (`decorations: false` in tauri.conf.json) so the
 * top bar can host the traffic lights itself — which means those buttons have
 * to actually work, or a Windows user has no way to close the app. Outside
 * Tauri (plain `npm run dev`) they are inert.
 */
const inTauri = () =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function currentWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow();
}

export const isDesktopShell = inTauri;

export async function closeWindow() {
  if (!inTauri()) return;
  await (await currentWindow()).close();
}

export async function minimizeWindow() {
  if (!inTauri()) return;
  await (await currentWindow()).minimize();
}

export async function toggleMaximizeWindow() {
  if (!inTauri()) return;
  await (await currentWindow()).toggleMaximize();
}
