import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../modules/auth/login.module';
import { forceCancelJobByTitle } from '../modules/jobs/forceCancelJob.module';

/**
 * Covers improvements doc §1: admin force-cancel releases held funds and
 * updates the job, exercised through the real Jobs list → job details →
 * "Cancel Job" button, including the native confirmation prompt.
 *
 * Needs a real fixture job in `in_progress` with a held payment — this app
 * doesn't own job creation (kayod/client does), and KayodManage's Job model
 * requires several cross-referenced fields (profession, categoryId, a real
 * held Transaction) that only the real client booking flow produces
 * correctly. Rather than fake that with a fragile in-repo seed script,
 * create one via kayod/client's e2e suite (createJob.module.ts +
 * bookProvider.module.ts) or manually through the app once, then point
 * E2E_FORCE_CANCEL_JOB_TITLE at its exact title.
 */
test.describe('admin force-cancel job', () => {
  test('cancelling a booked job releases the held payment and notifies both parties', async ({ page }) => {
    const jobTitle = process.env.E2E_FORCE_CANCEL_JOB_TITLE;
    test.skip(!jobTitle, 'Set E2E_FORCE_CANCEL_JOB_TITLE to a real in_progress job with a held payment — see module comment.');

    await loginAsAdmin(page);
    const result = await forceCancelJobByTitle(page, jobTitle!, 'e2e: verifying force-cancel refund path');

    expect(result.job.status).toBe('cancelled');
    expect(result.refundedAmount).toBeGreaterThan(0);
  });
});
