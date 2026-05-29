import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: 'src-ui', // Tells Vite that index.html is located inside src-ui/
  plugins: [react()],
  base: './', // Essential for Electron to load resources correctly via file://
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src-ui'),
    },
  },
  build: {
    outDir: '../dist-ui', // Outputs dist-ui/ to the project root folder
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
