/**
 * Provider APIs do not send CORS headers, so a WebView's own `fetch` cannot
 * call them. Each shell installs a client that goes through native networking
 * instead:
 *
 *   - Android: the CapacitorHttp plugin patches `window.fetch`, so the default
 *     is already correct.
 *   - Desktop: the Tauri HTTP plugin, installed by the app at startup.
 *   - Plain browser (`npm run dev`): no such client exists, so provider calls
 *     fail with a message that says why.
 */

export type HttpImpl = typeof fetch;

let impl: HttpImpl | null = null;

/** Called once by each app's entry point. */
export function setHttpImpl(fn: HttpImpl | null): void {
  impl = fn;
}

/** The client provider calls and model downloads should use. */
export function http(): HttpImpl {
  return impl ?? globalThis.fetch.bind(globalThis);
}

/** True when a CORS-free client has been installed. */
export const hasNativeHttp = () => impl !== null;
