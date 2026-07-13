import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { selectors } from '../../contracts/selectors.contract';

/**
 * Logs in as an admin through the real UI — fills the form, clicks submit,
 * and waits for the actual /api/auth login response before asserting the
 * dashboard has taken over. No direct API calls from the spec.
 */
export async function loginAsAdmin(
  page: Page,
  username = process.env.E2E_ADMIN_USERNAME || 'admin',
  password = process.env.E2E_ADMIN_PASSWORD || 'admin123',
) {
  await page.goto('/');
  await page.getByTestId(selectors.login.username).fill(username);
  await page.getByTestId(selectors.login.password).fill(password);

  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/auth/login') && res.request().method() === 'POST'),
    page.getByTestId(selectors.login.submit).click(),
  ]);

  expect(response.ok(), 'Admin login request should succeed — check E2E_ADMIN_USERNAME/E2E_ADMIN_PASSWORD against a seeded admin (see Backend/scripts/createAdmin.js)').toBeTruthy();
  await expect(page.getByTestId(selectors.login.username)).toHaveCount(0);
}
