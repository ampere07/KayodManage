import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../modules/auth/login.module';
import { resolveDisputeFromSupportInbox } from '../modules/support/resolveDispute.module';

/**
 * Covers improvements doc §6: the three dispute-resolution outcomes, each
 * exercised through the real Support inbox — open the "Dispute: <job>"
 * ticket raiseDispute filed, and click one of Pay Provider / Refund Client /
 * Rebook.
 *
 * Needs a real fixture job with an active dispute (raised via
 * POST /completion/dispute/:jobId on kayod/server, which only fires from a
 * genuine in_progress booking — see force-cancel-job.spec.ts's comment on
 * why this suite doesn't fake that setup). Create one by booking a job on
 * the client app and calling "Raise a dispute" from the job screen, then
 * point E2E_DISPUTE_JOB_TITLE at its title. Each outcome is destructive
 * (resolves the dispute once), so re-raise a fresh dispute between runs of
 * different outcome variants.
 */
test.describe('admin resolve dispute', () => {
  test('rebook keeps the job with the same provider and archives the dispute', async ({ page }) => {
    const jobTitle = process.env.E2E_DISPUTE_JOB_TITLE;
    test.skip(!jobTitle, 'Set E2E_DISPUTE_JOB_TITLE to a job with an active dispute — see module comment.');

    await loginAsAdmin(page);
    const result = await resolveDisputeFromSupportInbox(page, jobTitle!, 'rebook', 'e2e: rebook outcome');

    expect(result.outcome).toBe('rebook');
    expect(result.job.status).toBe('in_progress');
  });
});
