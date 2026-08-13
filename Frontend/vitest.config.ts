import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Unit/DOM test config, kept separate from vite.config.ts so the dev server's
 * /api proxy never leaks into tests — nothing under src/**\/__tests__ is allowed
 * to reach a backend. These are rendering and decision-branch tests only.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // e2e/ is Playwright's; it needs a running stack and must not be picked up
    // by the unit runner.
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
