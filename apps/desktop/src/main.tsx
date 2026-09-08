import React from 'react';
import { createRoot } from 'react-dom/client';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { setHttpImpl } from '@forge/core';
import '@forge/ui/tokens.css';
import { App } from './App.js';

/**
 * Meshy's API allows cross-origin calls but its asset CDN does not, so a
 * download that used the WebView's own fetch would fail with "Failed to fetch"
 * *after* the provider had already charged for the model. Install Tauri's
 * native client before rendering — statically, so there is no window in which
 * a request could slip through on the browser client, and no rejected dynamic
 * import that could disable it silently.
 */
if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
  try {
    setHttpImpl(tauriFetch as unknown as typeof fetch, 'Tauri native HTTP');
  } catch (e) {
    console.error('Could not install the native HTTP client', e);
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
