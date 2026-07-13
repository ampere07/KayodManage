import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { selectors } from '../../contracts/selectors.contract';

/**
 * Searches the Jobs list for a job by title, opens it, and force-cancels it
 * through the real "Cancel Job (release held payment)" button — including
 * the native window.prompt() the handler uses for a cancellation reason.
 * Asserts on the actual POST /:jobId/force-cancel response, not a UI guess.
 */
export async function forceCancelJobByTitle(page: Page, jobTitle: string, reason: string) {
  const [initialJobsResponse] = await Promise.all([
    page.waitForResponse((res) => /\/api\/jobs\?/.test(res.url()) && res.request().method() === 'GET'),
    page.goto('/jobs'),
  ]);
  expect(initialJobsResponse.ok(), 'initial jobs list request should succeed').toBeTruthy();

  const [searchResponse] = await Promise.all([
    page.waitForResponse((res) => /\/api\/jobs\?/.test(res.url()) && res.request().method() === 'GET'),
    page.getByTestId(selectors.jobs.search).fill(jobTitle),
  ]);
  expect(searchResponse.ok(), 'search-filtered jobs request should succeed').toBeTruthy();

  const row = page.getByTestId(new RegExp('^admin-job-row-')).first();
  await expect(row).toBeVisible();
  await row.click();

  const cancelButton = page.getByTestId(selectors.jobs.forceCancelButton);
  await expect(cancelButton).toBeVisible();

  page.on('dialog', (dialog) => dialog.accept(reason));

  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/force-cancel') && res.request().method() === 'POST'),
    cancelButton.click(),
  ]);

  expect(response.ok(), 'force-cancel request should succeed').toBeTruthy();
  const body = await response.json();
  expect(body.success).toBeTruthy();
  return body;
}
