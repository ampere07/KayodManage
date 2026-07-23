import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../modules/auth/login.module';
import { resolveDisputeFromSupportInbox } from '../modules/support/resolveDispute.module';
import { openJobByTitle, readJobEscrowState, hasActiveDisputeBanner } from '../modules/jobs/readJobEscrowState.module';

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
 *
 * The pay_provider and refund_client cases below specifically cover the
 * "dispute raised during the 5-day escrow hold" scenario — i.e. the fixture
 * job should already be job.status === "completed" (both parties confirmed)
 * with the dispute raised *during* that hold, not before it. raiseDispute and
 * EscrowService.processEscrowRelease (kayod/server) both gate on this: a
 * completed-but-unpaid job can still be disputed, and the scheduled release
 * pauses for as long as the dispute stays active. Set
 * E2E_DISPUTE_JOB_TITLE_PAY_PROVIDER / E2E_DISPUTE_JOB_TITLE_REFUND_CLIENT to
 * such fixtures to exercise those two paths independently of the rebook one.
 *
 * Verification below reads the Job Details modal's rendered DOM (the escrow
 * card, the dispute banner) rather than trusting the /resolve-dispute JSON
 * body — the bug this whole suite guards against was exactly the backend's
 * own response disagreeing with what the UI actually showed. The response
 * body is only used for fields that have no on-screen equivalent at all
 * (e.g. refundedAmount, which the admin UI never renders back).
 */
test.describe('admin resolve dispute', () => {
  test('rebook keeps the job with the same provider and archives the dispute', async ({ page }) => {
    const jobTitle = process.env.E2E_DISPUTE_JOB_TITLE;
    test.skip(!jobTitle, 'Set E2E_DISPUTE_JOB_TITLE to a job with an active dispute — see module comment.');

    await loginAsAdmin(page);
    await resolveDisputeFromSupportInbox(page, jobTitle!, 'rebook', 'e2e: rebook outcome');

    const { rowStatus } = await openJobByTitle(page, jobTitle!);
    expect(rowStatus).toContain('in progress');
    expect(await hasActiveDisputeBanner(page)).toBe(false);
  });

  test('pay provider on a disputed hold reschedules a fresh 5-day release instead of paying immediately', async ({ page }) => {
    const jobTitle = process.env.E2E_DISPUTE_JOB_TITLE_PAY_PROVIDER;
    test.skip(
      !jobTitle,
      'Set E2E_DISPUTE_JOB_TITLE_PAY_PROVIDER to a completed job with a dispute raised during its escrow hold — see module comment.',
    );

    await loginAsAdmin(page);
    await resolveDisputeFromSupportInbox(page, jobTitle!, 'pay_provider', 'e2e: pay provider outcome');

    // DOM proof, not an API trust check: open the job's own details modal and
    // read the escrow card actually rendered there.
    const { rowStatus } = await openJobByTitle(page, jobTitle!);
    expect(rowStatus).toContain('completed');
    expect(await hasActiveDisputeBanner(page)).toBe(false);

    const escrow = await readJobEscrowState(page);
    expect(escrow.visible, 'escrow card should be rendered once escrowStatus is set').toBe(true);

    // The regression this guards: resolveDispute must NOT pay immediately —
    // the card must read "pending" (a fresh 5-day hold), never "released".
    // If it ever shows released here, resolveDispute flipped paymentReleased
    // itself, and the real release job will later see "already released" and
    // silently skip crediting the provider (EscrowService's early-exit guard).
    expect(escrow.status).toBe('pending');

    if (escrow.releaseDate) {
      const releaseAt = new Date(escrow.releaseDate).getTime();
      const fourDaysMs = 4 * 24 * 60 * 60 * 1000;
      expect(releaseAt).toBeGreaterThan(Date.now() + fourDaysMs);
    }
  });

  test('refund client on a disputed hold refunds immediately and leaves nothing for a later payout', async ({ page }) => {
    const jobTitle = process.env.E2E_DISPUTE_JOB_TITLE_REFUND_CLIENT;
    test.skip(
      !jobTitle,
      'Set E2E_DISPUTE_JOB_TITLE_REFUND_CLIENT to a completed job with a dispute raised during its escrow hold — see module comment.',
    );

    await loginAsAdmin(page);
    const result = await resolveDisputeFromSupportInbox(page, jobTitle!, 'refund_client', 'e2e: refund client outcome');

    // refundedAmount has no on-screen equivalent in the admin UI — this is
    // the one field kept from the response body rather than the DOM.
    expect(result.refundedAmount).toBeGreaterThan(0);

    // DOM proof for everything that IS rendered: open the job's own details
    // modal and read the escrow card.
    const { rowStatus } = await openJobByTitle(page, jobTitle!);
    expect(rowStatus).toContain('cancelled');
    expect(await hasActiveDisputeBanner(page)).toBe(false);

    const escrow = await readJobEscrowState(page);
    expect(escrow.visible, 'escrow card should be rendered once escrowStatus is set').toBe(true);

    // The regression this guards: a dispute raised mid-hold leaves a live
    // EscrowRelease record behind. Refunding must close it out — rendered
    // here as "refunded" — so a later scheduler tick can't pay the provider
    // out of that stale record after the client already got their money back.
    expect(escrow.status).toBe('refunded');
  });
});
