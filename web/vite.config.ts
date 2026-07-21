import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(__dirname, '..'), '');
  const httpAddr = env.HTTP_ADDR || ':3001';
  const port = httpAddr.replace(':', '');
  const backendUrl = `http://localhost:${port}`;

  return {
    root: '.',
    build: {
      outDir: '../internal/webui/dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          display: resolve(__dirname, 'runner-display.html'),
          scanner: resolve(__dirname, 'runner-scanner.html'),
        },
      },
    },
    server: {
      proxy: {
        '/api': backendUrl,
        '/healthz': backendUrl,
        '/readyz': backendUrl,
      },
    },
  };
});
