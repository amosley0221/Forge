/**
 * Provider APIs and their asset CDNs do not all send CORS headers, so a
 * WebView's own `fetch` cannot reliably call them. Each shell installs a client
 * that goes through native networking instead:
 *
 *   - Android: the CapacitorHttp plugin patches `window.fetch`.
 *   - Desktop: the Tauri HTTP plugin, installed synchronously at startup.
 *   - Plain browser (`npm run dev`): none, so provider calls fail with a
 *     message that names CORS as the reason.
 *
 * Which client is active is surfaced in Settings — when a download fails, the
 * first question is always "did the native client actually get installed?".
 */

export type HttpImpl = typeof fetch;

let impl: HttpImpl | null = null;
let implName = 'browser fetch';

/**
 * Called once by each app's entry point, before anything can make a request.
 * Installing it asynchronously would leave a window where calls silently use
 * the browser client instead.
 */
export function setHttpImpl(fn: HttpImpl | null, name = 'native'): void {
  impl = fn;
  implName = fn ? name : 'browser fetch';
}

/** The client provider calls and model downloads should use. */
export function http(): HttpImpl {
  return impl ?? globalThis.fetch.bind(globalThis);
}

/** True when a CORS-free client has been installed. */
export const hasNativeHttp = () => impl !== null;

/** Human-readable name of the active client, for Settings and error text. */
export const httpClientName = () => implName;
