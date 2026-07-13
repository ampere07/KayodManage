import { defineConfig, devices } from '@playwright/test';

/**
 * KayodManage Frontend e2e config.
 *
 * Mirrors kayod/client's "servers already running" default: this suite
 * assumes the KayodManage Backend (port 5000 by default) and this Vite dev
 * server (port 5173) are already up, matching the client app's e2e/README.md
 * philosophy of persistent servers over Playwright-managed ones for local
 * runs. Override BASE_URL for CI or a different port.
 */
export default defineConfig({
  testDir: './specs',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // admin actions mutate shared job/support state
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
