import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';

import 'leaflet/dist/leaflet.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/dm-sans/300.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import 'material-symbols/outlined.css';
import './index.css';

import App from './App.jsx';
import { GOOGLE_CLIENT_ID } from './app/config/env.js';
import { installGlobalButtonLoading } from './lib/buttonLoading.js';
// Side-effect import ONLY: attaches the global beforeinstallprompt listener at
// boot so an install prompt firing before hydration is never missed.
import './lib/pwaInstall.js';

installGlobalButtonLoading();

if (!GOOGLE_CLIENT_ID && import.meta.env.DEV) {
  console.warn('[env] VITE_GOOGLE_CLIENT_ID not set — Google login disabled');
}

function getRootElement() {
  const el = document.getElementById('root');
  if (!el) {
    throw new Error('[boot] #root element not found — check index.html');
  }
  return el;
}

createRoot(getRootElement()).render(
  <StrictMode>
    <BrowserRouter>
      {GOOGLE_CLIENT_ID ? (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          <App />
        </GoogleOAuthProvider>
      ) : (
        <App />
      )}
    </BrowserRouter>
  </StrictMode>,
);