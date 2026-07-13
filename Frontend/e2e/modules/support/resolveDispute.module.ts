import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { selectors } from '../../contracts/selectors.contract';

type DisputeOutcome = 'pay_provider' | 'refund_client' | 'rebook';

const OUTCOME_TESTID: Record<DisputeOutcome, string> = {
  pay_provider: selectors.support.resolveDisputePayProvider,
  refund_client: selectors.support.resolveDisputeRefundClient,
  rebook: selectors.support.resolveDisputeRebook,
};

/**
 * Opens the dispute ticket for a job (raiseDispute files it with subject
 * "Dispute: <job title>") from the Support inbox and resolves it via one of
 * the three real mediation buttons. Asserts on the actual
 * POST /:jobId/resolve-dispute response.
 */
export async function resolveDisputeFromSupportInbox(
  page: Page,
  jobTitle: string,
  outcome: DisputeOutcome,
  note = 'Resolved via e2e',
) {
  await page.goto('/support');

  const ticketRow = page.getByText(`Dispute: ${jobTitle}`, { exact: false }).first();
  await expect(ticketRow).toBeVisible();
  await ticketRow.click();

  const noteBox = page.getByPlaceholder('Resolution note (sent to both parties)…');
  await expect(noteBox).toBeVisible();
  await noteBox.fill(note);

  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/resolve-dispute') && res.request().method() === 'POST'),
    page.getByTestId(OUTCOME_TESTID[outcome]).click(),
  ]);

  expect(response.ok(), `resolve-dispute (${outcome}) request should succeed`).toBeTruthy();
  const body = await response.json();
  expect(body.success).toBeTruthy();
  return body;
}

/** Adds an admin-only internal note to whichever chat is currently open. */
export async function addInternalNote(page: Page, note: string) {
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/internal-notes') && res.request().method() === 'POST'),
    (async () => {
      await page.getByTestId(selectors.support.internalNoteInput).fill(note);
      await page.getByTestId(selectors.support.internalNoteSubmit).click();
    })(),
  ]);

  expect(response.ok()).toBeTruthy();
}
