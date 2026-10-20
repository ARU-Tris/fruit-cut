import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5178, strictPort: true },
  // Rapier includes its WASM in the entry so the standalone HTML works offline.
  build: { target: 'es2022', chunkSizeWarningLimit: 5500 },
});
