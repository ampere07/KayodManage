import { test } from '@playwright/test';
import { loginAsAdmin } from '../modules/auth/login.module';

/**
 * Self-contained smoke test: no fixture data required. Every other spec in
 * this suite depends on this working, so it's the harness's own health check.
 */
test.describe('admin auth', () => {
  test('admin can log in through the real login form and reach the dashboard', async ({ page }) => {
    await loginAsAdmin(page);
  });
});
