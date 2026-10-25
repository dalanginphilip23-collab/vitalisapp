import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { fileURLToPath } from 'url';

/* global process */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const proxyErrorHandler = (proxy) => {
  proxy.on('error', (err, req, res) => {
    try {
      if (res && res.writeHead && !res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Backend unreachable', code: 'UPSTREAM' }));
      } else if (res && res.destroy) {
        res.destroy();
      }
    } catch {
      /* socket already gone */
    }
  });
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const backendTarget = env.BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3000';
  const hmrPort = env.VITE_HMR_CLIENT_PORT || process.env.VITE_HMR_CLIENT_PORT;
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['offline.html', 'robots.txt', 'favicon.ico', 'apple-touch-icon.png'],
        manifest: {
          id: '/',
          name: 'Vitalis',
          short_name: 'Vitalis',
          description: 'AI-powered fitness tracking',
          theme_color: '#050501',
          background_color: '#050501',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          categories: ['health', 'fitness', 'lifestyle'],
          // Lets the landing page ask "is Vitalis already installed?" via
          // navigator.getInstalledRelatedApps() (Chrome Android 84+; desktop
          // Chrome/Edge 140+ needs the absolute id). Set PWA_ORIGIN env to the
          // deployed https origin (e.g. https://vitalis.app) for desktop.
          related_applications: [
            {
              platform: 'webapp',
              url: '/manifest.webmanifest',
              ...(process.env.PWA_ORIGIN
                ? { id: `${String(process.env.PWA_ORIGIN).replace(/\/+$/, '')}/` }
                : {}),
            },
          ],
          shortcuts: [
            { name: 'Dashboard', url: '/dashboard' },
            { name: 'Log workout', url: '/dashboard/logs' },
          ],
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: 'maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff2}'],
          // Hero/auth JPGs (~830KB) stay lazy-loaded online, not precached — offline shell uses offline.html.
          globIgnores: ['hero-gym.jpg', 'auth-gym.jpg'],
          navigateFallback: '/offline.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern:
                /https:\/\/(tile\.openstreetmap\.org|server\.arcgisonline\.com|.*basemaps\.cartocdn\.com)\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'map-tiles',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
              },
            },
            {
              // User-scoped API reads must never be served stale (shared-device safety):
              // always go to network; offline shell is handled by offline.html + local cache.
              urlPattern: /\/api\/.*/,
              handler: 'NetworkOnly',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: { exclude: ['@mediapipe/pose'] },
    build: {
      // 1000 hid bloat (Plans 48KB, Dropdown chunk 373KB flagged) — 500 surfaces it.
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        output: {
          // Rolldown/Vite 8 requires function form.
          manualChunks: (id) => {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@mediapipe')) return 'vendor-mediapipe';
            // react-leaflet intentionally stays with leaflet (map chunk), not react.
            if (id.includes('leaflet')) return 'vendor-map';
            if (id.includes('chart.js') || id.includes('react-chartjs-2')) return 'vendor-chart';
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('@tanstack') || id.includes('zustand')) return 'vendor-query';
            // Narrow React match: '/react/' over-matched paths like '@bryllim/.../react/'.
            if (
              id.includes('react-router') ||
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')
            )
              return 'vendor-react';
            return undefined;
          },
        },
      },
    },
    // Dev proxy keeps the session cookie first-party. Prod uses absolute VITE_* URLs.
    // BACKEND_URL overrides the target (default localhost:3000).
    server: {
      host: true,
      allowedHosts: true,
      hmr: hmrPort ? { clientPort: Number(hmrPort) } : true,
      proxy: {
        // Long-lived SSE must bypass the 15s /api timeout (else 504s). Listed first.
        '/api/notifications/stream': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          timeout: 660000,
          configure: proxyErrorHandler,
        },
        // AI failover can take ~2min: 120s entries listed before '/api'.
        ...Object.fromEntries(
          ['/api/coach', '/api/ai', '/api/ai-chat', '/api/analyze-pose', '/api/food-logs'].map(
            (p) => [
              p,
              {
                target: backendTarget,
                changeOrigin: true,
                secure: false,
                timeout: 120000,
                configure: proxyErrorHandler,
              },
            ]
          )
        ),
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          timeout: 15000,
          configure: proxyErrorHandler,
        },
        '/socket.io': {
          target: backendTarget,
          changeOrigin: true,
          ws: true,
          secure: false,
          configure: proxyErrorHandler,
        },
      },
    },
    preview: {
      host: true,
      port: 4173,
    },
  };
});
