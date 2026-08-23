const Transaction = require('../models/Transaction');
const escrowService = require('../services/escrowService');

/**
 * The money a dispute ruling is allowed to move, and which stage it is at.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * A client's payment passes through TWO resting states, and a dispute can be
 * raised in either:
 *
 *   1. `held`      — booked, not yet completed. The amount sits in the client's
 *                    wallet `heldBalance` and the escrow Transaction is `held`.
 *   2. `scheduled` — both parties confirmed completion. kayod/server's
 *                    completionController.handleWalletPaymentRelease has ALREADY
 *                    flipped that Transaction to `completed`, taken the amount
 *                    out of `heldBalance`, and scheduled an EscrowRelease for
 *                    the warranty window. The money is still the platform's to
 *                    move — it has not reached the provider.
 *
 * All three dispute outcomes used to require stage 1 (`status === 'held'`) and
 * reject everything else, which meant a dispute raised during the warranty hold
 * — the ordinary case, and the one the client's own "File a Dispute" action
 * offers — could not be resolved AT ALL. Every outcome answered "No held payment
 * found", the payout stayed frozen by the dispute, and the booking deadlocked
 * with the money in limbo. `refund_client` even carried code for cancelling the
 * live EscrowRelease that state produces, which its own guard made unreachable.
 *
 * ── The safety condition ─────────────────────────────────────────────────────
 *
 * Stage 2 is only settleable while the release has NOT paid out. Once
 * `paymentReleased` is set, or `escrowStatus` reads released/refunded, or no
 * live EscrowRelease remains, the money is gone or already returned and a
 * ruling must refuse rather than move it a second time.
 *
 * @returns {Promise<{heldTransaction: object, amount: number, stage: 'held'|'scheduled'}|null>}
 */
async function findSettleableEscrow(job, session = null) {
  const heldTransactionId = job?.paymentDetails?.heldTransaction;
  const heldTransaction = heldTransactionId
    ? await Transaction.findById(heldTransactionId).session(session)
    : null;

  if (!heldTransaction) return null;

  if (heldTransaction.status === 'held') {
    return { heldTransaction, amount: heldTransaction.amount, stage: 'held' };
  }

  if (job?.completionStatus?.paymentReleased) return null;
  if (['released', 'refunded'].includes(job?.escrowStatus)) return null;

  const liveRelease = await escrowService.findLiveEscrowRelease(job._id, session);
  if (!liveRelease) return null;

  return { heldTransaction, amount: heldTransaction.amount, stage: 'scheduled' };
}

module.exports = { findSettleableEscrow };
