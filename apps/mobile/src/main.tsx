import React from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { setHttpImpl } from '@forge/core';
import '@forge/ui/tokens.css';

// CapacitorHttp patches window.fetch to go through native networking, which is
// what lets provider calls past the WebView's CORS rules.
if (Capacitor.isNativePlatform()) {
  setHttpImpl(globalThis.fetch.bind(globalThis));
}
import './mobile.css';
import { App } from './App.js';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
