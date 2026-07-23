import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { selectors } from '../../contracts/selectors.contract';

/**
 * Searches the Jobs list for a job by title, reads the status badge actually
 * rendered on its ROW (job.status is never re-rendered inside the details
 * modal — only the row shows it, e.g. "in progress" / "completed" /
 * "cancelled"), then opens the modal. Same navigation as
 * forceCancelJobByTitle, but returns the row's own status text as DOM proof
 * instead of trusting resolveDispute's response body.
 */
export async function openJobByTitle(page: Page, jobTitle: string) {
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
  const rowStatus = (await row.innerText()).toLowerCase();

  await row.click();

  return { rowStatus };
}

/**
 * Reads the escrow card actually rendered in the (already-open) Job Details
 * modal — "Status: pending/released/refunded" and, if present, the release
 * date. This is the DOM proof that a resolveDispute outcome took effect,
 * instead of trusting the /resolve-dispute response body: the whole point of
 * fixing the paymentReleased-timing bug was that the API's own JSON used to
 * disagree with what the UI actually showed.
 */
export async function readJobEscrowState(page: Page) {
  const card = page.getByTestId(selectors.jobs.escrowCard);
  const hasEscrowCard = await card.isVisible().catch(() => false);
  if (!hasEscrowCard) {
    return { visible: false, status: null, releaseDate: null };
  }

  const statusText = await page.getByTestId(selectors.jobs.escrowStatus).innerText();
  const releaseDateEl = page.getByTestId(selectors.jobs.escrowReleaseDate);
  const releaseDateText = (await releaseDateEl.isVisible().catch(() => false))
    ? await releaseDateEl.innerText()
    : null;

  return {
    visible: true,
    // "Status: pending" -> "pending"
    status: statusText.replace(/^Status:\s*/i, '').trim().toLowerCase(),
    releaseDate: releaseDateText ? releaseDateText.replace(/^Release date:\s*/i, '').trim() : null,
  };
}

/** Whether the modal's "Active Dispute" banner is currently rendered. */
export async function hasActiveDisputeBanner(page: Page) {
  return page.getByTestId(selectors.jobs.activeDisputeBanner).isVisible().catch(() => false);
}
