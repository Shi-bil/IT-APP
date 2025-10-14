import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { pathToFileURL } from 'url';

// Helper to wrap ESM handlers so we can call them from Node-style middleware
function wrapHandler(handler) {
  return async (req, res) => {
    // Collect body if JSON
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
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
  plugins: [
    react(),
    {
      name: 'dev-api-middleware',
      configureServer(server) {
        const wrapHandler = (handler) => async (req, res, next) => {
          if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const raw = Buffer.concat(chunks).toString();
            try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
          }
          try {
            await handler(req, res);
          } catch (e) {
            next(e);
          }
        };

        server.middlewares.use('/api/send-code', async (req, res, next) => {
          if (req.method !== 'POST') return next();
          const mod = await import(pathToFileURL(path.resolve('api/send-code.js')).href);
          const handler = mod.default || mod.handler || mod;
          return wrapHandler(handler)(req, res, next);
        });

        server.middlewares.use('/api/verify-code', async (req, res, next) => {
          if (req.method !== 'POST') return next();
          const mod = await import(pathToFileURL(path.resolve('api/verify-code.js')).href);
          const handler = mod.default || mod.handler || mod;
          return wrapHandler(handler)(req, res, next);
        });
      },
    },
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});