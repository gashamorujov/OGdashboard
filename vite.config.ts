import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' makes every asset path relative, so the same build works at a domain root,
// in a sub-folder (GitHub Pages project sites, shared hosting) and behind any CDN.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true, allowedHosts: true },
  preview: { host: true, allowedHosts: true },
  build: { sourcemap: false, chunkSizeWarningLimit: 700 },
});
