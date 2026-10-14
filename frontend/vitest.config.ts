import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Components need a full canvas/WebGL environment to be worth asserting
      // on; the pure logic they call is what these tests cover.
      include: ['src/utils/**', 'src/hooks/**'],
    },
  },
});
