import { defineConfig } from 'vite';

export default defineConfig({
  // Preview-среда Arena обращается к dev-серверу по внешнему домену,
  // поэтому слушаем все интерфейсы и разрешаем любые Host-заголовки.
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: false,
    allowedHosts: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
