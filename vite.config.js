import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { pathToFileURL } from 'url';

// Helper to wrap ESM handlers so we can call them from Node-style middleware
function wrapHandler(handler) {
  return async (req, res) => {
    // Collect body if JSON
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString();
      try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    }
    return handler(req, res);
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: true,
    port: 5173,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.svg', 'pwa-192x192.svg', 'pwa-512x512.svg'],
      manifest: {
        name: 'IT Management System',
        short_name: 'IT MGMT',
        description: 'IT Asset Management System - Track and manage your IT inventory across all devices',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        scope: '/',
        start_url: '/',
        categories: ['business', 'productivity', 'utilities'],
        icons: [
          {
            src: 'pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ],
        screenshots: [
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            form_factor: 'wide',
            label: 'IT Management Dashboard'
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            form_factor: 'narrow',
            label: 'IT Management Mobile'
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    }),
    {
      name: 'dev-api-middleware',
      configureServer(server) {
        const wrapHandler = (handler) => async (req, res, next) => {
          // Parse query parameters from URL
          if (req.url) {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            req.query = {};
            urlObj.searchParams.forEach((value, key) => {
              req.query[key] = value;
            });
          }
          
          // Only parse body if it hasn't been parsed yet
          if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') && !req.body) {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const raw = Buffer.concat(chunks).toString();
            try { 
              req.body = raw ? JSON.parse(raw) : {}; 
              console.log(`[Vite] ${req.method} ${req.url} - Body parsed:`, req.body);
            } catch (e) { 
              req.body = {};
              console.error(`[Vite] ${req.method} ${req.url} - Body parse error:`, e.message);
            }
          }
          try {
            await handler(req, res);
          } catch (e) {
            console.error(`[Vite] Handler error for ${req.method} ${req.url}:`, e);
            next(e);
          }
        };

        server.middlewares.use('/api/send-code', async (req, res, next) => {
          if (req.method !== 'POST') return next();
          try {
            const mod = await import(
              pathToFileURL(
                path.resolve(server.config.root || process.cwd(), 'api', 'send-code.js')
              ).href + `?t=${Date.now()}`
            );
            const handler = mod.default || mod.handler || mod;
            return wrapHandler(handler)(req, res, next);
          } catch (e) {
            return next();
          }
        });

        server.middlewares.use('/api/verify-code', async (req, res, next) => {
          if (req.method !== 'POST') return next();
          try {
            const mod = await import(
              pathToFileURL(
                path.resolve(server.config.root || process.cwd(), 'api', 'verify-code.js')
              ).href + `?t=${Date.now()}`
            );
            const handler = mod.default || mod.handler || mod;
            return wrapHandler(handler)(req, res, next);
          } catch (e) {
            return next();
          }
        });

        // Generic catch-all for other /api/* routes during local dev
        server.middlewares.use(async (req, res, next) => {
          const url = req.url || '';
          if (!url.startsWith('/api/')) return next();
          
          console.log(`[Vite] Incoming request: ${req.method} ${url}`);
          console.log(`[Vite] Headers:`, req.headers);
          
          try {
            // Map /api/foo/bar -> api/foo/bar.js or api/foo/bar/index.js
            const clean = url.replace(/^\/api\//, '').split('?')[0].replace(/\/+$/, '');
            if (!clean) return next();
            
            const rootPath = server.config.root || process.cwd();
            let filePath = path.resolve(rootPath, 'api', `${clean}.js`);
            
            // Check if direct file exists, otherwise try index.js
            const fs = await import('fs');
            if (!fs.existsSync(filePath)) {
              const indexPath = path.resolve(rootPath, 'api', clean, 'index.js');
              if (fs.existsSync(indexPath)) {
                filePath = indexPath;
              }
            }
            
            console.log(`[Vite] Attempting to load: ${filePath}`);
            const mod = await import(pathToFileURL(filePath).href + `?t=${Date.now()}`);
            const handler = mod.default || mod.handler || mod;
            return wrapHandler(handler)(req, res, next);
          } catch (e) {
            console.error(`[Vite] Route error for ${url}:`, e.message);
            console.error(`[Vite] Stack trace:`, e.stack);
            return next();
          }
        });
      },
    },
  ],
  optimizeDeps: {
    include: [
      'lucide-react',
      'react',
      'react-dom',
      'react-router-dom',
      'recharts',
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Heavy export libraries - only loaded when needed
          'xlsx': ['xlsx'],
          'docx': ['docx'],
          'pdf': ['jspdf', 'jspdf-autotable'],
          'templates': ['pizzip', 'docxtemplater'],
          // Charts library
          'charts': ['recharts'],
          // React core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        }
      }
    },
    chunkSizeWarningLimit: 600,
  },
});