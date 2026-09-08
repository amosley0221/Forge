import React from 'react';
import { createRoot } from 'react-dom/client';
import { setHttpImpl } from '@forge/core';
import '@forge/ui/tokens.css';
import { App } from './App.js';

// Provider APIs send no CORS headers, so route them through Tauri's native
// HTTP client. Outside the shell there is none and the UI says why generation
// is unavailable.
if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
  void import('@tauri-apps/plugin-http').then(({ fetch: tauriFetch }) => {
    setHttpImpl(tauriFetch as unknown as typeof fetch);
  });
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
