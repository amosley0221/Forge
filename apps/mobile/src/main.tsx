import React from 'react';
import { createRoot } from 'react-dom/client';
import '@forge/ui/tokens.css';
import './mobile.css';
import { App } from './App.js';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
