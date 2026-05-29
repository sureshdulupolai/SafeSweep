import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './', // Essential for Electron to load resources correctly via file://
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src-ui'),
    },
  },
  build: {
    outDir: 'dist-ui',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
