import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Invariants:
// - proxy /api/* → bp-backend:3000 in dev (Docker hostname; fallback to localhost:3000 outside docker).
// - no source maps in prod build (would leak prompt-template filenames to clients).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    // :5173 / :3000 заняты chip-frontend-1 / chip-backend-1 другого проекта.
    // BP в dev слушает :5174 и проксирует на :3001. В docker-compose переменные
    // окружения BACKEND_URL всё ещё указывают на bp-backend:3000 как раньше.
    port: Number(process.env.FRONTEND_PORT ?? 5174),
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: false,
    outDir: 'dist',
    emptyOutDir: true,
  },
});
