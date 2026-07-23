import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(__dirname, '..'), '');
  const httpAddr = env.HTTP_ADDR || ':3001';
  const port = httpAddr.replace(':', '');
  const backendUrl = `http://localhost:${port}`;

  return {
    root: '.',
    envDir: resolve(__dirname, '..'),
    build: {
      outDir: '../internal/web/dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          display: resolve(__dirname, 'runner-display.html'),
          scanner: resolve(__dirname, 'runner-scanner.html'),
          pickups: resolve(__dirname, 'race-pack-pickups.html'),
        },
      },
    },
    server: {
      proxy: {
        '/api': backendUrl,
        '/auth': backendUrl,
        '/healthz': backendUrl,
        '/readyz': backendUrl,
      },
    },
  };
});
