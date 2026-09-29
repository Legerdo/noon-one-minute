import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
  },
  server: {
    // 5173은 다른 작업 공간의 서버가 쓰고 있어 고정 포트를 따로 둔다.
    port: 5288,
    strictPort: false,
  },
  preview: {
    port: 5289,
    strictPort: true,
  },
});
