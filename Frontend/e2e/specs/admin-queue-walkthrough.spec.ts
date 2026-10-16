import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin } from '../modules/auth/login.module';

/**
 * A click-through of the three queues an admin actually works out of:
 * booking records, user management, and provider verification.
 *
 * This is a smoke walkthrough, not a behaviour spec — it asserts that each
 * queue loads, renders real rows, opens a record, and does so without the
 * backend returning an error or the page throwing. That last part is the
 * point: the controller layer was just refactored so every failure is
 * rendered by one shared handler, and a refactor like that fails silently —
 * the page still renders, the row is just empty. So every response and every
 * console error is collected and asserted on at the end of each leg.
 */

type Leg = {
  name: string;
  path: string;
  /** Text that proves the queue actually painted its own content. */
  ready: RegExp;
  /**
   * The record rows themselves. Deliberately specific per page: a generic
   * "anything clickable" selector matches the stat cards at the top, which
   * only re-filter the list — so the click appears to work, the screenshot
   * looks plausible, and nothing was actually opened.
   */
  rowSelector: string;
};

const LEGS: Leg[] = [
  {
    name: 'Booking records (Jobs)',
    path: '/jobs',
    ready: /jobs|booking/i,
    rowSelector: '[data-testid^="admin-job-row-"]',
  },
  {
    name: 'User management',
    path: '/users',
    ready: /users|customers|providers/i,
    rowSelector: 'table tbody tr',
  },
  {
    name: 'Provider verification queue',
    path: '/verifications',
    ready: /verificat/i,
    rowSelector: 'table tbody tr',
  },
];

/** Collects everything that would otherwise fail quietly. */
function watch(page: Page) {
  const apiFailures: string[] = [];
  const consoleErrors: string[] = [];
  const apiCalls: string[] = [];

  page.on('response', (res) => {
    const url = res.url();
    if (!url.includes('/api/')) return;
    const line = `${res.status()} ${res.request().method()} ${url.replace(/^https?:\/\/[^/]+/, '')}`;
    apiCalls.push(line);
    // 401 on a logged-out probe is normal; anything else in 4xx/5xx is not.
    if (res.status() >= 400 && res.status() !== 401) apiFailures.push(line);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
  });

  page.on('pageerror', (error) => {
    consoleErrors.push(`UNCAUGHT: ${error.message.slice(0, 300)}`);
  });

  return { apiFailures, consoleErrors, apiCalls };
}

test.describe('Admin queue walkthrough', () => {
  test('booking records, user management and verification queues all load and open', async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000);
    const seen = watch(page);

    await loginAsAdmin(page);
    await page.screenshot({ path: testInfo.outputPath('00-after-login.png'), fullPage: false });

    for (const [index, leg] of LEGS.entries()) {
      await test.step(leg.name, async () => {
        await page.goto(leg.path);

        // The app renders its shell immediately and fills the table from the
        // API, so waiting for the shell proves nothing. Wait for the network
        // to settle, then for real text on the page.
        await page.waitForLoadState('networkidle');
        await expect(page.locator('body')).toContainText(leg.ready, { timeout: 15_000 });

        const shot = `${String(index + 1).padStart(2, '0')}-${leg.path.replace(/\//g, '')}.png`;
        await page.screenshot({ path: testInfo.outputPath(shot), fullPage: false });

        // Open the first record. A queue that lists rows but cannot open one
        // is broken in exactly the way that matters to an admin.
        const rows = page.locator(leg.rowSelector);
        const rowCount = await rows.count();
        console.log(`  ${leg.name}: ${rowCount} record row(s)`);
        expect(rowCount, `${leg.name} rendered no rows`).toBeGreaterThan(0);

        await rows.first().click({ timeout: 10_000 });

        // The detail view is a modal over a dimmed backdrop. Waiting for the
        // backdrop is what distinguishes "a record opened" from "the click
        // landed on something inert" — the failure mode of the first attempt.
        const modal = page.locator('.fixed.inset-0.bg-black').first();
        await expect(modal, `${leg.name}: clicking a row opened no detail modal`).toBeVisible({
          timeout: 10_000,
        });

        await page.waitForTimeout(800);
        await page.screenshot({
          path: testInfo.outputPath(`${String(index + 1).padStart(2, '0')}-${leg.path.replace(/\//g, '')}-detail.png`),
          fullPage: false,
        });

        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      });
    }

    console.log(`\n  API calls observed: ${seen.apiCalls.length}`);
    seen.apiCalls.forEach((call) => console.log(`    ${call}`));

    if (seen.apiFailures.length > 0) {
      console.log('\n  API FAILURES:');
      seen.apiFailures.forEach((failure) => console.log(`    ${failure}`));
    }
    if (seen.consoleErrors.length > 0) {
      console.log('\n  CONSOLE ERRORS:');
      seen.consoleErrors.forEach((error) => console.log(`    ${error}`));
    }

    expect(seen.apiFailures, `backend returned errors:\n${seen.apiFailures.join('\n')}`).toEqual([]);
    expect(
      seen.consoleErrors,
      `page threw errors:\n${seen.consoleErrors.join('\n')}`,
    ).toEqual([]);
  });
});
