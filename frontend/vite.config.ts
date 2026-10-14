import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
  },
  optimizeDeps: {
    // Pre-bundle the spreadsheet libraries at server start. Discovered lazily
    // instead, the first dynamic import triggers a re-optimise and a forced
    // page reload, which aborts the very import that triggered it.
    include: ['read-excel-file/universal', 'write-excel-file/universal'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split the heavy rendering libraries so a change to app code does
          // not invalidate them in the browser cache.
          konva: ['konva', 'react-konva'],
          pdf: ['jspdf', 'html2canvas'],
        },
      },
    },
  },
});
